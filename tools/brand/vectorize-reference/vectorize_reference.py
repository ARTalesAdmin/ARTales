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
SUPPORTED_TRACE_MODES = {"foreground"}
SMALL_PREVIEW_SIZES = [128, 64, 32, 16]
DEFAULT_TRACE = {
    "mode": "foreground",
    "fill_color": "#000000",
    "background": "transparent",
}
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
    if "review_board" in outputs:
        name = outputs["review_board"]
        if not isinstance(name, str) or not name or Path(name).name != name:
            raise ConfigurationError("outputs.review_board must be a plain filename.")
    if config["approval_state"] not in {"not_run", "pending_human_review"}:
        raise ConfigurationError("approval_state must be not_run or pending_human_review.")
    trace = config.get("trace", DEFAULT_TRACE)
    if not isinstance(trace, dict):
        raise ConfigurationError("trace must be an object.")
    if trace.get("mode") not in SUPPORTED_TRACE_MODES:
        raise ConfigurationError("trace.mode must be foreground.")
    fill_color = trace.get("fill_color")
    if (
        not isinstance(fill_color, str)
        or len(fill_color) != 7
        or not fill_color.startswith("#")
        or any(character not in "0123456789abcdefABCDEF" for character in fill_color[1:])
    ):
        raise ConfigurationError("trace.fill_color must be a six-digit hexadecimal color.")
    if trace.get("background") != "transparent":
        raise ConfigurationError("trace.background must be transparent.")


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


