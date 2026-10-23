"""Frozen small COCO comparison. Does not mutate product code or models.

All image strata and thresholds were fixed in protocol.json before any run.
This is not COCO mAP, an independent generalization estimate, or a latency trial.
"""
import hashlib
import json
import platform
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
PROTOCOL = json.loads((ROOT / "protocol.json").read_text())
TARGETS = {0: "person", 56: "chair", 59: "bed"}
CATEGORY = {"person": 1, "chair": 62, "bed": 65}
# Match the product's exposed COCO classes, then apply its maxDetections=30.
MAPPED = [0,1,2,3,5,6,7,13,14,15,16,24,25,26,28,39,41,42,43,44,45,46,47,49,52,56,57,58,59,60,61,62,63,64,65,66,67,68,69,71,72,73,74,75,76,77,78,79]


def iou(box, boxes):
    if not len(boxes):
        return np.zeros(0)
    lt = np.maximum(box[:2], boxes[:, :2])
    rb = np.minimum(box[2:], boxes[:, 2:])
    intersection = np.prod(np.maximum(0, rb - lt), axis=1)
    area = np.prod(box[2:] - box[:2])
    areas = np.prod(boxes[:, 2:] - boxes[:, :2], axis=1)
    return intersection / np.maximum(area + areas - intersection, 1e-12)


def crowd_ioa(box, boxes):
    """COCO-style crowd ignores use intersection / detection area, not IoU."""
    if not len(boxes):
        return np.zeros(0)
    lt = np.maximum(box[:2], boxes[:, :2])
    rb = np.minimum(box[2:], boxes[:, 2:])
    intersection = np.prod(np.maximum(0, rb - lt), axis=1)
    return intersection / max(float(np.prod(box[2:] - box[:2])), 1e-12)


