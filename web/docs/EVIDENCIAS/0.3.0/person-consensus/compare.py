"""Frozen focused person consensus on30 new public COCO images; artifact only."""

import collections
import hashlib
import json
import platform
import re
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / "detector-upgrade"
PROJECT = ROOT.parents[1]
sys.path.insert(0, str(OLD))
import benchmark as matching
sys.path.insert(0, str(ROOT.parent / "consensus-upgrade"))
import explore as fixed_consensus

STRATA = ["bed-without-person", "chair-without-person-or-bed", "person-with-chair-or-bed", "person-without-chair-or-bed", "neither-target"]
HEADS = {"nano": PROJECT / "public/models/yolox-nano.onnx", "tiny": OLD / "yolox_tiny.onnx", "s": OLD / "yolox_s.onnx"}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(name, obj):
    (ROOT / name).write_text(json.dumps(obj, indent=2), encoding="utf-8")


def bucket(categories):
    person, chair, bed = (category in categories for category in (1, 62, 65))
    return STRATA[0] if bed and not person else STRATA[1] if chair and not person and not bed else STRATA[2] if person and (chair or bed) else STRATA[3] if person else STRATA[4]


def prepare():
    if (ROOT / "protocol.json").exists():
        raise RuntimeError("Protocol exists; refusing overwrite")
    raw = json.loads((OLD / "instances_val2017.json").read_text())
    grouped = collections.defaultdict(list)
    for ann in raw["annotations"]:
        grouped[ann["image_id"]].append({key: ann[key] for key in ("id", "category_id", "bbox", "area", "iscrowd")})
    pools = collections.defaultdict(list)
    for original in raw["images"]:
        image = dict(original)
        image["anns"] = grouped[image["id"]]
        image["bucket"] = bucket({ann["category_id"] for ann in image["anns"]})
        image["order"] = hashlib.sha256(f"visiora-object-eval-v1:{image['id']}".encode()).hexdigest()
        pools[image["bucket"]].append(image)
    old_dev = json.loads((OLD / "protocol.json").read_text())["images"]
    old_confirmation = json.loads((OLD / "confirmation-protocol.json").read_text())["images"]
    selected = []
    for name in STRATA:
        ordered = sorted(pools[name], key=lambda image: image["order"])
        assert [image["id"] for image in old_dev if image["bucket"] == name] == [image["id"] for image in ordered[:12]]
        assert [image["id"] for image in old_confirmation if image["bucket"] == name] == [image["id"] for image in ordered[12:18]]
        selected.extend(ordered[18:24])
    previous = {image["id"] for image in old_dev+old_confirmation}
    assert len(selected) == 30 and not previous.intersection(image["id"] for image in selected)
    source = (PROJECT / "src/vision/yolox.ts").read_text(encoding="utf-8")
    block = source.split("export const COCO_KEYS: (string | null)[] = [", 1)[1].split("];", 1)[0]
    labels = [text if not null else None for text, null in re.findall(r"'([^']*)'|\b(null)\b", block)]
    assert len(labels) == 80 and [index for index, cls in enumerate(labels) if cls is not None] == matching.MAPPED
    assert [labels[index] for index in (0, 56, 59)] == ["person", "chair", "bed"]
    protocol = {
        "version": "visiora-person-consensus-new30-v1",
        "createdBeforeNewPredictions": True,
        "createdUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "selection": "Positions19..24 per same five annotation strata, same SHA256(visiora-object-eval-v1:+numeric image id) ordering. Prior60+30 selections exactly asserted; no ID overlap.",
        "annotationSHA256": sha(OLD / "instances_val2017.json"),
        "images": selected,
        "licenses": raw["licenses"],
        "productClassMapping": labels,
        "productMappingSourceSHA256": sha(PROJECT / "src/vision/yolox.ts"),
        "headModels": {name: {"bytes": path.stat().st_size, "sha256": sha(path)} for name, path in HEADS.items()},
        "preprocessing": "Per-head correct spatial input: Nano416,Tiny416,S640; BGR float32 raw0..255, top-left letterbox114, floor resized dimensions, OpenCV INTER_LINEAR native; browser product-style canvas bilinear is measured separately, not claimed identical to OpenCV.",
        "headPostprocessing": "Decode official raw grid exactly once; argmax80 classes per anchor; objectness*class score>=.45, only existing product mapped classes; per-class NMS IoU>.45. Save ALL mapped detections before any max30; no target-only truncation.",
        "baseline": "All mapped Nano detections score>=.50, existing per-class NMS.45, score descending/max30global; evaluate targets only after this cap.",
        "personConsensus": "Only labelperson uses fixed previous complete-link2of3 rule: eachheadscore>=.45; one candidate/head/cluster; pairwiseIoU>=.50; unweighted box/score mean; same-class NMS>.45. Require fusedscore>=.50. May add person if Nano missed it. No scene/photo rule.",
        "composition": "Nano mapped non-person score>=.50 PLUS consensus person fusedscore>=.50; score descending, per-class NMS>.45, max30global; only after global cap evaluate person/chair/bed. Other labels retain Nano score/class/box; final cap may change which objects survive, and this is measured.",
        "fixedConsensusSourceSHA256": sha(ROOT.parent / "consensus-upgrade/explore.py"),
        "gate": "Person precision>=Nano, personFP<Nano, personTP>=Nano; chair and bed TP>=Nano and FP<=Nano (therefore recall and precision not worse on same GT). Additionally all measured warm browser full-frame durations<=3000ms. No threshold/grid adjustment permitted. If baseline personFP=0, strict FP reduction cannot be demonstrated and gate fails.",
        "matching": "Existing greedy descending score IoU>=.5 to unused non-crowd GT; otherwise crowd ignore via intersection/detection-area>=.5. All sizes; no annotation relabeling.",
        "browserProtocol": "Load all3sessions WASM1thread. Warm each once on first selected public image. Then3full frames on first3selectedimages: per-head actual resize/pack, sequential3inferences, full-mapped decode/NMS, focused fusion/globalcap. Measure resize through final pipeline result; JPEG decode/model loading excluded; no live camera or voice. Reject adoption if any measured warm frame>3000ms; no uncontrolled old-time sum.",
        "limitations": ["Small stratified COCO val2017 sample, model-known validation data; not COCO mAP or independent Brazilian camera validation.", "Per-class specialist channel is explicitly a detector policy, not a rule inferring rooms from objects.", "Three correlated models can agree on a false person.", "Browser fixture timing is not real camera/endurance/phone performance.", "All artifacts local, no private image, product code, Git or Sites mutation."],
    }
    write("protocol.json", protocol)
    print(json.dumps({"protocolSHA256": sha(ROOT / "protocol.json"), "ids": [image["id"] for image in selected]}, indent=2))


