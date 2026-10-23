"""Exploratory public-image benchmark. Not Brazilian/user-camera validation."""

from __future__ import annotations

import hashlib
import argparse
import io
import json
import time
import zipfile
from contextlib import ExitStack
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/scene"
CLASSES = {
    "livingroom": "living_room",
    "bedroom": "bedroom",
    "kitchen": "kitchen",
    "bathroom": "bathroom",
    "office": "office",
    "classroom": "classroom",
    "restaurant": "restaurant",
    "corridor": "corridor",
}
SELECTION = {"valid": 2, "test": 5}


def image_tensor(image: Image.Image) -> np.ndarray:
    pixels = np.asarray(
        image.convert("RGB").resize((224, 224), Image.Resampling.BILINEAR),
        dtype=np.float32,
    )
    return ((pixels / 127.5 - 1).transpose(2, 0, 1)[None]).copy()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vision", choices=["uint8", "q4"], default="q4")
    parser.add_argument("--confirmation", action="store_true")
    args = parser.parse_args()
    vectors = json.loads(
        (ROOT / "public/models/siglip2/embeddings.json").read_text("utf-8")
    )["candidates"]
    embeddings = np.array([x["vector"] for x in vectors], dtype=np.float32)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    started = time.perf_counter()
    session = ort.InferenceSession(
        str(OUT / f"siglip/onnx/vision_model_{args.vision}.onnx"),
        options,
        providers=["CPUExecutionProvider"],
    )
    load_ms = (time.perf_counter() - started) * 1000
    for _ in range(3):
        session.run(
            ["pooler_output"],
            {"pixel_values": np.zeros((1, 3, 224, 224), dtype=np.float32)},
        )
    records = []
    (OUT / "samples").mkdir(exist_ok=True)
    with ExitStack() as stack:
        archives = [
            (name, stack.enter_context(zipfile.ZipFile(OUT / f"{name}.zip")))
            for name in ["train", "valid", "test"]
        ]
        for original, category in CLASSES.items():
            pool = [
                (
                    hashlib.sha256(
                        Path(name).stem.split(".rf.")[0].encode()
                    ).hexdigest(),
                    origin,
                    archive,
                    name,
                )
                for origin, archive in archives
                for name in archive.namelist()
                if name.startswith(original + "/")
                and name.lower().endswith((".jpg", ".jpeg", ".png"))
            ]
            unique = {}
            for key, origin, archive, name in sorted(pool, key=lambda x: (x[0], x[3])):
                unique.setdefault(key, (origin, archive, name))
            pool_values = list(unique.values())
            selected = (
                (
                    pool_values[: SELECTION["valid"]]
                    + pool_values[
                        sum(SELECTION.values()) : sum(SELECTION.values())
                        + SELECTION["test"]
                    ]
                )
                if args.confirmation
                else pool_values[: sum(SELECTION.values())]
            )
            if len(selected) != sum(SELECTION.values()):
                raise ValueError(f"Insufficient distinct images for {original}")
            for sample, (origin, archive, name) in enumerate(selected):
                split = "valid" if sample < SELECTION["valid"] else "test"
                chosen = sample if split == "valid" else sample - SELECTION["valid"]
                image_bytes = archive.read(name)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                local = f"{split}-{category}-{chosen}.jpg"
                image.save(OUT / "samples" / local)
                tensor = image_tensor(image)
                then = time.perf_counter()
                feature = session.run(["pooler_output"], {"pixel_values": tensor})[0][0]
                elapsed = (time.perf_counter() - then) * 1000
                feature /= np.linalg.norm(feature)
                similarities = embeddings @ feature
                rank = np.argsort(similarities)[::-1]
                top = int(rank[0])
                runner = int(rank[1])
                records.append(
                    {
                        "split": split,
                        "expected": category,
                        "source_archive": origin,
                        "source_file": name,
                        "source_sha256": hashlib.sha256(image_bytes).hexdigest(),
                        "local": local,
                        "top": vectors[top]["id"],
                        "similarity": float(similarities[top]),
                        "margin": float(similarities[top] - similarities[runner]),
                        "runner": vectors[runner]["id"],
                        "inference_ms": elapsed,
                        "top5": [
                            {
                                "category": vectors[int(i)]["id"],
                                "similarity": float(similarities[int(i)]),
                            }
                            for i in rank[:5]
                        ],
                    }
                )
    # Reject tests are independent of category matching, not fake scene photographs.
    negative_inputs = {
        "black": Image.new("RGB", (416, 416), "black"),
        "white": Image.new("RGB", (416, 416), "white"),
        "severe_blur": Image.open(OUT / "samples/test-bedroom-0.jpg").filter(
            ImageFilter.GaussianBlur(60)
        ),
    }
    negatives = []
    for name, image in negative_inputs.items():
        feature = session.run(["pooler_output"], {"pixel_values": image_tensor(image)})[
            0
        ][0]
        feature /= np.linalg.norm(feature)
        scores = embeddings @ feature
        rank = np.argsort(scores)[::-1]
        negatives.append(
            {
                "name": name,
                "top": vectors[int(rank[0])]["id"],
                "similarity": float(scores[rank[0]]),
                "margin": float(scores[rank[0]] - scores[rank[1]]),
            }
        )
    development = [x for x in records if x["split"] == "valid"]
    thresholds = []
    for minimum in [0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.24, 0.26, 0.28]:
        for gap in [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04]:
            accepted = [
                x
                for x in development
                if x["similarity"] >= minimum
                and x["margin"] >= gap
                and not x["top"].startswith("reject_")
            ]
            correct = sum(x["top"] == x["expected"] for x in accepted)
            precision = correct / len(accepted) if accepted else 0
            if precision >= 0.9:
                thresholds.append(
                    {
                        "minimum": minimum,
                        "margin": gap,
                        "accepted": len(accepted),
                        "correct": correct,
                        "precision": precision,
                    }
                )
    if not thresholds:
        raise ValueError(
            "No threshold achieved development precision target; do not adopt blindly"
        )
    choice = sorted(
        thresholds,
        key=lambda x: (-x["correct"], -x["precision"], -x["margin"], -x["minimum"]),
    )[0]
    for row in records:
        row["accepted"] = (
            row["similarity"] >= choice["minimum"]
            and row["margin"] >= choice["margin"]
            and not row["top"].startswith("reject_")
        )
    report = {
        "scope": "Exploratory public MIT Indoor Scenes-derived image sample, 8 classes. Not Brazilian, not independent of unknown pretraining overlap. Candidates/thresholds frozen from development only.",
        "dataset": "keremberke/indoor-scene-classification",
        "dataset_revision": "030dcb9ec61c436299b1df10d90ae1cbe1d1b401",
        "samples_not_redistributed": True,
        "model_manifest": json.loads(
            (ROOT / "public/models/siglip2/manifest.json").read_text("utf-8")
        ),
        "confirmation_sample": args.confirmation,
        "partition": "Group by original photograph basename before .rf., order by SHA-256 of basename across source archives. Development uses indices 0..1; exploratory test 2..6; confirmation test 7..11. Source archive names are not used as experiment splits.",
        "runtime": ort.__version__,
        "provider": "CPUExecutionProvider",
        "threads": 4,
        "load_ms": load_ms,
        "thresholds": choice,
        "records": records,
        "negatives": negatives,
    }
    for split in SELECTION:
        subset = [x for x in records if x["split"] == split]
        accepted = [x for x in subset if x["accepted"]]
        correct = sum(x["expected"] == x["top"] for x in accepted)
        report[split] = {
            "samples": len(subset),
            "top1_correct": sum(x["expected"] == x["top"] for x in subset),
            "accepted": len(accepted),
            "correct_accepted": correct,
            "wrong_accepted": len(accepted) - correct,
            "abstained": len(subset) - len(accepted),
            "precision_when_accepted": correct / len(accepted) if accepted else None,
            "coverage": len(accepted) / len(subset),
        }
    times = [x["inference_ms"] for x in records]
    report["latency_ms"] = {
        "p50": float(np.percentile(times, 50)),
        "p95": float(np.percentile(times, 95)),
        "scope": "visual encoder only, excludes camera/speech/network",
    }
    (OUT / "benchmark.json").write_text(json.dumps(report, indent=2) + "\n", "utf-8")
    print(
        json.dumps(
            {
                key: report[key]
                for key in ["thresholds", "valid", "test", "latency_ms", "negatives"]
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