def try_trace(
    cleaned: Any,
    destination: Path,
    output_dir: Path,
    trace: dict[str, Any],
) -> tuple[str, str | None, bool]:
    potrace = shutil.which("potrace")
    if not potrace:
        return "skipped", "potrace executable is not available on PATH", False
    temporary_bitmap = output_dir / ".vectorize-reference-trace.pbm"
    # The cleaned mask uses white for selected foreground, while potrace traces
    # black bitmap pixels. Normalize that polarity only in the temporary input.
    trace_bitmap = cleaned.point(lambda value: 0 if value else 255)
    trace_bitmap.save(temporary_bitmap)
    try:
        completed = subprocess.run(
            [
                potrace,
                str(temporary_bitmap),
                "--svg",
                "--color",
                trace["fill_color"],
                "--output",
                str(destination),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
    finally:
        temporary_bitmap.unlink(missing_ok=True)
    if completed.returncode:
        return (
            "skipped",
            f"potrace exited with code {completed.returncode}: {completed.stderr.strip()}",
            True,
        )
    return "created", None, True


def try_render_trace(
    svg_path: Path,
    output_dir: Path,
    size: tuple[int, int],
    image_module: Any,
) -> tuple[Any | None, str | None]:
    """Best-effort SVG rasterization without making a renderer a project dependency."""
    if not svg_path.is_file():
        return None, "Trace render unavailable because no SVG trace was created."
    temporary_png = output_dir / ".vectorize-reference-trace-render.png"
    width, height = size
    message: str | None = None
    try:
        if importlib.util.find_spec("cairosvg") is not None:
            cairosvg = importlib.import_module("cairosvg")
            cairosvg.svg2png(
                url=str(svg_path),
                write_to=str(temporary_png),
                output_width=width,
                output_height=height,
            )
        elif shutil.which("rsvg-convert"):
            completed = subprocess.run(
                [
                    "rsvg-convert",
                    "--width",
                    str(width),
                    "--height",
                    str(height),
                    "--output",
                    str(temporary_png),
                    str(svg_path),
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            if completed.returncode:
                message = f"Trace render skipped: rsvg-convert exited with code {completed.returncode}."
        else:
            imagemagick = shutil.which("magick") or shutil.which("convert")
            if imagemagick:
                command = [imagemagick]
                if Path(imagemagick).name == "magick":
                    command.append("convert")
                completed = subprocess.run(
                    command
                    + [
                        str(svg_path),
                        "-background",
                        "none",
                        "-resize",
                        f"{width}x{height}!",
                        str(temporary_png),
                    ],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                if completed.returncode:
                    message = f"Trace render skipped: ImageMagick exited with code {completed.returncode}."
            else:
                message = "Trace render skipped: no CairoSVG, rsvg-convert, or ImageMagick renderer is available."
        if temporary_png.is_file():
            with image_module.open(temporary_png) as opened:
                return opened.convert("RGBA"), None
    except Exception as exc:  # Optional renderers must never make the diagnostic run fail.
        message = f"Trace render skipped: renderer failed ({exc})."
    finally:
        temporary_png.unlink(missing_ok=True)
    return None, message or "Trace render unavailable."


def _fit(image: Any, size: tuple[int, int], image_module: Any) -> Any:
    fitted = image.copy()
    fitted.thumbnail(size, image_module.Resampling.LANCZOS)
    canvas = image_module.new("RGBA", size, "white")
    canvas.alpha_composite(
        fitted.convert("RGBA"),
        ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2),
    )
    return canvas


def create_review_board(
    source: Any,
    raw_mask: Any,
    cleaned_mask: Any,
    overlay: Any,
    trace_render: Any | None,
    destination: Path,
    fallback_messages: list[str],
    image_module: Any,
    image_draw: Any,
) -> tuple[bool, list[int]]:
    """Compose a labelled, diagnostic-only human review sheet."""
    panel_size = (360, 250)
    margin, gap, label_height = 28, 20, 32
    board = image_module.new("RGB", (3 * panel_size[0] + 2 * gap + 2 * margin, 1360), "#ececec")
    draw = image_draw.Draw(board)
    draw.text((margin, 12), "ARTales vectorization review board - diagnostic / unapproved", fill="black")

    panels: list[tuple[str, Any | None, str | None]] = [
        ("Source crop", source, None),
        ("Raw mask", raw_mask, None),
        ("Cleaned mask", cleaned_mask, None),
        ("Mask overlay", overlay, None),
    ]
    comparison_available = trace_render is not None
    if trace_render is not None:
        trace_overlay = source.convert("RGBA")
        tint = image_module.new("RGBA", trace_render.size, (0, 190, 255, 0))
        tint.putalpha(trace_render.getchannel("A").point(lambda value: value // 2))
        trace_overlay = image_module.alpha_composite(trace_overlay, tint)
        expected = cleaned_mask.point(lambda value: 255 if value >= 128 else 0)
        rendered = trace_render.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
        mismatch = image_module.new("RGB", source.size, "white")
        mismatch.putdata(
            [
                (220, 45, 55)
                if wanted and not actual
                else (35, 105, 210)
                if actual and not wanted
                else (35, 35, 35)
                if actual
                else (255, 255, 255)
                for wanted, actual in zip(expected.getdata(), rendered.getdata())
            ]
        )
        panels.extend(
            [
                ("Trace render", trace_render, None),
                ("Source + trace overlay", trace_overlay, None),
                ("Trace mismatch (red missing / blue extra)", mismatch, None),
            ]
        )
    else:
        fallback = fallback_messages[-1] if fallback_messages else "Trace render unavailable"
        panels.extend([("Trace render unavailable", None, fallback), ("Source + trace overlay unavailable", None, fallback)])

    for index, (label, image, note) in enumerate(panels):
        row, column = divmod(index, 3)
        x = margin + column * (panel_size[0] + gap)
        y = 48 + row * (panel_size[1] + label_height + gap)
        draw.text((x, y), label, fill="black")
        area_y = y + label_height
        if image is not None:
            board.paste(_fit(image, panel_size, image_module).convert("RGB"), (x, area_y))
        else:
            draw.rectangle(
                (x, area_y, x + panel_size[0], area_y + panel_size[1]),
                fill="white",
                outline="#999999",
            )
            draw.multiline_text((x + 16, area_y + 20), note or "Unavailable", fill="#555555", spacing=6)

    preview_y = 990
    preview_source = trace_render.getchannel("A") if trace_render is not None else cleaned_mask
    preview_label = "trace render" if trace_render is not None else "cleaned-mask fallback"
    draw.text((margin, preview_y), f"Small-size previews ({preview_label})", fill="black")
    x = margin
    for size in SMALL_PREVIEW_SIZES:
        tile = preview_source.resize((size, size), image_module.Resampling.LANCZOS)
        tile_rgba = image_module.new("RGBA", (size, size), "white")
        ink = image_module.new("RGBA", (size, size), (0, 0, 0, 255))
        tile_rgba.paste(ink, mask=tile)
        draw.text((x, preview_y + 28), f"{size} px", fill="black")
        board.paste(tile_rgba.convert("RGB"), (x, preview_y + 50))
        x += max(size, 90) + 24
    draw.text(
        (margin, 1210),
        "Visual mismatch uses thresholded trace alpha; anti-aliasing differences are diagnostic, not a score.",
        fill="#333333",
    )
    draw.text(
        (margin, 1242),
        "This board does not approve or promote any logo asset.",
        fill="#333333",
    )
    if fallback_messages:
        draw.multiline_text(
            (margin, 1274),
            "Fallbacks: " + " | ".join(fallback_messages),
            fill="#555555",
            spacing=4,
        )
    board.save(destination)
    return comparison_available, SMALL_PREVIEW_SIZES


def write_report(
    config_path: Path,
    config: dict[str, Any],
    source: Any,
    raw_mask: Any,
    cleaned_mask: Any,
    paths: dict[str, Path],
    trace_status: str,
    trace_message: str | None,
    trace_inverted_for_potrace: bool,
    trace_render_available: bool,
    source_trace_overlay_generated: bool,
    small_preview_sizes: list[int],
    fallback_messages: list[str],
) -> None:
    total = source.width * source.height
    raw_foreground = sum(1 for value in raw_mask.getdata() if value)
    clean_foreground = sum(1 for value in cleaned_mask.getdata() if value)
    trace = config.get("trace", DEFAULT_TRACE)
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
        "trace_backend": "potrace",
        "trace_status": trace_status,
        "trace_mode": trace["mode"],
        "trace_foreground_expected": True,
        "trace_fill_color": trace["fill_color"],
        "trace_background": trace["background"],
        "trace_inverted_for_potrace": trace_inverted_for_potrace,
        "trace_message": trace_message,
        "review_board": report_path(paths["review_board"]),
        "trace_render_available": trace_render_available,
        "source_trace_overlay_generated": source_trace_overlay_generated,
        "small_size_preview_sizes": small_preview_sizes,
        "fallback_messages": fallback_messages,
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
    from PIL import Image, ImageDraw, ImageFilter

    try:
        with Image.open(input_path) as opened:
            source = opened.convert("RGBA")
    except (OSError, ValueError) as exc:
        raise ConfigurationError(f"Input image cannot be decoded: {input_path}: {exc}") from exc
    output_names = dict(config["outputs"])
    output_names.setdefault("review_board", f"{config['role']}-review-board.png")
    paths = {key: output_dir / value for key, value in output_names.items()}
    mask = build_mask(source, config["segmentation"], Image)
    cleaned = clean_mask(mask, config["cleanup"], ImageFilter)
    mask.save(paths["mask"])
    cleaned.save(paths["cleaned_mask"])
    save_overlay(source, cleaned, paths["overlay"], Image)
    trace = config.get("trace", DEFAULT_TRACE)
    trace_status, trace_message, trace_inverted_for_potrace = try_trace(
        cleaned, paths["trace"], output_dir, trace
    )
    trace_render, render_message = try_render_trace(paths["trace"], output_dir, source.size, Image)
    fallback_messages = [message for message in (trace_message, render_message) if message]
    with Image.open(paths["overlay"]) as opened_overlay:
        source_trace_overlay_generated, small_preview_sizes = create_review_board(
            source,
            mask,
            cleaned,
            opened_overlay.convert("RGBA"),
            trace_render,
            paths["review_board"],
            fallback_messages,
            Image,
            ImageDraw,
        )
    write_report(
        config_path,
        config,
        source,
        mask,
        cleaned,
        paths,
        trace_status,
        trace_message,
        trace_inverted_for_potrace,
        trace_render is not None,
        source_trace_overlay_generated,
        small_preview_sizes,
        fallback_messages,
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
