"""Prepare fixed text embeddings and verified visual-model chunks for local inference."""

from __future__ import annotations

import hashlib
import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts/scene/siglip"
TARGET = ROOT / "public/models/siglip2"
REVISION = "ba1f3b0843f24bc5417d38e19c37b287d719b2f4"
VISION_HASH = "03e61be280fb24114facd87a1e1e6b2b654aad49845686da2f930c72740914aa"
CHUNK_BYTES = 20_000_000  # Below the static hosting per-file limit; weights unchanged.


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", choices=["int8", "q4"], default="q4")
    args = parser.parse_args()
    catalog = json.loads((ROOT / "src/data/scene-catalog.json").read_text("utf-8"))
    tokenizer = Tokenizer.from_file(str(SOURCE / "tokenizer.json"))
    config = json.loads((SOURCE / "tokenizer_config.json").read_text("utf-8"))
    pad_id = tokenizer.token_to_id(config["pad_token"])
    if pad_id is None:
        raise ValueError("Tokenizer has no padding token")
    tokenizer.enable_truncation(max_length=64)
    tokenizer.enable_padding(length=64, pad_id=pad_id, pad_token=config["pad_token"])
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    session = ort.InferenceSession(
        str(SOURCE / f"onnx/text_model_{args.text}.onnx"),
        options,
        providers=["CPUExecutionProvider"],
    )
    vectors = []
    for item in catalog:
        prompts = [
            f"This is a photo of {item['description']}.",
            f"A photo of {item['description']}.",
        ]
        ids = np.array([x.ids for x in tokenizer.encode_batch(prompts)], dtype=np.int64)
        pooled = session.run(["pooler_output"], {"input_ids": ids})[0]
        pooled /= np.linalg.norm(pooled, axis=1, keepdims=True)
        vector = pooled.mean(axis=0)
        vector /= np.linalg.norm(vector)
        vectors.append({**item, "vector": np.round(vector, 8).tolist()})
    TARGET.mkdir(parents=True, exist_ok=True)
    (TARGET / "embeddings.json").write_text(
        json.dumps({"revision": REVISION, "dimensions": 768, "candidates": vectors}),
        "utf-8",
    )
    model = (SOURCE / "onnx/vision_model_q4.onnx").read_bytes()
    if hashlib.sha256(model).hexdigest() != VISION_HASH:
        raise ValueError("Vision checkpoint checksum mismatch")
    chunks = []
    for index, start in enumerate(range(0, len(model), CHUNK_BYTES)):
        part = model[start : start + CHUNK_BYTES]
        filename = f"vision-{index:02d}.bin"
        (TARGET / filename).write_bytes(part)
        chunks.append(
            {
                "path": filename,
                "bytes": len(part),
                "sha256": hashlib.sha256(part).hexdigest(),
            }
        )
    manifest = {
        "model": "SigLIP2 base patch16-224",
        "repository": "onnx-community/siglip2-base-patch16-224-ONNX",
        "revision": REVISION,
        "license": "Apache-2.0",
        "quantization": f"q4 visual encoder; {args.text} text encoder precomputed offline",
        "bytes": len(model),
        "sha256": VISION_HASH,
        "chunks": chunks,
        "output": "pooler_output",
        "embeddings_sha256": hashlib.sha256(
            (TARGET / "embeddings.json").read_bytes()
        ).hexdigest(),
    }
    (TARGET / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", "utf-8"
    )
    for stale in TARGET.glob("vision-*.bin"):
        if stale.name not in {part["path"] for part in chunks}:
            stale.unlink()
    print(
        json.dumps(
            {"candidates": len(vectors), "parts": len(chunks), "bytes": len(model)}
        )
    )


if __name__ == "__main__":
    main()
