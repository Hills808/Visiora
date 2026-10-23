"""Compare a dedicated learned scene network; no product dependency on Torch."""

from __future__ import annotations
import hashlib
import io
import json
import time
import zipfile
from pathlib import Path
import numpy as np
import onnxruntime as ort
import torch
from PIL import Image
from torchvision.models import resnet18

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "artifacts/scene"


def main() -> None:
    torch.set_num_threads(4)
    model = resnet18(weights=None, num_classes=365)
    weights = BASE / "resnet18_places365.pth.tar"
    checkpoint = torch.load(weights, map_location="cpu", weights_only=True)
    model.load_state_dict(
        {k.removeprefix("module."): v for k, v in checkpoint["state_dict"].items()},
        strict=True,
    )
    model.eval()
    output = BASE / "places365.onnx"
    torch.onnx.export(
        model,
        torch.zeros(1, 3, 224, 224),
        str(output),
        opset_version=17,
        input_names=["pixel_values"],
        output_names=["logits"],
        dynamo=False,
        external_data=False,
    )
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    session = ort.InferenceSession(
        str(output), options, providers=["CPUExecutionProvider"]
    )
    names = [
        line.strip().split()[0][3:]
        for line in (BASE / "categories_places365.txt").read_text("utf-8").splitlines()
    ]
    archives = {
        name: zipfile.ZipFile(BASE / f"{name}.zip")
        for name in ["train", "valid", "test"]
    }
    records = []
    try:
        for variant in ["benchmark-exploratory", "confirmation"]:
            data = json.loads((BASE / f"{variant}.json").read_text("utf-8"))
            for sample in data["records"]:
                image = (
                    Image.open(
                        io.BytesIO(
                            archives[sample["source_archive"]].read(
                                sample["source_file"]
                            )
                        )
                    )
                    .convert("RGB")
                    .resize((256, 256), Image.Resampling.BILINEAR)
                    .crop((16, 16, 240, 240))
                )
                pixels = np.asarray(image, dtype=np.float32) / 255
                tensor = (
                    (
                        (pixels - np.array([0.485, 0.456, 0.406], dtype=np.float32))
                        / np.array([0.229, 0.224, 0.225], dtype=np.float32)
                    )
                    .transpose(2, 0, 1)[None]
                    .copy()
                )
                start = time.perf_counter()
                logits = session.run(["logits"], {"pixel_values": tensor})[0][0]
                elapsed = (time.perf_counter() - start) * 1000
                probs = np.exp(logits - logits.max())
                probs /= probs.sum()
                rank = np.argsort(probs)[::-1]
                prediction = names[int(rank[0])]
                records.append(
                    {
                        "variant": variant,
                        **{
                            k: sample[k]
                            for k in [
                                "split",
                                "expected",
                                "source_archive",
                                "source_file",
                                "source_sha256",
                                "local",
                            ]
                        },
                        "top": prediction,
                        "score": float(probs[rank[0]]),
                        "margin": float(probs[rank[0]] - probs[rank[1]]),
                        "runner": names[int(rank[1])],
                        "inference_ms": elapsed,
                    }
                )
    finally:
        for archive in archives.values():
            archive.close()
    dev = [
        r
        for r in records
        if r["variant"] == "benchmark-exploratory" and r["split"] == "valid"
    ]
    settings = []
    for score in [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7]:
        for margin in [0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25]:
            accepted = [r for r in dev if r["score"] >= score and r["margin"] >= margin]
            correct = sum(r["top"] == r["expected"] for r in accepted)
            if accepted and correct / len(accepted) >= 0.9:
                settings.append(
                    {
                        "score": score,
                        "margin": margin,
                        "accepted": len(accepted),
                        "correct": correct,
                        "precision": correct / len(accepted),
                    }
                )
    (BASE / "places-raw.json").write_text(
        json.dumps(
            {"records": records, "development_filter_passed": bool(settings)}, indent=2
        ),
        "utf-8",
    )
    chosen = (
        sorted(
            settings,
            key=lambda x: (-x["correct"], -x["precision"], -x["margin"], -x["score"]),
        )[0]
        if settings
        else None
    )
    for r in records:
        r["accepted"] = bool(
            chosen and r["score"] >= chosen["score"] and r["margin"] >= chosen["margin"]
        )
    summary = {}
    for variant in ["benchmark-exploratory", "confirmation"]:
        test = [r for r in records if r["variant"] == variant and r["split"] == "test"]
        accepted = [r for r in test if r["accepted"]]
        summary[variant] = {
            "samples": len(test),
            "top1_correct": sum(r["top"] == r["expected"] for r in test),
            "accepted": len(accepted),
            "correct_accepted": sum(r["top"] == r["expected"] for r in accepted),
            "abstained": len(test) - len(accepted),
        }
    report = {
        "model": "Places365 ResNet18 F32",
        "license": "CC BY, version unspecified by authors",
        "checkpoint_sha256": hashlib.sha256(weights.read_bytes()).hexdigest(),
        "onnx_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "onnx_bytes": output.stat().st_size,
        "development_filter_passed": bool(settings),
        "thresholds": chosen,
        "summary": summary,
        "records": records,
        "runtime": ort.__version__,
        "provider": "CPUExecutionProvider",
        "threads": 4,
        "latency_ms": {
            "p50": float(np.percentile([r["inference_ms"] for r in records], 50)),
            "p95": float(np.percentile([r["inference_ms"] for r in records], 95)),
        },
        "scope": "Diagnostic strict string-label comparison, NOT a fair semantic accuracy comparison: Places365 taxonomy differs from the eight dataset targets (e.g. hotel_room versus bedroom). No label crosswalk was calibrated or adopted. Public research samples; unknown training overlap; not Brazilian/user validation. Repeated development images included in timing; no warmup excluded.",
    }
    (BASE / "places-benchmark.json").write_text(
        json.dumps(report, indent=2) + "\n", "utf-8"
    )
    print(
        json.dumps(
            {
                k: report[k]
                for k in ["model", "onnx_bytes", "thresholds", "summary", "latency_ms"]
            },
            indent=2,
        )
    )
    if not settings:
        print(
            "No development filter met the strict-label target. Semantic taxonomy alignment remains pending; this does not establish a model-quality ranking."
        )


if __name__ == "__main__":
    main()
