"""Requested supplemental dev-only policies; never changes primary selection."""

import json
import time
from pathlib import Path

import compare

ROOT = Path(__file__).resolve().parent
if (ROOT / "conservative-development.json").exists():
    raise RuntimeError("Supplemental policy freeze already exists")
dev = compare.read("development-results.json")
images = json.loads((compare.OLD / "protocol.json").read_text())["images"]
nano = json.loads((compare.OLD / "results.json").read_text())["models"]["nano"]
baseline = {cls: compare.score_summary(images, nano["rows"], cls, .5) for cls in compare.matching.CATEGORY}
report = {
    "purpose": "Additional development-only comparison requested after primary selection and confirmation inference had already been launched; confirmation results not read by this script. Does not modify selection or primary confirmation policy.",
    "createdUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "primarySelectionSHA256": compare.sha(ROOT / "selection.json"),
    "developmentResultsSHA256": compare.sha(ROOT / "development-results.json"),
    "nanoBaselineScore0.50": baseline,
    "rules": {
        "target95": "Precision>=.95 and TP+FP>=5; maximize recall then precision then lower threshold; same frozen .45-.90 grade.",
        "atMostNanoFalsePositives": "FP count<=Nano .50 FP count on same60dev and TP+FP>=5; maximize recall then precision then lower threshold. Absolute FP budget is not same as precision and may still lower precision.",
        "atLeastNanoPrecision": "Precision>=Nano .50 precision on same60dev and TP+FP>=5; maximize recall then precision then lower threshold.",
    },
    "variants": {},
    "confirmationUsedForSelection": False,
    "limitations": ["Supplemental request arrived after primary selection and confirmation inference launch, so not part of original pre-inference protocol.", "Development only: not confirmation or generalization evidence.", "No thresholds outside original grade and no new models.", "Primary selection and confirmation remain unchanged."],
}
for variant, model in dev["variants"].items():
    if "error" in model:
        continue
    policies = {}
    for policy in report["rules"]:
        classes = {}
        for cls, grade in model["grid"].items():
            valid = [row for row in grade if row["predictions"] >= 5 and (
                row["precision"] >= .95 if policy == "target95" else
                row["fp"] <= baseline[cls]["fp"] if policy == "atMostNanoFalsePositives" else
                row["precision"] >= baseline[cls]["precision"])]
            classes[cls] = max(valid, key=lambda row: (row["recall"], row["precision"], -row["threshold"])) if valid else None
        policies[policy] = classes
    report["variants"][variant] = policies
compare.write("conservative-development.json", report)
print(json.dumps({"nanoBaseline": baseline, "variants": report["variants"]}, indent=2))
