"""Package precompiled application, model and loopback server; no camera data."""

from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    """Build deterministic ZIP with no dependencies needed except Node at use time."""
    destination = ROOT / "artifacts" / "visiora-local.zip"
    destination.parent.mkdir(exist_ok=True)
    files: dict[str, bytes] = {}
    for file in sorted((ROOT / "dist").rglob("*")):
        if file.is_file() and file.suffix not in {".zip", ".map"}:
            data = file.read_bytes()
            if file.name == "index.html":
                # Downloading the ZIP again is unnecessary in an extracted copy.
                data = data.replace(
                    b"</head>", b"<style>.download-link{display:none}</style></head>"
                )
            files["visiora/" + file.relative_to(ROOT).as_posix()] = data
    files["visiora/tools/serve.mjs"] = (ROOT / "tools" / "serve.mjs").read_bytes()
    files["visiora/LEIA-ME.txt"] = (ROOT / "LEIA-ME-LOCAL.txt").read_bytes()
    files["visiora/iniciar.cmd"] = (
        '@echo off\r\ncd /d "%~dp0"\r\nnode tools/serve.mjs\r\npause\r\n'
    ).encode()
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 17, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    print(f"Local ZIP: {destination.stat().st_size} bytes; {len(files)} files")


if __name__ == "__main__":
    main()
