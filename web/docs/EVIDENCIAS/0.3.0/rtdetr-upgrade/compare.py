"""RT-DETRv2 public development + frozen confirmation; artifact-only workflow."""

import argparse
import hashlib
import json
import platform
import sys
import time
import traceback
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / "detector-upgrade"
sys.path.insert(0, str(OLD))
import benchmark as matching

GRID = [.45, .50, .55, .60, .65, .70, .75, .80, .85, .90]
TARGETS = {0: "person", 56: "chair", 59: "bed"}
VARIANTS = {"f32": "model.onnx", "uint8": "model_uint8.onnx"}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(name, data):
    (ROOT / name).write_text(json.dumps(data, indent=2), encoding="utf-8")


def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def prepare():
    dest = ROOT / "protocol.json"
    if dest.exists():
        raise RuntimeError("Protocol exists; refusing overwrite")
    config = read("config.json")
    prep = read("preprocessor_config.json")
    assert {int(key): config["id2label"][key] for key in ("0", "56", "59")} == TARGETS
    assert len(config["id2label"]) == 80 and config["use_focal_loss"]
    assert prep["do_resize"] and prep["do_rescale"] and not prep["do_normalize"] and not prep["do_pad"]
    assert prep["size"] == {"height": 640, "width": 640} and prep["resample"] == 2
    write("protocol.json", {
        "version": "visiora-rtdetr-v2-r18-confirm-v1",
        "createdBeforeAnyVariantInference": True,
        "createdUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "development": {"count": 60, "path": "../detector-upgrade/protocol.json", "sha256": sha(OLD / "protocol.json")},
        "confirmation": {"count": 30, "path": "../detector-upgrade/confirmation-protocol.json", "sha256": sha(OLD / "confirmation-protocol.json")},
        "sources": read("source-snapshot.json"),
        "modelFiles": read("model-sources.json"),
        "preprocessing": "PIL RGB bilinear resize whole frame 640x640, no letterbox/pad; float32 channels-first RGB *1/255; no mean/std normalization. Browser canvas high interpolation may differ and is not equated to PIL.",
        "postprocessing": "Sigmoid logits [300,80]. Official focal postprocessor flattens all query/class pairs, sorts top300 (stable flat-index tie break here); keep highest scoring pair once per original query to prevent identical query box repeated under multiple classes. This differs from official output only by that explicit query de-duplication. No NMS or suppression between distinct queries. Convert normalized cxcywh to original xyxy, clip image bounds; keep product mapped classes and at most30 globally, then retain three evaluation targets. Threshold>=.45 caches reusable raw detections. Do not favor target classes.",
        "matching": "Existing evaluate: descending score, IoU>=.5 to unused normal GT, then same-class crowd ignored at intersection/detectionArea>=.5. All sizes. No relabeling. Not COCO mAP.",
        "grid": GRID,
        "minimumNonIgnoredPredictionsForDevelopmentClassSelection": 5,
        "selectionRule": "Use ONLY development60. For each variant/class, at precision target.90 maximize recall, then precision, then lower threshold, requiring >=5 TP+FP. Eligible variant needs all3classes. Rank eligible variants by macro recall, macro precision, then lower bytes. If no variant eligible at.90, repeat once at.85. If none eligible, no selected model and do not claim adoptable variant. Freeze selected variant/thresholds in selection.json before confirmation30. No post-confirmation changes.",
        "limitations": ["Small stratified COCO val2017 samples, not representative prevalence or independent Brazilian camera validation.", "COCO val2017 is model development validation data; these are local regression comparisons, not COCO mAP.", "Confidence score is not calibrated probability.", "No private image or product source mutation.", "Native CPU timings single-pass shared machine, not controlled performance or browser latency."],
    })
    print("Frozen protocol", sha(dest), flush=True)


def tensor_from_image(path):
    with Image.open(path) as image:
        width, height = image.size
        rgb = np.asarray(image.convert("RGB").resize((640, 640), Image.Resampling.BILINEAR), dtype=np.float32)
    tensor = np.ascontiguousarray((rgb * np.float32(1 / 255)).transpose(2, 0, 1))[None]
    return tensor, width, height


