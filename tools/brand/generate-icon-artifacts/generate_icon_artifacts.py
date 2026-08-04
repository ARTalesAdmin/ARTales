#!/usr/bin/env python3
"""Generate review-only ARTales icon artifacts from the locked micro symbol."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from typing import Final

import cairosvg
from PIL import Image


REPOSITORY_ROOT: Final = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE: Final = (
    REPOSITORY_ROOT
    / "brand/artales/masters/micro-symbol/artales-micro-symbol.master.v1.svg"
)
DEFAULT_OUTPUT: Final = Path(__file__).resolve().parent / "output"
PNG_SIZES: Final = (16, 32, 48, 180, 192, 512)
ICO_SIZES: Final = (16, 32, 48)


def sha256(path: Path) -> str:
    """Return a file's lowercase SHA-256 digest."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(64 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def render_square(svg: bytes, size: int) -> Image.Image:
    """Render an SVG centered on a transparent square canvas."""
    rendered = cairosvg.svg2png(bytestring=svg, output_width=size, output_height=size)
    image = Image.open(io.BytesIO(rendered)).convert("RGBA")
    if image.size != (size, size):
        raise RuntimeError(f"renderer returned {image.size}, expected {(size, size)}")
    return image


def generate(source: Path, output_dir: Path) -> list[Path]:
    """Create a clean, deterministic artifact set and return its paths."""
    if not source.is_file():
        raise FileNotFoundError(f"locked micro-symbol master not found: {source}")
    output_dir.mkdir(parents=True, exist_ok=True)
    for old_file in output_dir.iterdir():
        if old_file.is_file():
            old_file.unlink()

    svg = source.read_bytes()
    images = {size: render_square(svg, size) for size in PNG_SIZES}
    generated: list[Path] = []
    for size, image in images.items():
        path = output_dir / f"artales-icon-{size}.png"
        image.save(path, format="PNG", optimize=False, compress_level=9)
        generated.append(path)

    ico_path = output_dir / "artales-icon.ico"
    images[max(ICO_SIZES)].save(
        ico_path,
        format="ICO",
        sizes=[(size, size) for size in ICO_SIZES],
    )
    generated.append(ico_path)

    manifest_path = output_dir / "manifest.json"
    manifest = {
        "artifact_set": "artales-icon-artifacts",
        "status": "review_only_not_for_runtime",
        "source": source.relative_to(REPOSITORY_ROOT).as_posix(),
        "source_sha256": sha256(source),
        "files": [
            {"path": path.name, "sha256": sha256(path)}
            for path in sorted(generated, key=lambda item: item.name)
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    generated.append(manifest_path)
    return generated


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    generated = generate(args.source.resolve(), args.output_dir.resolve())
    for path in generated:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