def head_postprocess(output, size, width, height, ratio, labels):
    grids, strides = [], []
    for stride in (8, 16, 32):
        yy, xx = np.meshgrid(np.arange(size // stride), np.arange(size // stride), indexing="ij")
        grids.append(np.stack([xx, yy], axis=-1).reshape(-1, 2))
        strides.append(np.full(((size // stride) ** 2, 1), stride))
    grid, stride = np.concatenate(grids), np.concatenate(strides)
    prediction = output[0]
    centers = (prediction[:, :2]+grid)*stride
    dims = np.exp(prediction[:, 2:4])*stride
    boxes = np.concatenate([centers-dims/2, centers+dims/2], axis=1)/ratio
    boxes[:, [0, 2]] = np.clip(boxes[:, [0, 2]], 0, width)
    boxes[:, [1, 3]] = np.clip(boxes[:, [1, 3]], 0, height)
    classes = np.argmax(prediction[:, 5:], axis=1)
    scores = prediction[:, 4]*np.max(prediction[:, 5:], axis=1)
    indices = np.flatnonzero((scores >= .45) & np.isin(classes, matching.MAPPED))
    indices = indices[np.argsort(-scores[indices], kind="stable")]
    kept = []
    for index in indices:
        same = [prior for prior in kept if classes[index] == classes[prior]]
        if same and np.any(matching.iou(boxes[index], boxes[same]) > .45):
            continue
        if not np.isfinite(boxes[index]).all() or boxes[index, 2] <= boxes[index, 0] or boxes[index, 3] <= boxes[index, 1]:
            continue
        kept.append(index)
    return [{"class": labels[int(classes[index])], "classId": int(classes[index]), "score": float(scores[index]), "box": boxes[index].tolist(), "anchorIndex": int(index)} for index in kept]


def global_cap(candidates):
    # Stable order preserves the Nano baseline's score tie behavior.
    candidates = sorted(candidates, key=lambda det: -det["score"])
    kept = []
    for candidate in candidates:
        if any(prior["class"] == candidate["class"] and matching.iou(np.array(candidate["box"]), np.array([prior["box"]]))[0] > .45 for prior in kept):
            continue
        kept.append(candidate)
        if len(kept) == 30:
            break
    return kept


def compose(by_head):
    nano = [det for det in by_head["nano"] if det["score"] >= .5]
    baseline = global_cap(nano)
    # Fixed consensus helper receives only persons; no other class-specific change.
    persons = fixed_consensus.consensus({head: [det for det in detections if det["class"] == "person"] for head, detections in by_head.items()})
    persons = [det for det in persons if det["score"] >= .5]
    merged = global_cap([det for det in nano if det["class"] != "person"]+persons)
    return baseline, merged, persons


def summary(images, rows, key):
    evaluated = [matching.evaluate(image, row[key], 0) for image, row in zip(images, rows)]
    result = {}
    for cls in matching.CATEGORY:
        entries = [item[cls] for item in evaluated]
        counts = {field: sum(entry[field] for entry in entries) for field in ("tp", "fp", "fn", "gt")}
        counts["precision"] = counts["tp"] / max(1, counts["tp"]+counts["fp"])
        counts["recall"] = counts["tp"] / max(1, counts["gt"])
        counts["ignoredCrowd"] = sum(len(item["ignoredCrowd"]) for item in entries)
        counts["negativeImages"] = sum(item["gt"] == 0 for item in entries)
        counts["negativeImagesWithFalseDetection"] = sum(item["gt"] == 0 and item["fp"] > 0 for item in entries)
        result[cls] = counts
    return result, [{"id": image["id"], "score": score} for image, score in zip(images, evaluated)]


def main():
    protocol = json.loads((ROOT / "protocol.json").read_text())
    assert protocol["annotationSHA256"] == sha(OLD / "instances_val2017.json")
    labels = protocol["productClassMapping"]
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    sessions = {}
    for head, path in HEADS.items():
        assert sha(path) == protocol["headModels"][head]["sha256"]
        sessions[head] = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
    rows = []
    for index, image in enumerate(protocol["images"]):
        image_path = ROOT / "images" / image["file_name"]
        bgr = cv2.imread(str(image_path))
        height, width = bgr.shape[:2]
        assert (height, width) == (image["height"], image["width"])
        by_head, timings = {}, {}
        for head, session in sessions.items():
            size = session.get_inputs()[0].shape[-1]
            ratio = min(size/height, size/width)
            resized = cv2.resize(bgr, (int(width*ratio), int(height*ratio)), interpolation=cv2.INTER_LINEAR)
            padded = np.full((size, size, 3), 114, dtype=np.uint8)
            padded[:resized.shape[0], :resized.shape[1]] = resized
            tensor = np.ascontiguousarray(padded.transpose(2, 0, 1), dtype=np.float32)[None]
            begin = time.perf_counter()
            output = session.run(None, {session.get_inputs()[0].name: tensor})[0]
            timings[head] = (time.perf_counter()-begin)*1000
            by_head[head] = head_postprocess(output, size, width, height, ratio, labels)
        baseline, pipeline, persons = compose(by_head)
        rows.append({"id": image["id"], "file": image["file_name"], "bucket": image["bucket"], "imageSHA256": sha(image_path), "allMappedBeforeCap": by_head, "nanoBaseline": baseline, "pipeline": pipeline, "personConsensusBeforeFinalGlobalCap": persons, "nativeInferenceMsExploratory": timings})
        if (index+1) % 5 == 0:
            print(index+1, "/30", flush=True)
    nano, nano_scores = summary(protocol["images"], rows, "nanoBaseline")
    pipeline, pipeline_scores = summary(protocol["images"], rows, "pipeline")
    person = pipeline["person"]
    base = nano["person"]
    gate = person["precision"] >= base["precision"] and person["fp"] < base["fp"] and person["tp"] >= base["tp"] and all(pipeline[cls]["tp"] >= nano[cls]["tp"] and pipeline[cls]["fp"] <= nano[cls]["fp"] for cls in ("chair", "bed"))
    report = {"protocolSHA256": sha(ROOT / "protocol.json"), "runtime": {"python": platform.python_version(), "onnxruntime": ort.__version__, "numpy": np.__version__, "opencv": cv2.__version__, "threads": 1}, "nanoBaseline": nano, "pipeline": pipeline, "qualityGatePassed": gate, "latencyGateNotYetEvaluated": True, "rows": rows, "nanoScores": nano_scores, "pipelineScores": pipeline_scores}
    write("results.json", report)
    print(json.dumps({"nano": nano, "pipeline": pipeline, "qualityGatePassed": gate}), flush=True)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "prepare":
        prepare()
    else:
        main()