def postprocess(logits, boxes, width, height):
    assert logits.shape == (1, 300, 80) and boxes.shape == (1, 300, 4)
    scores = 1 / (1 + np.exp(-np.clip(logits[0], -80, 80)))
    flat = scores.flatten()
    indices = np.argsort(-flat, kind="stable")[:300]
    seen, kept, repeated, same_query_above = set(), [], 0, 0
    for index in indices:
        query, cls = divmod(int(index), 80)
        score = float(flat[index])
        if query in seen:
            repeated += 1
            same_query_above += int(score >= .45)
            continue
        seen.add(query)
        if score < .45 or cls not in matching.MAPPED:
            continue
        cx, cy, bw, bh = boxes[0, query]
        box = np.array([(cx-bw/2)*width, (cy-bh/2)*height, (cx+bw/2)*width, (cy+bh/2)*height])
        box[[0, 2]] = np.clip(box[[0, 2]], 0, width)
        box[[1, 3]] = np.clip(box[[1, 3]], 0, height)
        if box[2] <= box[0] or box[3] <= box[1]:
            continue
        kept.append({"classId": cls, "queryIndex": query, "score": score, "box": box.tolist()})
    targets = [{**det, "class": TARGETS[det["classId"]]} for det in kept[:30] if det["classId"] in TARGETS]
    return targets, {"repeatedSameQueryInOfficialTop300": repeated, "repeatedSameQueryAboveMinScore": same_query_above, "allMappedAboveMinScore": len(kept)}


def score_summary(images, rows, cls, threshold):
    evaluated = [matching.evaluate(image, row["detections"], threshold)[cls] for image, row in zip(images, rows)]
    summary = {key: sum(row[key] for row in evaluated) for key in ("tp", "fp", "fn", "gt")}
    summary["precision"] = summary["tp"] / max(1, summary["tp"]+summary["fp"])
    summary["recall"] = summary["tp"] / max(1, summary["gt"])
    summary["ignoredCrowd"] = sum(len(row["ignoredCrowd"]) for row in evaluated)
    summary["predictions"] = summary["tp"] + summary["fp"]
    summary["negativeImages"] = sum(row["gt"] == 0 for row in evaluated)
    summary["negativeImagesWithFalseDetection"] = sum(row["gt"] == 0 and row["fp"] > 0 for row in evaluated)
    summary["threshold"] = threshold
    return summary


def run_variant(variant, images, image_dir):
    path = ROOT / VARIANTS[variant]
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    started = time.perf_counter()
    session = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
    load_ms = (time.perf_counter()-started)*1000
    assert len(session.get_inputs()) == 1 and session.get_inputs()[0].name == "pixel_values"
    assert [o.name for o in session.get_outputs()] == ["logits", "pred_boxes"]
    rows = []
    for index, image in enumerate(images):
        image_path = image_dir / image["file_name"]
        tensor, width, height = tensor_from_image(image_path)
        assert (height, width) == (image["height"], image["width"])
        started = time.perf_counter()
        logits, boxes = session.run(None, {"pixel_values": tensor})
        elapsed = (time.perf_counter()-started)*1000
        if not np.isfinite(logits).all() or not np.isfinite(boxes).all():
            raise RuntimeError("Nonfinite model output")
        detections, diagnostics = postprocess(logits, boxes, width, height)
        rows.append({"id": image["id"], "file": image["file_name"], "bucket": image["bucket"], "imageSHA256": sha(image_path), "inferenceMsExploratory": elapsed, "detections": detections, "postprocessDiagnostics": diagnostics})
        if (index+1) % 10 == 0:
            print(variant, index+1, "/", len(images), flush=True)
    return {"modelFile": VARIANTS[variant], "bytes": path.stat().st_size, "sha256": sha(path), "loadMsExploratory": load_ms, "rows": rows}


