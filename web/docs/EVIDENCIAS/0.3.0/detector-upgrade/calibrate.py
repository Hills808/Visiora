"""Development-only calibration; fixed grade requested before executing it.

Reuses frozen >=.45 raw detections. Does not fit to private user photographs.
Crowd accounting is corrected to COCO intersection-over-detection-area >=.5.
"""
import hashlib
import json
from pathlib import Path
import benchmark as bench

ROOT = Path(__file__).resolve().parent
GRID = [.45, .5, .55, .6, .65, .7, .75, .8, .85, .9]
MIN_PREDICTIONS = 5


def summarize(rows, images, cls, threshold):
    evaluated = [bench.evaluate(images[row["id"]], row["detections"], threshold)[cls] for row in rows]
    summary = {key: sum(row[key] for row in evaluated) for key in ("tp", "fp", "fn", "gt")}
    summary["ignoredCrowd"] = sum(len(row["ignoredCrowd"]) for row in evaluated)
    summary["predictions"] = summary["tp"] + summary["fp"]
    summary["precision"] = summary["tp"] / max(1, summary["predictions"])
    summary["recall"] = summary["tp"] / max(1, summary["gt"])
    summary["threshold"] = threshold
    summary["negativeImages"] = sum(row["gt"] == 0 for row in evaluated)
    summary["negativeImagesWithFalseDetection"] = sum(row["gt"] == 0 and row["fp"] > 0 for row in evaluated)
    return summary


def main():
    protocol = json.loads((ROOT/"protocol.json").read_text())
    images = {im["id"]: im for im in protocol["images"]}
    raw = json.loads((ROOT/"results.json").read_text())
    report = {"purpose":"Development calibration only; not confirmation accuracy", "grid":GRID,
              "rawResultsSHA256":hashlib.sha256((ROOT/"results.json").read_bytes()).hexdigest(),
              "minPredictionsForSelection":MIN_PREDICTIONS,
              "selection":"For each model/class and target precision, maximize recall then precision then lower threshold. Require >=5 non-ignored detections; small-sample precision does not establish reliability.",
              "matching":"Greedy descending score, IoU>=.5 with unused non-crowd box; unmatched detection ignored if IoA>=.5 against crowd. All sizes. Not COCO mAP.",
              "models":{}}
    for name, model in raw["models"].items():
        grade = {cls:[summarize(model["rows"],images,cls,t) for t in GRID] for cls in bench.CATEGORY}
        selected = {}
        for target in (.9,.85):
            choices={}
            for cls, candidates in grade.items():
                valid=[item for item in candidates if item["precision"]>=target and item["predictions"]>=MIN_PREDICTIONS]
                choices[cls]=max(valid,key=lambda item:(item["recall"],item["precision"],-item["threshold"])) if valid else None
            selected[str(target)] = choices
        report["models"][name]={"bytes":model["bytes"],"sha256":model["sha256"],"grade":grade,"selected":selected}
    (ROOT/"calibration.json").write_text(json.dumps(report,indent=2))
    print(json.dumps({name:model["selected"] for name,model in report["models"].items()},indent=2))


if __name__=="__main__":
    main()
