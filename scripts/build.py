#!/usr/bin/env python3
"""Create dependency-free, reproducible Chrome and Firefox extension ZIPs."""
import json
import math
from pathlib import Path
import shutil
import struct
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extension"
DIST = ROOT / "dist"


def icon(size):
    """Draw the original Q / crescent icon, with 4x antialiasing."""
    scale = 4
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            samples = []
            for sy in range(scale):
                for sx in range(scale):
                    px = (x + (sx + .5) / scale) / size
                    py = (y + (sy + .5) / scale) / size
                    corner = math.hypot(max(.18 - px, 0, px - .82), max(.18 - py, 0, py - .82))
                    color = (18, 28, 32, 255) if corner <= .18 else (0, 0, 0, 0)
                    radius = math.hypot(px - .48, py - .47)
                    ring = .19 < radius < .31
                    tail = abs((py - px) - .015) < .047 and .58 < px < .81 and .58 < py < .83
                    if color[3] and (ring or tail):
                        color = (74, 214, 190, 255)
                    samples.append(color)
            rows.extend(round(sum(s[c] for s in samples) / len(samples)) for c in range(4))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">2I5B", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


def archive(folder, output):
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive_file:
        for file in sorted(folder.rglob("*")):
            if file.is_file():
                info = zipfile.ZipInfo(file.relative_to(folder).as_posix(), (2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                archive_file.writestr(info, file.read_bytes())


def main():
    DIST.mkdir(exist_ok=True)
    (SOURCE / "icons").mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        (SOURCE / "icons" / f"{size}.png").write_bytes(icon(size))
    base = json.loads((SOURCE / "manifest.json").read_text())
    for browser in ("chrome", "firefox"):
        target = DIST / browser
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(SOURCE, target)
        manifest = dict(base)
        if browser == "chrome":
            manifest["minimum_chrome_version"] = "102"
            # Public development key only; keeps unpacked installs on one ID.
            manifest["key"] = (ROOT / "scripts" / "chrome-public-key.txt").read_text().strip()
        else:
            manifest["browser_specific_settings"] = {
                "gecko": {
                    "id": "instagram-quiet@local.example",
                    "strict_min_version": "140.0",
                    "data_collection_permissions": {"required": ["none"]},
                },
                "gecko_android": {"strict_min_version": "142.0"},
            }
        (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        (target / "LICENSE.txt").write_bytes((ROOT / "LICENSE").read_bytes())
        archive(target, DIST / f"instagram-quiet-{browser}.zip")
        print(f"Built {target.relative_to(ROOT)} and dist/instagram-quiet-{browser}.zip")
    archive_files = ["README.md", "LICENSE", "package.json", "PRIVACY.md", "CHANGELOG.md", "CONTRIBUTING.md", ".gitignore"]
    with zipfile.ZipFile(DIST / "instagram-quiet-source.zip", "w", zipfile.ZIP_DEFLATED) as output:
        for name in archive_files:
            output.write(ROOT / name, f"instagram-quiet/{name}")
        for folder in ("extension", "scripts", "tests", ".github"):
            for file in sorted((ROOT / folder).rglob("*")):
                if file.is_file():
                    output.write(file, f"instagram-quiet/{file.relative_to(ROOT)}")
    print("Built dist/instagram-quiet-source.zip")


if __name__ == "__main__":
    main()
