"""Create a Windows x64 Luna demo bundle without private configuration."""

from __future__ import annotations

import hashlib
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
NODE_VERSION = "24.22.1"  # Current Node 24 LTS patch, pinned and hash-verified for the notebook bundle.
NODE_NAME = f"node-v{NODE_VERSION}-win-x64.zip"
NODE_BASE = f"https://nodejs.org/dist/v{NODE_VERSION}/"
OUTPUT = ARTIFACTS / "visiora-luna-notebook-windows-x64.zip"
PREFIX = "visiora-luna/"


def digest(file: Path) -> str:
    sha = hashlib.sha256()
    with file.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(block)
    return sha.hexdigest()


def download(url: str, destination: Path) -> None:
    if destination.exists():
        return
    temporary = destination.with_name(destination.name + ".partial")
    with (
        urllib.request.urlopen(url, timeout=30) as response,
        temporary.open("wb") as target,
    ):
        shutil.copyfileobj(response, target)
    temporary.replace(destination)


def main() -> None:
    required = [
        ROOT / "dist/index.html",
        ROOT / "dist/app.js",
        ROOT / "dist/perception/evidence.js",
        ROOT / "server/gateway.mjs",
        ROOT / "prompts/luna-vision-v1.md",
        ROOT / "schemas/visual-evidence-v1.json",
    ]
    missing = [str(file.relative_to(ROOT)) for file in required if not file.is_file()]
    if missing:
        raise SystemExit(
            f"Build incompleto: {', '.join(missing)}. Execute npm run build."
        )
    ARTIFACTS.mkdir(exist_ok=True)
    node_archive = ARTIFACTS / NODE_NAME
    sums_file = ARTIFACTS / f"node-v{NODE_VERSION}-SHASUMS256.txt"
    download(NODE_BASE + NODE_NAME, node_archive)
    download(NODE_BASE + "SHASUMS256.txt", sums_file)
    candidates = [
        line.split()[0]
        for line in sums_file.read_text(encoding="utf-8").splitlines()
        if line.split()[-1].lstrip("*") == NODE_NAME
    ]
    if len(candidates) != 1 or digest(node_archive) != candidates[0]:
        raise SystemExit("O pacote oficial do Node não passou na verificação SHA-256.")

    inputs: list[Path] = []
    for directory in ("dist", "server", "prompts", "schemas"):
        inputs.extend(file for file in (ROOT / directory).rglob("*") if file.is_file())
    inputs.extend(
        [
            ROOT / "package.json",
            ROOT / "tools/notebook-luna/iniciar-luna.cmd",
            ROOT / "tools/notebook-luna/LEIA-ME-LUNA.txt",
            ROOT / "tools/notebook-luna/check-luna.mjs",
        ]
    )
    for file in inputs:
        if file.name == ".env" or ".runtime" in file.parts:
            raise SystemExit("Um arquivo privado entrou na lista do pacote.")

    node_prefix = f"node-v{NODE_VERSION}-win-x64/"
    with zipfile.ZipFile(node_archive) as official:
        for name in ("node.exe", "LICENSE"):
            if node_prefix + name not in official.namelist():
                raise SystemExit(f"O pacote oficial do Node não contém {name}.")
        with zipfile.ZipFile(
            OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6
        ) as bundle:
            for file in sorted(inputs):
                target = PREFIX + file.relative_to(ROOT).as_posix()
                if target.startswith(PREFIX + "tools/notebook-luna/"):
                    target = PREFIX + file.name
                bundle.write(file, target)
            for name in ("node.exe", "LICENSE"):
                target = PREFIX + (
                    "node.exe" if name == "node.exe" else "licenses/Node.js-LICENSE.txt"
                )
                with (
                    official.open(node_prefix + name) as source,
                    bundle.open(target, "w") as destination,
                ):
                    shutil.copyfileobj(source, destination)
            bundle.writestr(
                PREFIX + "bundle.json",
                json.dumps(
                    {
                        "node": NODE_VERSION,
                        "platform": "win32-x64",
                        "secretsIncluded": False,
                    }
                ),
            )
    with zipfile.ZipFile(OUTPUT) as bundle:
        names = bundle.namelist()
        if any(name.endswith("/.env") or "/.runtime/" in name for name in names):
            raise SystemExit("O pacote contém configuração privada.")
        if bundle.testzip() is not None:
            raise SystemExit("O ZIP não passou na verificação de integridade.")
    print(
        json.dumps(
            {
                "archive": str(OUTPUT),
                "bytes": OUTPUT.stat().st_size,
                "sha256": digest(OUTPUT),
            }
        )
    )


if __name__ == "__main__":
    main()
