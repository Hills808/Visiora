"""Precision-variant research only; no private images or product changes."""
from __future__ import annotations

import gc
import hashlib
import io
import json
import time
import zipfile
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/scene-upgrade"
DATA = ROOT / "artifacts/scene"
MODEL_PATHS = {
    "q4": DATA / "siglip/onnx/vision_model_q4.onnx",
    "fp16": OUT / "vision_model_fp16.onnx",
    "f32": OUT / "vision_model.onnx",
}
MINIMUMS = [.12, .14, .16, .18, .20, .22, .24, .26, .28]
MARGINS = [.005, .01, .015, .02, .025, .03, .04]
GROUPS = {
    "bedroom": ["bedroom", "bedchamber", "childs_room", "dorm_room", "hotel_room", "nursery"],
    "classroom": ["classroom", "kindergarden_classroom", "lecture_room"],
    "office": ["office", "home_office", "office_cubicles"],
    "kitchen": ["kitchen", "restaurant_kitchen", "galley"],
    "restaurant": ["restaurant", "restaurant_patio", "fastfood_restaurant"],
}
ALIASES = {name: category for category, names in GROUPS.items() for name in names}


def family(name: str) -> str:
    name = {"children_room": "childs_room", "kindergarten": "kindergarden_classroom"}.get(name, name)
    return ALIASES.get(name, name)


def summarize(records: list[dict], minimum: float, margin: float, coarse=False) -> dict:
    accepted = [r for r in records if not r["reject"] and r["score"] >= minimum and r["margin"] >= margin]
    correct = sum((family(r["category"]) if coarse else r["category"]) == r["expected"] for r in accepted)
    return {
        "samples": len(records),
        "raw_top1_correct": sum((family(r["category"]) if coarse else r["category"]) == r["expected"] for r in records),
        "accepted": len(accepted),
        "correct": correct,
        "wrong": len(accepted)-correct,
        "abstained": len(records)-len(accepted),
        "coverage": len(accepted)/max(1,len(records)),
        "precision_when_accepted": correct/len(accepted) if accepted else None,
    }


def session(model: str):
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 4
    if model == "fp16":
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    started = time.perf_counter()
    engine = ort.InferenceSession(str(MODEL_PATHS[model]), opts, providers=["CPUExecutionProvider"])
    return engine, (time.perf_counter()-started)*1000


def infer(engine, samples, archives, candidates, embeddings):
    records = []
    input_type = engine.get_inputs()[0].type
    dtype = np.float16 if input_type == "tensor(float16)" else np.float32
    for sample in samples:
        encoded = archives[sample["source_archive"]].read(sample["source_file"])
        assert hashlib.sha256(encoded).hexdigest() == sample["sha256"]
        image = Image.open(io.BytesIO(encoded)).convert("RGB")
        pixels = np.asarray(image.resize((224,224),Image.Resampling.BILINEAR),dtype=np.float32)
        tensor = ((pixels/127.5-1).transpose(2,0,1)[None]).astype(dtype,copy=True)
        started = time.perf_counter()
        feature = engine.run(["pooler_output"],{engine.get_inputs()[0].name:tensor})[0][0].astype(np.float32)
        elapsed = (time.perf_counter()-started)*1000
        assert np.isfinite(feature).all()
        feature /= np.linalg.norm(feature)
        scores = embeddings @ feature
        rank = np.argsort(scores)[::-1]
        top = int(rank[0])
        records.append({
            **sample,
            "category": candidates[top]["id"],
            "reject": candidates[top]["reject"],
            "score": float(scores[top]),
            "margin": float(scores[top]-scores[rank[1]]),
            "runner": candidates[int(rank[1])]["id"],
            "inference_ms": elapsed,
            "top5": [{"category":candidates[int(i)]["id"],"score":float(scores[int(i)])} for i in rank[:5]],
        })
    return records


def write(name, data):
    (OUT/name).write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")