def dev():
    protocol = read("protocol.json")
    assert protocol["development"]["sha256"] == sha(OLD / "protocol.json")
    images = json.loads((OLD / "protocol.json").read_text())["images"]
    report = {"protocolSHA256": sha(ROOT / "protocol.json"), "runtime": {"python": platform.python_version(), "onnxruntime": ort.__version__, "numpy": np.__version__, "threads": 1}, "variants": {}}
    for variant in VARIANTS:
        try:
            result = run_variant(variant, images, OLD / "images")
            result["grid"] = {cls: [score_summary(images, result["rows"], cls, threshold) for threshold in GRID] for cls in matching.CATEGORY}
            report["variants"][variant] = result
            print(variant, "score.5", json.dumps({cls: score_summary(images, result["rows"], cls, .5) for cls in matching.CATEGORY}), flush=True)
        except Exception as exc:
            report["variants"][variant] = {"error": str(exc), "traceback": traceback.format_exc(), "sha256": sha(ROOT / VARIANTS[variant])}
            print(variant, "ERROR", str(exc), flush=True)
        write("development-results.json", report)


def select():
    if (ROOT / "selection.json").exists():
        raise RuntimeError("Selection exists, refusing refit")
    report = read("development-results.json")
    assert report["protocolSHA256"] == sha(ROOT / "protocol.json")
    selection = {"createdBeforeConfirmationExecution": True, "createdUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "developmentResultsSHA256": sha(ROOT / "development-results.json"), "protocolSHA256": report["protocolSHA256"], "developmentCandidates": {}, "selected": None}
    for target in (.9, .85):
        candidates = {}
        for variant, model in report["variants"].items():
            if "error" in model:
                continue
            classes = {}
            for cls, grade in model["grid"].items():
                valid = [item for item in grade if item["precision"] >= target and item["predictions"] >= 5]
                classes[cls] = max(valid, key=lambda item: (item["recall"], item["precision"], -item["threshold"])) if valid else None
            candidates[variant] = {"target": target, "classes": classes, "eligible": all(classes.values()), "bytes": model["bytes"]}
            if all(classes.values()):
                candidates[variant]["macroRecall"] = np.mean([item["recall"] for item in classes.values()]).item()
                candidates[variant]["macroPrecision"] = np.mean([item["precision"] for item in classes.values()]).item()
        selection["developmentCandidates"][str(target)] = candidates
        valid = [(variant, data) for variant, data in candidates.items() if data["eligible"]]
        if valid:
            variant, data = max(valid, key=lambda pair: (pair[1]["macroRecall"], pair[1]["macroPrecision"], -pair[1]["bytes"]))
            selection["selected"] = {"variant": variant, "thresholds": {cls: item["threshold"] for cls, item in data["classes"].items()}, "developmentSummary": data, "sha256": report["variants"][variant]["sha256"]}
            break
    write("selection.json", selection)
    print("Frozen selection", json.dumps(selection["selected"]), flush=True)


def confirm():
    selection = read("selection.json")
    assert selection["developmentResultsSHA256"] == sha(ROOT / "development-results.json")
    assert selection["protocolSHA256"] == sha(ROOT / "protocol.json")
    if selection["selected"] is None:
        print("No development-eligible model; confirmation not used to rescue selection", flush=True)
        return
    images = json.loads((OLD / "confirmation-protocol.json").read_text())["images"]
    chosen = selection["selected"]
    assert chosen["sha256"] == sha(ROOT / VARIANTS[chosen["variant"]])
    result = run_variant(chosen["variant"], images, OLD / "confirmation-images")
    result["selectionSHA256"] = sha(ROOT / "selection.json")
    result["thresholds"] = chosen["thresholds"]
    result["summary"] = {cls: score_summary(images, result["rows"], cls, threshold) for cls, threshold in chosen["thresholds"].items()}
    result["scores"] = [{"id": image["id"], "score": {cls: matching.evaluate(image, row["detections"], threshold)[cls] for cls, threshold in chosen["thresholds"].items()}} for image, row in zip(images, result["rows"])]
    write("confirmation-results.json", result)
    print("Confirmation", json.dumps(result["summary"]), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=["prepare", "dev", "select", "confirm"])
    args = parser.parse_args()
    {"prepare": prepare, "dev": dev, "select": select, "confirm": confirm}[args.stage]()
