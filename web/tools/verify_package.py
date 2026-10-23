"""Inspect a generated ZIP without extracting it; check models and exclude camera/research images."""

from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath


def verify(filename: str) -> dict[str, object]:
    path = Path(filename)
    prefix = "visiora/dist/"
    checks: list[dict[str, object]] = []
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, "ZIP CRC failed"
        names = archive.namelist()
        assert all(
            name.startswith("visiora/")
            and ".." not in PurePosixPath(name).parts
            and "\\" not in name
            for name in names
        ), "Unexpected ZIP path"
        assert not any(
            name.lower().endswith((".jpg", ".jpeg", ".png", ".y4m")) for name in names
        ), "Research/camera image in package"
        assert "visiora/iniciar.cmd" in names
        assert prefix + "vision/worker.js" in names
        assert prefix + "vision/scene-worker.js" in names
        primary = json.loads(archive.read(prefix + "models/manifest.json"))
        data = archive.read(prefix + "models/yolox-nano.onnx")
        assert len(data) == primary["bytes"]
        assert hashlib.sha256(data).hexdigest() == primary["sha256"]
        checks.append({"id": "yolox-nano", "bytes": len(data), "verified": True})
        for model in ["yolox-tiny", "yolox-s", "siglip2", "places365"]:
            base = prefix + "models/" + model + "/"
            manifest = json.loads(archive.read(base + "manifest.json"))
            digest = hashlib.sha256()
            total = 0
            for part in manifest["chunks"]:
                data = archive.read(base + part["path"])
                assert len(data) == part["bytes"]
                assert hashlib.sha256(data).hexdigest() == part["sha256"]
                digest.update(data)
                total += len(data)
            assert total == manifest["bytes"]
            assert digest.hexdigest() == manifest["sha256"]
            for data_path, hash_key in [
                ("embeddings.json", "embeddings_sha256"),
                ("categories.txt", "labels_sha256"),
            ]:
                if hash_key in manifest:
                    assert (
                        hashlib.sha256(archive.read(base + data_path)).hexdigest()
                        == manifest[hash_key]
                    )
            checks.append({"id": model, "bytes": total, "verified": True})
        package = json.loads(archive.read(prefix + "local-package.json"))
        return {
            "file": str(path),
            "bytes": path.stat().st_size,
            "files": len(names),
            "version": package["version"],
            "crc": True,
            "models": checks,
            "research_images": False,
        }


if __name__ == "__main__":
    print(json.dumps([verify(filename) for filename in sys.argv[1:]], indent=2))