def main():
    selection_path = ROOT / "artifacts/recognition-upgrade/places-selection.json"
    selection = json.loads(selection_path.read_text("utf-8"))
    development = [s for s in selection if s["split"] == "development"]
    confirmation = [s for s in selection if s["split"] == "confirmation"]
    assert len(development)==96 and len(confirmation)==40
    embedding_path = ROOT/"public/models/siglip2/embeddings.json"
    candidates = json.loads(embedding_path.read_text("utf-8"))["candidates"]
    embeddings = np.array([r["vector"] for r in candidates],dtype=np.float32)
    protocol = {
        "input_selection_sha256": hashlib.sha256(selection_path.read_bytes()).hexdigest(),
        "embedding_sha256": hashlib.sha256(embedding_path.read_bytes()).hexdigest(),
        "text_encoder": "Existing frozen q4 text embeddings, 88 candidates, unchanged",
        "model_repository": "onnx-community/siglip2-base-patch16-224-ONNX",
        "model_revision": "ba1f3b0843f24bc5417d38e19c37b287d719b2f4",
        "license": "Original Google model Apache-2.0; ONNX repository links to original and has no separate license field",
        "preprocessing": "Whole RGB image warped to 224x224, PIL bilinear, x/127.5-1, CHW; unchanged",
        "minimums": MINIMUMS,
        "margins": MARGINS,
        "selection_policy": "Strict labels: >=90% development precision among >=10 accepted. Within each variant maximize correct accepted, precision, stricter margin, stricter minimum. Across variants maximize correct accepted, precision, then smaller bytes. Freeze chosen variant and thresholds before running any confirmation input.",
        "development_scope": "96 public images indices0..11, includes previous research test photos; not independent validation",
        "confirmation_scope": "40 next original-photo-hash samples indices12..16, never used for this selection",
        "coarse_families": GROUPS,
        "coarse_policy": "Families only reported separately, never used to select model, thresholds, or modify ranking margin",
        "runtime": ort.__version__,"provider":"CPUExecutionProvider","threads":4,
        "fp16_optimization": "Basic graph optimization: default optimization failed on ORT1.23.2 with a SimplifiedLayerNormFusion cast-reference initialization error; recorded in precision-run-initial-error.log before any successful prediction",
    }
    write("protocol.json",protocol)
    archives = {name:zipfile.ZipFile(DATA/f"{name}.zip") for name in ["train","valid","test"]}
    reports = {}
    choices = []
    for model,path in MODEL_PATHS.items():
        try:
            engine,load_ms = session(model)
            rows = infer(engine,development,archives,candidates,embeddings)
            times = [r["inference_ms"] for r in rows]
            grid = [{"minimum":minimum,"margin":margin,**summarize(rows,minimum,margin)} for minimum in MINIMUMS for margin in MARGINS]
            eligible = [c for c in grid if c["accepted"]>=10 and c["precision_when_accepted"]>=.90]
            chosen = max(eligible,key=lambda c:(c["correct"],c["precision_when_accepted"],c["margin"],c["minimum"])) if eligible else None
            if chosen:choices.append({"model":model,"bytes":path.stat().st_size,**chosen})
            reports[model] = {"bytes":path.stat().st_size,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"input_type":engine.get_inputs()[0].type,"load_ms":load_ms,"development_records":rows,"development_grid":grid,"chosen_thresholds":chosen,"shipped_thresholds_summary":summarize(rows,.12,.03),"latency_ms":{"p50":float(np.percentile(times,50)),"p95":float(np.percentile(times,95))},"chosen_coarse_summary":summarize(rows,chosen["minimum"],chosen["margin"],True) if chosen else None}
            del engine
            gc.collect()
            print(json.dumps({"model":model,"chosen":chosen,"shipped":reports[model]["shipped_thresholds_summary"],"latency_ms":reports[model]["latency_ms"]}),flush=True)
        except Exception as error:
            reports[model] = {"error":f"{type(error).__name__}: {error}"}
            print(json.dumps({"model":model,"error":reports[model]["error"]}),flush=True)
        write("development.json",reports)
    chosen = max(choices,key=lambda c:(c["correct"],c["precision_when_accepted"],-c["bytes"])) if choices else None
    frozen = {"protocol_sha256":hashlib.sha256((OUT/"protocol.json").read_bytes()).hexdigest(),"chosen":chosen,"at_unix":time.time(),"confirmation_evaluated":False}
    write("frozen-choice.json",frozen)
    print(json.dumps({"frozen_before_confirmation":chosen}),flush=True)
    confirmation_reports = {}
    models = list(dict.fromkeys(["q4"]+([chosen["model"]] if chosen else [])))
    for model in models:
        engine,load_ms = session(model)
        rows = infer(engine,confirmation,archives,candidates,embeddings)
        minimum,margin = (chosen["minimum"],chosen["margin"]) if chosen and model == chosen["model"] else (.12,.03)
        timing = [r["inference_ms"] for r in rows]
        confirmation_reports[model] = {"thresholds":{"minimum":minimum,"margin":margin},"strict":summarize(rows,minimum,margin),"coarse":summarize(rows,minimum,margin,True),"shipped_thresholds_strict":summarize(rows,.12,.03),"records":rows,"latency_ms":{"p50":float(np.percentile(timing,50)),"p95":float(np.percentile(timing,95))},"load_ms":load_ms}
        print(json.dumps({"confirmation_model":model,"strict":confirmation_reports[model]["strict"],"coarse":confirmation_reports[model]["coarse"]}),flush=True)
        del engine
        gc.collect()
        write("confirmation.json",confirmation_reports)
    for archive in archives.values():archive.close()
    write("comparison.json",{"protocol":protocol,"frozen_choice":frozen,"development":reports,"confirmation":confirmation_reports,"limits":"Small public source sample with uncertain annotations and unknown pretraining overlap; no private images, no Brazilian scenes, no user validation. Classification latency excludes camera, speech and network."})


if __name__ == "__main__":
    main()
