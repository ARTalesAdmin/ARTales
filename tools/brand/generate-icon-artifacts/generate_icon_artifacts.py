#!/usr/bin/env python3
"""Render review-only ARTales icon candidates from the locked micro master."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SOURCE_PATH = Path(
    "brand/artales/masters/micro-symbol/artales-micro-symbol.master.v1.svg"
)
DEFAULT_OUTPUT_DIR = Path("artifact-output/artales-icons/v0.1")
WORKFLOW_NAME = "ARTales Generate Icon Artifacts"

PNG_OUTPUTS = (
    ("favicon-16x16.png", 16),
    ("favicon-32x32.png", 32),
    ("favicon-48x48.png", 48),
    ("apple-touch-icon-180x180.png", 180),
    ("app-icon-192x192.png", 192),
    ("app-icon-512x512.png", 512),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def dependency_error() -> None:
    print(
        "Missing rendering dependencies. Install CairoSVG==2.7.1 and "
        "Pillow==10.4.0 before running this generator.",
        file=sys.stderr,
    )


def generated_file_record(
    path: Path, output_dir: Path, file_format: str, dimensions: str, source: str
) -> dict[str, Any]:
    return {
        "path": path.relative_to(output_dir).as_posix(),
        "format": file_format,
        "dimensions": dimensions,
        "sha256": sha256(path),
        "source": source,
    }


def artifact_readme(source_sha: str) -> str:
    return f"""# ARTales icon artifact candidates v0.1

These files were generated from the locked ARTales micro symbol master:
`{SOURCE_PATH.as_posix()}` (SHA-256 `{source_sha}`). The PNG and ICO files are
candidates for favicon and app-icon use; the source design was rendered as-is.

This workflow does not commit these files to the repository. Manual visual review
is required before any binary is added to `public/`. Runtime or metadata
integration requires a later, explicitly approved pull request.
"""


def generate(output_dir: Path) -> None:
    if not SOURCE_PATH.is_file():
        raise FileNotFoundError(
            f"Locked micro symbol source SVG was not found: {SOURCE_PATH}"
        )

    try:
        import cairosvg
        from PIL import Image
    except ImportError:
        dependency_error()
        raise

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    source_sha = sha256(SOURCE_PATH)
    source_label = SOURCE_PATH.as_posix()
    records: list[dict[str, Any]] = []

    try:
        for filename, size in PNG_OUTPUTS:
            destination = output_dir / filename
            cairosvg.svg2png(
                url=str(SOURCE_PATH),
                write_to=str(destination),
                output_width=size,
                output_height=size,
            )
            with Image.open(destination) as rendered:
                if rendered.size != (size, size):
                    raise ValueError(
                        f"Unexpected dimensions for {filename}: {rendered.size}"
                    )
            records.append(
                generated_file_record(
                    destination, output_dir, "png", f"{size}x{size}", source_label
                )
            )

        ico_path = output_dir / "favicon.ico"
        with Image.open(output_dir / "favicon-48x48.png") as favicon:
            favicon.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
        records.append(
            generated_file_record(
                ico_path, output_dir, "ico", "16x16, 32x32, 48x48", source_label
            )
        )
    except Exception as error:
        raise RuntimeError(f"Icon rendering failed: {error}") from error

    copied_source = output_dir / "artales-micro-symbol.source.svg"
    shutil.copyfile(SOURCE_PATH, copied_source)
    records.append(
        generated_file_record(
            copied_source, output_dir, "svg", "376x652", source_label
        )
    )

    readme_path = output_dir / "README.md"
    readme_path.write_text(artifact_readme(source_sha), encoding="utf-8")
    records.append(
        generated_file_record(
            readme_path, output_dir, "markdown", "not_applicable", source_label
        )
    )

    manifest = {
        "artifact_id": "artales-icon-artifacts.v0.1",
        "status": "generated_artifact_only",
        "source_micro_symbol_master_path": source_label,
        "source_micro_symbol_master_sha256": source_sha,
        "generated_files": records,
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "workflow_name": WORKFLOW_NAME,
        "no_repository_commit": True,
        "no_public_integration": True,
        "runtimeImpact": False,
        "dbImpact": False,
        "envImpact": False,
        "publicIntegration": False,
        "intended_manual_next_step": (
            "download artifact, visually review, then manually upload approved "
            "binary files in a separate PR"
        ),
    }
    manifest_path = output_dir / "artales-icons-manifest.v0.1.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(f"Generated {len(records) + 1} files in {output_dir}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"artifact output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    args = parser.parse_args()

    try:
        generate(args.output_dir)
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
