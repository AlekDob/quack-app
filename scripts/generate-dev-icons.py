#!/usr/bin/env python3
"""Generate dev-variant app icons (amber DEV band) from production icons.

Run from repo root after updating src-tauri/icons/*.png base assets:
  python3 scripts/generate-dev-icons.py

Requires: Pillow, ImageMagick (`magick`), macOS `iconutil` (for .icns).
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "src-tauri" / "icons"
WARN = (245, 158, 11)
WHITE = (255, 255, 255)


def add_dev_badge(img: Image.Image) -> Image.Image:
    out = img.convert("RGBA").copy()
    w, h = out.size
    band_h = max(10, h // 5)
    draw = ImageDraw.Draw(out)
    draw.rectangle([0, h - band_h, w, h], fill=(*WARN, 255))
    ring = max(1, h // 32)
    for i in range(ring):
        draw.rectangle([i, i, w - 1 - i, h - 1 - i], outline=(*WARN, 220))
    text = "DEV"
    font_size = max(8, band_h - 4)
    try:
        font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf", font_size
        )
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(
        ((w - tw) // 2, h - band_h + (band_h - th) // 2 - 1),
        text,
        fill=WHITE,
        font=font,
    )
    return out


def main() -> None:
    pairs = [
        ("32x32.png", "32x32-dev.png"),
        ("128x128.png", "128x128-dev.png"),
        ("128x128@2x.png", "128x128@2x-dev.png"),
        ("64x64.png", "64x64-dev.png"),
    ]
    for src, dst in pairs:
        sp = ICONS / src
        if sp.exists():
            add_dev_badge(Image.open(sp)).save(ICONS / dst)

    src256 = ICONS / "128x128@2x.png"
    if src256.exists():
        temp = ICONS / "icon-dev-temp.png"
        add_dev_badge(Image.open(src256)).save(temp)
        subprocess.run(
            [
                "magick",
                str(temp),
                "-define",
                "icon:auto-resize=256,128,64,48,32,16",
                str(ICONS / "icon-dev.ico"),
            ],
            check=True,
        )
        temp.unlink()

    iconset = ICONS / "icon-dev.iconset"
    if iconset.is_dir():
        shutil.rmtree(iconset)
    iconset.mkdir()
    size_map = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }
    base = Image.open(src256).convert("RGBA")
    for name, size in size_map.items():
        badge = add_dev_badge(base.resize((size, size), Image.Resampling.LANCZOS))
        badge.save(iconset / name)
    subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", str(ICONS / "icon-dev.icns")],
        check=True,
    )
    shutil.rmtree(iconset)
    print(f"Wrote dev icons under {ICONS}")


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
