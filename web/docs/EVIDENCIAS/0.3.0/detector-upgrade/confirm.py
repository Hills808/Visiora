"""Frozen confirmation on 30 new official COCO images; no product mutations."""

import argparse
import collections
import hashlib
import json
import platform
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

import benchmark as bench

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
POLICIES = {
    "nano-baseline": {"model": "nano", "thresholds": {"person": .50, "chair": .50, "bed": .50}},
    "s-target85": {"model": "s", "thresholds": {"person": .45, "chair": .45, "bed": .65}},
    "s-target90": {"model": "s", "thresholds": {"person": .45, "chair": .55, "bed": .80}},
    "tiny-target90": {"model": "tiny", "thresholds": {"person": .45, "chair": .70, "bed": .45}},
}
STRATA = ["bed-without-person", "chair-without-person-or-bed", "person-with-chair-or-bed", "person-without-chair-or-bed", "neither-target"]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bucket(categories):
    person, chair, bed = (cat in categories for cat in (1, 62, 65))
    if bed and not person:
        return STRATA[0]
    if chair and not person and not bed:
        return STRATA[1]
    if person and (chair or bed):
        return STRATA[2]
    if person:
        return STRATA[3]
    return STRATA[4]


def prepare():
    dest = ROOT / "confirmation-protocol.json"
    if dest.exists():
        raise RuntimeError("Frozen confirmation protocol already exists; refusing overwrite")
    data = json.loads((ROOT / "instances_val2017.json").read_text())
    dev = json.loads((ROOT / "protocol.json").read_text())
    grouped = collections.defaultdict(list)
    for ann in data["annotations"]:
        grouped[ann["image_id"]].append({key: ann[key] for key in ("id", "category_id", "bbox", "area", "iscrowd")})
    pools = collections.defaultdict(list)
    for original in data["images"]:
        image = dict(original)
        image["anns"] = grouped[image["id"]]
        image["bucket"] = bucket({ann["category_id"] for ann in image["anns"]})
        image["order"] = hashlib.sha256(f"visiora-object-eval-v1:{image['id']}".encode()).hexdigest()
        pools[image["bucket"]].append(image)
    selected = []
    dev_ids = {image["id"] for image in dev["images"]}
    for name in STRATA:
        ordered = sorted(pools[name], key=lambda image: image["order"])
        expected = [image["id"] for image in dev["images"] if image["bucket"] == name]
        assert expected == [image["id"] for image in ordered[:12]], (name, "Original selection not reproduced")
        selected.extend(ordered[12:18])
    assert len(selected) == 30 and not dev_ids.intersection(image["id"] for image in selected)
    protocol = {
        "version": "visiora-object-confirmation-v1",
        "createdUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "selectionFrozenBeforeInference": True,
        "selection": "Same disjoint five annotation strata and SHA256(visiora-object-eval-v1:+numeric image id) order as development; entries 13 through 18 per stratum; exact first 12 development IDs independently asserted.",
        "developmentProtocolSHA256": digest(ROOT / "protocol.json"),
        "developmentCalibrationSHA256": digest(ROOT / "calibration.json"),
        "annotationSHA256": digest(ROOT / "instances_val2017.json"),
        "policiesFrozenBeforeInference": POLICIES,
        "matching": "Greedy score-descending predictions; IoU>=.5 to one unused non-crowd box; unmatched detections overlapping same-class crowd with intersection/detection-area>=.5 ignored; NMS .45, same mapped classes and max30 as product. No COCO mAP.",
        "limitations": ["30 stratified public COCO validation images; prevalence not representative.", "COCO val2017 is known model-development validation data; not independent Brazilian camera performance.", "Policy names refer to development targets, never confirmation guarantees.", "No threshold adjustment permitted after confirmation; no private photograph used.", "Timing exploratory single-pass shared CPU, not controlled latency comparison."],
        "licenses": data["licenses"],
        "images": selected,
    }
    dest.write_text(json.dumps(protocol, indent=2))
    print(json.dumps({"path": str(dest), "sha256": digest(dest), "ids": [image["id"] for image in selected]}, indent=2))


