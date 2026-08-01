#!/usr/bin/env python3
"""Create deterministic masks and review artifacts from an approved raster reference."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIR.parents[2]
SUPPORTED_MODES = {"background_distance", "target_color_distance"}
REQUIRED_CONFIG_KEYS = {
    "version",
    "role",
    "input_image",
    "output_dir",
    "segmentation",
    "cleanup",
    "outputs",
    "notes",
    "approval_state",
}


class ConfigurationError(ValueError):
    """Raised when a vectorization configuration cannot be used safely."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build deterministic mask, overlay, trace, and report artifacts."
    )
    parser.add_argument("--config", required=True, type=Path, help="Path to a JSON config.")
    parser.add_argument(
        "--validate-config",
        action="store_true",
        help="Validate configuration and input paths without generating output.",
    )
    return parser.parse_args()


def load_config(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ConfigurationError(f"Config does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ConfigurationError(f"Config is not valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigurationError("Config root must be a JSON object.")
    missing = sorted(REQUIRED_CONFIG_KEYS - data.keys())
    if missing:
        raise ConfigurationError(f"Config is missing keys: {', '.join(missing)}")
    validate_config(data)
    return data


def validate_color(value: Any, field: str) -> tuple[int, int, int]:
    if not isinstance(value, list) or len(value) != 3:
        raise ConfigurationError(f"{field} must contain three RGB integers.")
    if any(not isinstance(channel, int) or not 0 <= channel <= 255 for channel in value):
        raise ConfigurationError(f"{field} channels must be integers from 0 to 255.")
    return tuple(value)


def validate_config(config: dict[str, Any]) -> None:
    segmentation = config["segmentation"]
    cleanup = config["cleanup"]
    outputs = config["outputs"]
    if not isinstance(segmentation, dict) or segmentation.get("mode") not in SUPPORTED_MODES:
        raise ConfigurationError(
            "segmentation.mode must be background_distance or target_color_distance."
        )
    color_key = "background_color" if segmentation["mode"] == "background_distance" else "target_color"
    validate_color(segmentation.get(color_key), f"segmentation.{color_key}")
    tolerance = segmentation.get("tolerance")
    if not isinstance(tolerance, (int, float)) or not 0 <= tolerance <= math.sqrt(3 * 255**2):
        raise ConfigurationError("segmentation.tolerance must be a valid RGB distance.")
    if not isinstance(cleanup, dict):
        raise ConfigurationError("cleanup must be an object.")
    for key in ("open_radius", "close_radius"):
        value = cleanup.get(key)
        if not isinstance(value, int) or not 0 <= value <= 10:
            raise ConfigurationError(f"cleanup.{key} must be an integer from 0 to 10.")
    expected_outputs = {"mask", "cleaned_mask", "trace", "overlay", "report"}
    if not isinstance(outputs, dict) or expected_outputs - outputs.keys():
        raise ConfigurationError("outputs must name mask, cleaned_mask, trace, overlay, and report.")
    for key in expected_outputs:
        name = outputs[key]
        if not isinstance(name, str) or not name or Path(name).name != name:
            raise ConfigurationError(f"outputs.{key} must be a plain filename.")
    if config["approval_state"] not in {"not_run", "pending_human_review"}:
        raise ConfigurationError("approval_state must be not_run or pending_human_review.")


def repository_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else REPOSITORY_ROOT / path


def report_path(path: Path) -> str:
    """Prefer stable repository-relative paths in generated reports."""
    try:
        return str(path.resolve().relative_to(REPOSITORY_ROOT))
    except ValueError:
        return str(path.resolve())


def rgb_distance(pixel: tuple[int, int, int], reference: tuple[int, int, int]) -> float:
    return math.sqrt(sum((pixel[index] - reference[index]) ** 2 for index in range(3)))


def build_mask(image: Any, segmentation: dict[str, Any], image_module: Any) -> Any:
    rgb = image.convert("RGB")
    mode = segmentation["mode"]
    color_key = "background_color" if mode == "background_distance" else "target_color"
    reference = validate_color(segmentation[color_key], f"segmentation.{color_key}")
    tolerance = float(segmentation["tolerance"])
    alpha_threshold = int(segmentation.get("alpha_threshold", 1))
    alpha = image.getchannel("A") if image.mode == "RGBA" else None
    values: list[int] = []
    for index, pixel in enumerate(rgb.getdata()):
        opaque = alpha is None or alpha.getdata()[index] >= alpha_threshold
        distance = rgb_distance(pixel, reference)
        foreground = distance > tolerance if mode == "background_distance" else distance <= tolerance
        values.append(255 if opaque and foreground else 0)
    mask = image_module.new("L", rgb.size)
    mask.putdata(values)
    return mask


def clean_mask(mask: Any, cleanup: dict[str, Any], image_filter: Any) -> Any:
    cleaned = mask
    open_radius = cleanup["open_radius"]
    close_radius = cleanup["close_radius"]
    if open_radius:
        size = open_radius * 2 + 1
        cleaned = cleaned.filter(image_filter.MinFilter(size)).filter(image_filter.MaxFilter(size))
    if close_radius:
        size = close_radius * 2 + 1
        cleaned = cleaned.filter(image_filter.MaxFilter(size)).filter(image_filter.MinFilter(size))
    return cleaned.point(lambda value: 255 if value >= 128 else 0)


def save_overlay(source: Any, cleaned: Any, destination: Path, image_module: Any) -> None:
    base = source.convert("RGBA")
    red = image_module.new("RGBA", base.size, (220, 35, 45, 0))
    red.putalpha(cleaned.point(lambda value: 112 if value else 0))
    image_module.alpha_composite(base, red).save(destination)


def try_trace(cleaned: Any, destination: Path, output_dir: Path) -> tuple[str, str | None]:
    potrace = shutil.which("potrace")
    if not potrace:
        return "skipped", "potrace executable is not available on PATH"
    temporary_bitmap = output_dir / ".vectorize-reference-trace.pbm"
    cleaned.save(temporary_bitmap)
    try:
        completed = subprocess.run(
            [potrace, str(temporary_bitmap), "--svg", "--output", str(destination)],
            check=False,
            capture_output=True,
            text=True,
        )
    finally:
        temporary_bitmap.unlink(missing_ok=True)
    if completed.returncode:
        return "skipped", f"potrace exited with code {completed.returncode}: {completed.stderr.strip()}"
    return "created", None


def write_report(
    config_path: Path,
    config: dict[str, Any],
    source: Any,
    raw_mask: Any,
    cleaned_mask: Any,
    paths: dict[str, Path],
    trace_status: str,
    trace_message: str | None,
) -> None:
    total = source.width * source.height
    raw_foreground = sum(1 for value in raw_mask.getdata() if value)
    clean_foreground = sum(1 for value in cleaned_mask.getdata() if value)
    report = {
        "tool_version": "0.1",
        "config": report_path(config_path),
        "config_version": config["version"],
        "role": config["role"],
        "approval_state": "pending_human_review",
        "source": {"path": config["input_image"], "width": source.width, "height": source.height},
        "segmentation": config["segmentation"],
        "cleanup": config["cleanup"],
        "metrics": {
            "total_pixels": total,
            "mask_foreground_pixels": raw_foreground,
            "mask_foreground_ratio": round(raw_foreground / total, 8),
            "cleaned_foreground_pixels": clean_foreground,
            "cleaned_foreground_ratio": round(clean_foreground / total, 8),
            "cleanup_changed_pixels": sum(
                1 for before, after in zip(raw_mask.getdata(), cleaned_mask.getdata()) if before != after
            ),
        },
        "trace": {"backend": "potrace", "status": trace_status, "message": trace_message},
        "outputs": {
            key: report_path(path) if path.exists() else None
            for key, path in paths.items()
            if key != "report"
        },
        "review_required": True,
    }
    paths["report"].write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def run(config_path: Path, validate_only: bool) -> int:
    config_path = config_path.resolve()
    config = load_config(config_path)
    input_path = repository_path(config["input_image"])
    if not input_path.is_file():
        raise ConfigurationError(f"Input image does not exist: {input_path}")
    if validate_only:
        print(f"Configuration is valid: {config_path}")
        print(f"Input image exists: {input_path}")
        return 0
    output_dir = repository_path(config["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    if importlib.util.find_spec("PIL") is None:
        print(
            "Pillow is required to generate raster artifacts. Install it locally with "
            "`python -m pip install Pillow`; no project dependency was changed.",
            file=sys.stderr,
        )
        return 2
    from PIL import Image, ImageFilter

    try:
        with Image.open(input_path) as opened:
            source = opened.convert("RGBA")
    except (OSError, ValueError) as exc:
        raise ConfigurationError(f"Input image cannot be decoded: {input_path}: {exc}") from exc
    paths = {key: output_dir / value for key, value in config["outputs"].items()}
    mask = build_mask(source, config["segmentation"], Image)
    cleaned = clean_mask(mask, config["cleanup"], ImageFilter)
    mask.save(paths["mask"])
    cleaned.save(paths["cleaned_mask"])
    save_overlay(source, cleaned, paths["overlay"], Image)
    trace_status, trace_message = try_trace(cleaned, paths["trace"], output_dir)
    write_report(
        config_path,
        config,
        source,
        mask,
        cleaned,
        paths,
        trace_status,
        trace_message,
    )
    print(f"Artifacts written to: {output_dir}")
    if trace_status == "skipped":
        print(f"Vector trace skipped: {trace_message}")
    print("All generated artifacts are unapproved and require human review.")
    return 0


def main() -> int:
    args = parse_args()
    try:
        return run(args.config, args.validate_config)
    except ConfigurationError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
