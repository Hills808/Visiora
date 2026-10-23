"""Public COCO comparison for a pinned RF-DETR Nano ONNX candidate; not product code."""

import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

PROJECT = Path(__file__).resolve().parents[2]
if len(sys.argv) != 3 or sys.argv[1] not in {"rfdetr", "dfine", "dfine-f32"}:
    raise SystemExit("Usage: evaluate.py rfdetr|dfine|dfine-f32 dev|confirm")
CANDIDATE = sys.argv[1]
ROOT = PROJECT / "artifacts" / ("h2-" + CANDIDATE)
OLD = PROJECT / "artifacts" / "detector-upgrade"
sys.path.insert(0, str(PROJECT / "artifacts" / "h2-python"))
sys.path.insert(0, str(OLD))
from transformers import RTDetrImageProcessor  # noqa: E402
import benchmark as matching  # noqa: E402

PROTOCOL = json.loads((ROOT / "protocol.json").read_text(encoding="utf-8"))
MODEL = ROOT / "onnx" / ("model.onnx" if CANDIDATE == "dfine-f32" else "model_uint8.onnx")
COCO = json.loads((OLD / "instances_val2017.json").read_text(encoding="utf-8"))
CATEGORIES = sorted(COCO["categories"], key=lambda row: row["id"])
MAPPED_IDS = ({CATEGORIES[index]["id"] for index in matching.MAPPED} if CANDIDATE == "rfdetr"
              else set(matching.MAPPED))
CLASS_NAMES = ({row["id"]: row["name"] for row in CATEGORIES} if CANDIDATE == "rfdetr"
               else {int(key): value for key, value in json.loads((ROOT / "config.json").read_text())["id2label"].items()})
PROCESSOR = RTDetrImageProcessor.from_pretrained(str(ROOT))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify() -> None:
    assert sha(MODEL) == PROTOCOL["model"]["sha256"]
    assert MODEL.stat().st_size == PROTOCOL["model"]["bytes"]
    assert sha(OLD / "protocol.json") == PROTOCOL["data"]["developmentSha256"]
    assert sha(OLD / "confirmation-protocol.json") == PROTOCOL["data"]["confirmationSha256"]
    size = 384 if CANDIDATE == "rfdetr" else 640
    assert PROCESSOR.size == {"height": size, "width": size}
    assert PROCESSOR.do_normalize is False and PROCESSOR.do_pad is False


def postprocess(boxes: np.ndarray, logits: np.ndarray, width: int, height: int) -> list[dict]:
    scores = 1 / (1 + np.exp(-logits[0]))
    order = np.argsort(-scores.reshape(-1), kind="stable")[:300]
    selected, used_query = [], set()
    for flat in order:
        query, label = divmod(int(flat), scores.shape[1])
        score = float(scores[query, label])
        if score < PROTOCOL["thresholds"][0] or query in used_query or label not in MAPPED_IDS:
            continue
        used_query.add(query)
        cx, cy, w, h = boxes[0, query]
        xyxy = np.array([(cx-w/2)*width, (cy-h/2)*height, (cx+w/2)*width, (cy+h/2)*height])
        xyxy[[0, 2]] = np.clip(xyxy[[0, 2]], 0, width)
        xyxy[[1, 3]] = np.clip(xyxy[[1, 3]], 0, height)
        if xyxy[2] <= xyxy[0] or xyxy[3] <= xyxy[1]:
            continue
        selected.append({"class": CLASS_NAMES[label], "score": score, "box": xyxy.tolist()})
        if len(selected) == 30:
            break
    return selected


def summary(images: list[dict], rows: list[dict], threshold: float) -> dict:
    report = {}
    for cls in matching.CATEGORY:
        scores = [matching.evaluate(image, row["detections"], threshold)[cls] for image, row in zip(images, rows)]
        tp, fp, fn = (sum(item[key] for item in scores) for key in ("tp", "fp", "fn"))
        report[cls] = {
            "tp": tp, "fp": fp, "fn": fn,
            "precision": tp / max(1, tp + fp), "recall": tp / max(1, tp + fn),
        }
    return report


def inference(partition: str) -> tuple[list[dict], list[dict]]:
    protocol_file, image_dir = (("protocol.json", "images") if partition == "dev" else
                                ("confirmation-protocol.json", "confirmation-images"))
    images = json.loads((OLD / protocol_file).read_text(encoding="utf-8"))["images"]
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(MODEL), sess_options=options, providers=["CPUExecutionProvider"])
    rows = []
    for i, image in enumerate(images):
        with Image.open(OLD / image_dir / image["file_name"]) as picture:
            width, height = picture.size
            tensor = PROCESSOR(images=picture.convert("RGB"), return_tensors="np")["pixel_values"]
        started = time.perf_counter()
        outputs = session.run(None, {session.get_inputs()[0].name: tensor})
        elapsed = (time.perf_counter() - started) * 1000
        output_map = {meta.name: value for meta, value in zip(session.get_outputs(), outputs)}
        boxes, logits = output_map["pred_boxes"], output_map["logits"]
        rows.append({"id": image["id"], "inferenceMs": elapsed,
                     "detections": postprocess(boxes, logits, width, height)})
        if (i + 1) % 10 == 0:
            print(partition, i + 1, "of", len(images), flush=True)
    return images, rows


def development() -> None:
    images, rows = inference("dev")
    candidates = {str(t): summary(images, rows, t) for t in PROTOCOL["thresholds"]}
    selection = {}
    for cls in matching.CATEGORY:
        eligible = [(t, candidates[str(t)][cls]) for t in PROTOCOL["thresholds"]
                    if candidates[str(t)][cls]["precision"] >= .9
                    and candidates[str(t)][cls]["tp"] + candidates[str(t)][cls]["fp"] >= 5]
        if not eligible:
            selection[cls] = None
        else:
            threshold, result = max(eligible, key=lambda pair: (pair[1]["recall"], pair[1]["precision"], -pair[0]))
            selection[cls] = {"threshold": threshold, **result}
    payload = {"protocolSha256": sha(ROOT / "protocol.json"), "selection": selection,
               "candidates": candidates, "rows": rows}
    (ROOT / "development.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    (ROOT / "selection.json").write_text(json.dumps({"protocolSha256": payload["protocolSha256"],
                                                      "developmentSha256": sha(ROOT / "development.json"),
                                                      "selection": selection}, indent=2), encoding="utf-8")
    print(json.dumps(selection), flush=True)


def confirmation() -> None:
    frozen = json.loads((ROOT / "selection.json").read_text(encoding="utf-8"))
    assert frozen["protocolSha256"] == sha(ROOT / "protocol.json")
    assert frozen["developmentSha256"] == sha(ROOT / "development.json")
    images, rows = inference("confirm")
    results = {cls: summary(images, rows, value["threshold"])[cls] if value else None
               for cls, value in frozen["selection"].items()}
    payload = {"protocolSha256": frozen["protocolSha256"],
               "selectionSha256": sha(ROOT / "selection.json"), "results": results, "rows": rows}
    (ROOT / "confirmation.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(results), flush=True)


if __name__ == "__main__":
    verify()
    if sys.argv[2] == "dev":
        development()
    elif sys.argv[2] == "confirm":
        confirmation()
    else:
        raise SystemExit("Usage: evaluate.py dev|confirm")