def assert_crowd_matching():
    # Smaller detection inside a large crowd must be ignored by IoA, despite low IoU.
    image = {"anns": [{"category_id": 1, "iscrowd": 1, "bbox": [0, 0, 100, 100]}]}
    det = {"class": "person", "score": .9, "box": [10, 10, 20, 20]}
    score = bench.evaluate(image, [det], .5)["person"]
    assert score["tp"] == 0 and score["fp"] == 0 and len(score["ignoredCrowd"]) == 1
    # A normal non-crowd match wins before crowd ignore, and a crowd may ignore multiple detections.
    image["anns"].append({"category_id": 1, "iscrowd": 0, "bbox": [10, 10, 10, 10]})
    score = bench.evaluate(image, [det, {**det, "box": [40, 40, 50, 50]}], .5)["person"]
    assert score["tp"] == 1 and score["fp"] == 0 and score["fn"] == 0 and len(score["ignoredCrowd"]) == 1
    return "Synthetic crowd IoA and normal-first assertions passed"


def main():
    protocol_path = ROOT / "confirmation-protocol.json"
    protocol = json.loads(protocol_path.read_text())
    assert protocol["policiesFrozenBeforeInference"] == POLICIES
    assert protocol["annotationSHA256"] == digest(ROOT / "instances_val2017.json")
    paths = {"nano": PROJECT / "public/models/yolox-nano.onnx", "tiny": ROOT / "yolox_tiny.onnx", "s": ROOT / "yolox_s.onnx"}
    report = {
        "confirmationProtocolSHA256": digest(protocol_path), "policies": {}, "models": {},
        "runtime": {"python": platform.python_version(), "opencv": cv2.__version__, "onnxruntime": ort.__version__, "threads": 1},
        "crowdCheck": assert_crowd_matching(), "limitations": protocol["limitations"],
    }
    for name, model in paths.items():
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
        rows = []
        for image in protocol["images"]:
            path = ROOT / "confirmation-images" / image["file_name"]
            bgr = cv2.imread(str(path))
            if bgr is None or bgr.shape[:2] != (image["height"], image["width"]):
                raise ValueError(f"Missing/corrupt image {path}")
            detections, elapsed = bench.infer_image(session, bgr)
            rows.append({"id": image["id"], "file": image["file_name"], "bucket": image["bucket"], "imageSHA256": digest(path), "inferenceMsExploratory": elapsed, "detections": detections})
        report["models"][name] = {"bytes": model.stat().st_size, "sha256": digest(model), "rows": rows}
        for policy_id, policy in POLICIES.items():
            if policy["model"] != name:
                continue
            scored = []
            for image, row in zip(protocol["images"], rows):
                scores = {cls: bench.evaluate(image, row["detections"], threshold)[cls] for cls, threshold in policy["thresholds"].items()}
                scored.append({"id": image["id"], "bucket": image["bucket"], "score": scores})
            summary = {}
            for cls in bench.CATEGORY:
                items = [row["score"][cls] for row in scored]
                sums = {key: sum(item[key] for item in items) for key in ("tp", "fp", "fn", "gt")}
                sums["ignoredCrowd"] = sum(len(item["ignoredCrowd"]) for item in items)
                sums["precision"] = sums["tp"] / max(1, sums["tp"] + sums["fp"])
                sums["recall"] = sums["tp"] / max(1, sums["gt"])
                sums["negativeImages"] = sum(item["gt"] == 0 for item in items)
                sums["negativeImagesWithFalseDetection"] = sum(item["gt"] == 0 and item["fp"] > 0 for item in items)
                summary[cls] = sums
            report["policies"][policy_id] = {**policy, "summary": summary, "rows": scored}
            print(policy_id, json.dumps(summary), flush=True)
        (ROOT / "confirmation-results.json").write_text(json.dumps(report, indent=2))
    print("Saved", ROOT / "confirmation-results.json", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare", action="store_true")
    args = parser.parse_args()
    prepare() if args.prepare else main()
