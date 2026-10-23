"""Real-weight smoke test on the YOLOX public demo image. Not the Brazilian benchmark."""

from __future__ import annotations

import json
import platform
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TARGET = 416
WARMUP = 5
REPEATS = 20


def main() -> None:
    image = Image.open(ROOT / "artifacts/vision/dog.jpg").convert("RGB")
    width, height = image.size
    ratio = min(TARGET / width, TARGET / height)
    resized = image.resize(
        (int(width * ratio), int(height * ratio)), Image.Resampling.BILINEAR
    )
    pixels = np.full((TARGET, TARGET, 3), 114, dtype=np.float32)
    pixels[: resized.height, : resized.width] = np.asarray(resized)
    tensor = np.ascontiguousarray(pixels[:, :, ::-1].transpose(2, 0, 1)[None]).astype(
        np.float32
    )
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    started = time.perf_counter()
    session = ort.InferenceSession(
        str(ROOT / "public/models/yolox-nano.onnx"),
        options,
        providers=["CPUExecutionProvider"],
    )
    load_ms = (time.perf_counter() - started) * 1000
    input_name = session.get_inputs()[0].name
    for _ in range(WARMUP):
        session.run(None, {input_name: tensor})
    times: list[float] = []
    output = np.array([], dtype=np.float32)
    for _ in range(REPEATS):
        started = time.perf_counter()
        output = session.run(None, {input_name: tensor})[0]
        times.append((time.perf_counter() - started) * 1000)
    output.astype(np.float32).tofile(ROOT / "artifacts/vision/output.bin")
    scores = output[0, :, 4:5] * output[0, :, 5:]
    maxima = scores.max(axis=0)
    classes = [
        {"cocoIndex": int(index), "score": round(float(maxima[index]), 4)}
        for index in np.argsort(maxima)[::-1][:8]
    ]
    result = {
        "scope": "single public YOLOX demo image; no camera; no Brazilian validation",
        "python": platform.python_version(),
        "runtime": ort.__version__,
        "provider": session.get_providers(),
        "input_shape": session.get_inputs()[0].shape,
        "output_shape": list(output.shape),
        "image_size": [width, height],
        "ratio": ratio,
        "warmup": WARMUP,
        "repeats": REPEATS,
        "load_ms": round(load_ms, 2),
        "inference_ms": [round(t, 2) for t in times],
        "p50_inference_ms": round(float(np.median(times)), 2),
        "p95_inference_ms": round(float(np.percentile(times, 95)), 2),
        "top_class_scores": classes,
        "preprocessing": "PIL bilinear BGR raw 0..255; interpolation differs slightly from OpenCV",
    }
    (ROOT / "artifacts/vision/smoke.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
