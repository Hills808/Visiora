"""Fixed two-of-three YOLOX consensus; exploratory archived public outputs only."""

import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / "detector-upgrade"
sys.path.insert(0, str(OLD))
import benchmark as matching

HEADS = ["nano", "tiny", "s"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(name, data):
    (ROOT / name).write_text(json.dumps(data, indent=2), encoding="utf-8")


def consensus(per_head):
    candidates = []
    for head in HEADS:
        for index, det in enumerate(per_head[head]):
            if det["score"] >= .45:
                candidates.append({**det, "head": head, "sourceIndex": index})
    candidates.sort(key=lambda det: (-det["score"], det["head"], det["sourceIndex"]))
    assigned, clusters = set(), []
    for seed_index, seed in enumerate(candidates):
        if seed_index in assigned:
            continue
        members, member_indices = [seed], [seed_index]
        heads = {seed["head"]}
        for index, candidate in enumerate(candidates):
            if index == seed_index or index in assigned or candidate["head"] in heads or candidate["class"] != seed["class"]:
                continue
            # Pairwise agreement prevents joining objects by a loose overlap chain.
            if all(matching.iou(np.array(candidate["box"]), np.array([member["box"]]))[0] >= .5 for member in members):
                members.append(candidate)
                member_indices.append(index)
                heads.add(candidate["head"])
        if len(heads) < 2:
            continue
        assigned.update(member_indices)
        clusters.append({"class": seed["class"], "box": np.mean([member["box"] for member in members], axis=0).tolist(), "score": float(np.mean([member["score"] for member in members])), "votes": len(heads), "members": members})
    clusters.sort(key=lambda det: (-det["score"], det["class"], tuple(det["box"])))
    kept = []
    for candidate in clusters:
        if any(prior["class"] == candidate["class"] and matching.iou(np.array(candidate["box"]), np.array([prior["box"]]))[0] > .45 for prior in kept):
            continue
        kept.append(candidate)
        if len(kept) == 30:
            break
    return kept


def summarize(images, rows, threshold):
    scores = [matching.evaluate(image, row["detections"], threshold) for image, row in zip(images, rows)]
    summary = {}
    for cls in matching.CATEGORY:
        selected = [row[cls] for row in scores]
        counts = {key: sum(row[key] for row in selected) for key in ("tp", "fp", "fn", "gt")}
        counts["precision"] = counts["tp"] / max(1, counts["tp"]+counts["fp"])
        counts["recall"] = counts["tp"] / max(1, counts["gt"])
        counts["ignoredCrowd"] = sum(len(row["ignoredCrowd"]) for row in selected)
        counts["negativeImages"] = sum(row["gt"] == 0 for row in selected)
        counts["negativeImagesWithFalseDetection"] = sum(row["gt"] == 0 and row["fp"] > 0 for row in selected)
        summary[cls] = counts
    return summary, [{"id": image["id"], "score": score} for image, score in zip(images, scores)]


def prepare():
    if (ROOT / "protocol.json").exists():
        raise RuntimeError("Protocol already frozen; refusing overwrite")
    write("protocol.json", {
        "version": "visiora-fixed-two-of-three-consensus-v1",
        "createdBeforeConsensusProcessing": True,
        "createdUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "heads": HEADS,
        "scoreMinEachHead": .45,
        "sameClassMatchingIoUMin": .5,
        "votesMinDistinctHeads": 2,
        "boxAndScoreFusion": "Unweighted arithmetic mean of members; at most one prediction per head per cluster",
        "association": "Pool candidates score-descending, tie head name/source index. For each unassigned seed, scan pool in same order, add one candidate from unused head only if same class and IoU>=.5 to EVERY current member (complete-link). Accepted clusters assign all members; isolated candidates do not consume other candidates. No class-specific or photo-specific rule.",
        "finalNMS": "Clusters descending fused score, same-class IoU>.45 suppression; max30 global among archived three targets",
        "extraFusedScoreThreshold": None,
        "baseline": "Nano product score>=.50, same archived detections, same evaluator",
        "sources": {name: sha(OLD / name) for name in ("protocol.json", "results.json", "confirmation-protocol.json", "confirmation-results.json")},
        "matching": "Existing greedy IoU>=.5 normal GT then crowdIoA>=.5; all sizes; no relabeling",
        "exploratoryOnly": "Both old60 development and prior30 confirmation are exploratory for this new consensus because already inspected. No new thresholds or grades.",
        "gateForNew30": "Conservative operational promising check: precision AND recall not lower than Nano.50 for each of three classes in BOTH exploratory partitions, with at least one strict gain overall. If fails, stop without downloading next30. This is not significance or validated superiority.",
        "limitations": ["Archived head detections contain only person/chair/bed after the original global mapped-class cap30 per head.", "Consensus cap30 is among retained three targets, and does not reproduce competition from all80 classes in a generic product implementation; results cannot establish all-class consensus quality.", "Original classes, model bytes, annotations and scores remain unchanged.", "Shared model errors may agree; consensus does not guarantee correctness.", "No private image, product change, paid API, or new model inference.", "No new latency/memory/endurance measurement; three-head inference would add computation."],
    })
    print("Frozen", sha(ROOT / "protocol.json"), flush=True)


def explore():
    if not (ROOT / "protocol.json").exists():
        raise RuntimeError("Prepare/freeze protocol first")
    protocol = json.loads((ROOT / "protocol.json").read_text())
    for name, digest in protocol["sources"].items():
        assert digest == sha(OLD / name)
    report = {"protocolSHA256": sha(ROOT / "protocol.json"), "partitions": {}, "new30PermittedByFrozenGate": False}
    for partition, protocol_file, raw_file in [("development60-exploratory", "protocol.json", "results.json"), ("priorConfirmation30-exploratory", "confirmation-protocol.json", "confirmation-results.json")]:
        images = json.loads((OLD / protocol_file).read_text())["images"]
        raw = json.loads((OLD / raw_file).read_text())["models"]
        by_head = {head: {row["id"]: row for row in raw[head]["rows"]} for head in HEADS}
        rows = [{"id": image["id"], "detections": consensus({head: by_head[head][image["id"]]["detections"] for head in HEADS})} for image in images]
        summary, scores = summarize(images, rows, 0)
        baseline_rows = [by_head["nano"][image["id"]] for image in images]
        baseline, baseline_scores = summarize(images, baseline_rows, .5)
        promising = all(summary[cls][metric] >= baseline[cls][metric] for cls in matching.CATEGORY for metric in ("precision", "recall"))
        strict_gain = any(summary[cls][metric] > baseline[cls][metric] for cls in matching.CATEGORY for metric in ("precision", "recall"))
        report["partitions"][partition] = {"imageCount": len(images), "summary": summary, "nanoBaseline": baseline, "notWorseAllClassPrecisionRecall": promising, "anyStrictGain": strict_gain, "rows": rows, "scores": scores, "nanoScores": baseline_scores}
        print(partition, json.dumps({"consensus": summary, "nano": baseline, "gatePartitionPassed": promising}), flush=True)
    report["new30PermittedByFrozenGate"] = all(part["notWorseAllClassPrecisionRecall"] for part in report["partitions"].values()) and any(part["anyStrictGain"] for part in report["partitions"].values())
    write("exploratory-results.json", report)
    print("Frozen gate for new30", report["new30PermittedByFrozenGate"], flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("prepare", "explore"):
        raise RuntimeError("Use prepare, then explore")
    {"prepare": prepare, "explore": explore}[sys.argv[1]]()