def postprocess(output, size, width, height, ratio):
    # Release 0.1.1rc0 ONNX has raw head: decode grid and strides exactly once.
    grids, strides = [], []
    for stride in (8, 16, 32):
        yy, xx = np.meshgrid(np.arange(size // stride), np.arange(size // stride), indexing="ij")
        grids.append(np.stack([xx, yy], axis=-1).reshape(-1, 2))
        strides.append(np.full(((size // stride) ** 2, 1), stride))
    grid, stride = np.concatenate(grids), np.concatenate(strides)
    prediction = output[0]
    centers = (prediction[:, :2] + grid) * stride
    dims = np.exp(prediction[:, 2:4]) * stride
    boxes = np.concatenate([centers - dims / 2, centers + dims / 2], axis=1) / ratio
    boxes[:, [0, 2]] = np.clip(boxes[:, [0, 2]], 0, width)
    boxes[:, [1, 3]] = np.clip(boxes[:, [1, 3]], 0, height)
    classes = np.argmax(prediction[:, 5:], axis=1)
    scores = prediction[:, 4] * np.max(prediction[:, 5:], axis=1)
    indices = np.flatnonzero((scores >= .45) & np.isin(classes, MAPPED))
    indices = indices[np.argsort(-scores[indices], kind="stable")]
    kept = []
    for idx in indices:
        same = [prior for prior in kept if classes[idx] == classes[prior]]
        if same and np.any(iou(boxes[idx], boxes[same]) > .45):
            continue
        if boxes[idx, 2] <= boxes[idx, 0] or boxes[idx, 3] <= boxes[idx, 1]:
            continue
        kept.append(idx)
    return [{"class": TARGETS[int(classes[idx])], "score": float(scores[idx]), "box": boxes[idx].tolist()}
            for idx in kept[:30] if int(classes[idx]) in TARGETS]


def infer_image(session, bgr):
    """Accept in-memory decoded BGR only; no image writes. Returns target detections."""
    size = session.get_inputs()[0].shape[-1]
    height, width = bgr.shape[:2]
    ratio = min(size / height, size / width)
    resized = cv2.resize(bgr, (int(width*ratio), int(height*ratio)), interpolation=cv2.INTER_LINEAR)
    padded = np.full((size, size, 3), 114, dtype=np.uint8)
    padded[:resized.shape[0], :resized.shape[1]] = resized
    tensor = np.ascontiguousarray(padded.transpose(2,0,1), dtype=np.float32)[None]
    started = time.perf_counter()
    output = session.run(None, {session.get_inputs()[0].name: tensor})[0]
    elapsed = 1000 * (time.perf_counter()-started)
    return postprocess(output, size, width, height, ratio), elapsed


def stdin_image():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--stdin-image", action="store_true")
    parser.add_argument("--model", choices=["nano", "tiny", "s"], default="nano")
    parser.add_argument("--crop", type=int, nargs=4)
    args = parser.parse_args()
    # No private bytes, crops, embeddings, or result images are persisted.
    bgr = cv2.imdecode(np.frombuffer(sys.stdin.buffer.read(), dtype=np.uint8), cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("stdin must contain an encoded PNG/JPEG image")
    if args.crop:
        x1,y1,x2,y2 = args.crop
        if x1 < 0 or y1 < 0 or x2 > bgr.shape[1] or y2 > bgr.shape[0] or x2 <= x1 or y2 <= y1:
            raise ValueError("Crop outside supplied image")
        bgr = bgr[y1:y2,x1:x2]
    model = PROJECT / "public/models/yolox-nano.onnx" if args.model == "nano" else ROOT / ("yolox_tiny.onnx" if args.model == "tiny" else "yolox_s.onnx")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
    detections, elapsed = infer_image(session, bgr)
    print(json.dumps({"model": args.model, "threshold": .45, "width": bgr.shape[1], "height": bgr.shape[0], "detections": detections, "inferenceMsExploratory": elapsed}))


def evaluate(image, detections, threshold):
    results = {}
    for cls, cat in CATEGORY.items():
        gt, crowd = [], []
        for ann in image["anns"]:
            if ann["category_id"] != cat:
                continue
            x, y, w, h = ann["bbox"]
            (crowd if ann["iscrowd"] else gt).append([x, y, x+w, y+h])
        matched = set()
        false_boxes, matched_boxes, ignored = [], [], []
        for det in (det for det in detections if det["class"] == cls and det["score"] >= threshold):
            scores = iou(np.array(det["box"]), np.array(gt))
            choices = [idx for idx in np.argsort(-scores) if idx not in matched and scores[idx] >= .5]
            if choices:
                matched.add(int(choices[0]))
                matched_boxes.append({**det, "groundTruthIndex": int(choices[0]), "iou": float(scores[choices[0]])})
            elif len(crowd) and np.any(crowd_ioa(np.array(det["box"]), np.array(crowd)) >= .5):
                ignored.append(det)
            else:
                false_boxes.append(det)
        results[cls] = {"tp": len(matched), "fp": len(false_boxes), "fn": len(gt)-len(matched),
                        "gt": len(gt), "matches": matched_boxes, "falsePositives": false_boxes,
                        "missedBoxes": [box for idx, box in enumerate(gt) if idx not in matched], "ignoredCrowd": ignored}
    return results


def main():
    models = [
        ("nano", PROJECT / "public/models/yolox-nano.onnx"),
        ("tiny", ROOT / "yolox_tiny.onnx"),
        ("s", ROOT / "yolox_s.onnx"),
    ]
    report = {"protocolSHA256": hashlib.sha256((ROOT / "protocol.json").read_bytes()).hexdigest(),
              "runtime": {"python": platform.python_version(), "opencv": cv2.__version__, "onnxruntime": ort.__version__, "threads": 1},
              "timingCaveat": "Exploratory only, CPU shared with other project checks; no controlled latency comparison.", "models": {}}
    for name, model in models:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
        shape = session.get_inputs()[0].shape
        size = shape[-1]
        print(name, shape, session.get_outputs()[0].shape, flush=True)
        rows = []
        for image in PROTOCOL["images"]:
            bgr = cv2.imread(str(ROOT / "images" / image["file_name"]))
            height, width = bgr.shape[:2]
            ratio = min(size / height, size / width)
            resized = cv2.resize(bgr, (int(width*ratio), int(height*ratio)), interpolation=cv2.INTER_LINEAR)
            padded = np.full((size, size, 3), 114, dtype=np.uint8)
            padded[:resized.shape[0], :resized.shape[1]] = resized
            tensor = np.ascontiguousarray(padded.transpose(2,0,1), dtype=np.float32)[None]
            started = time.perf_counter()
            output = session.run(None, {session.get_inputs()[0].name: tensor})[0]
            elapsed = 1000 * (time.perf_counter()-started)
            detections = postprocess(output, size, width, height, ratio)
            rows.append({"id": image["id"], "file": image["file_name"], "bucket": image["bucket"],
                         "inferenceMsExploratory": elapsed, "detections": detections,
                         "score0.5": evaluate(image, detections, .5), "score0.45": evaluate(image, detections, .45)})
        summaries = {}
        for key in ("score0.5", "score0.45"):
            summary = {}
            for cls in CATEGORY:
                sums = {metric: sum(row[key][cls][metric] for row in rows) for metric in ("tp", "fp", "fn", "gt")}
                sums["precision"] = sums["tp"] / max(1, sums["tp"]+sums["fp"])
                sums["recall"] = sums["tp"] / max(1, sums["gt"])
                negative = [row for row in rows if row[key][cls]["gt"] == 0]
                sums["negativeImages"] = len(negative)
                sums["negativeImagesWithFalseDetection"] = sum(row[key][cls]["fp"] > 0 for row in negative)
                summary[cls] = sums
            summaries[key] = summary
        report["models"][name] = {"bytes": model.stat().st_size, "sha256": hashlib.sha256(model.read_bytes()).hexdigest(),
                                  "input": shape, "output": session.get_outputs()[0].shape, "preprocessing": "BGR float32 raw [0,255], top-left letterbox fill114, OpenCV linear resize",
                                  "summary": summaries, "rows": rows}
        (ROOT / "results.json").write_text(json.dumps(report, indent=2))
        print(name, json.dumps(summaries["score0.5"]), flush=True)
    print("Saved", ROOT / "results.json", flush=True)


if __name__ == "__main__":
    if "--stdin-image" in sys.argv:
        stdin_image()
    else:
        main()
