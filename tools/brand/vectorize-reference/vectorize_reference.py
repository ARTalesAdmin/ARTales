#!/usr/bin/env python3
"""Create deterministic masks and review artifacts from an approved raster reference."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = SCRIPT_DIR.parents[2]
SUPPORTED_MODES = {"background_distance", "target_color_distance"}
SUPPORTED_TRACE_MODES = {"foreground"}
SMALL_PREVIEW_SIZES = [128, 64, 32, 16]
TOOL_VERSION = "0.2"
SAFE_VARIANT_ID = re.compile(r"^[a-z0-9_-]+$")
DEFAULT_TRACE = {
    "mode": "foreground",
    "fill_color": "#000000",
    "background": "transparent",
}
POTRACE_OPTION_RULES = {
    "turdsize": (int, 0, 100),
    "alphamax": ((int, float), 0.0, 1.333),
    "opttolerance": ((int, float), 0.0, 10.0),
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
    parser.add_argument(
        "--matrix",
        action="store_true",
        help="Generate deterministic diagnostics for every configured trace_matrix variant.",
    )
    parser.add_argument(
        "--candidate-from-matrix",
        metavar="VARIANT_ID",
        help=(
            "Regenerate one trace_matrix variant and package it as an unapproved "
            "repository candidate (never a master or runtime asset)."
        ),
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
    validate_potrace_options(trace.get("potrace", {}), "trace.potrace")
    trace_matrix = config.get("trace_matrix")
    if trace_matrix is not None:
        if not isinstance(trace_matrix, list) or not trace_matrix:
            raise ConfigurationError("trace_matrix must be a non-empty array when provided.")
        seen_ids: set[str] = set()
        for index, variant in enumerate(trace_matrix):
            field = f"trace_matrix[{index}]"
            if not isinstance(variant, dict):
                raise ConfigurationError(f"{field} must be an object.")
            variant_id = variant.get("id")
            if not isinstance(variant_id, str) or not SAFE_VARIANT_ID.fullmatch(variant_id):
                raise ConfigurationError(
                    f"{field}.id must contain only lowercase letters, numbers, hyphens, or underscores."
                )
            if variant_id in seen_ids:
                raise ConfigurationError(f"trace_matrix contains duplicate id: {variant_id}.")
            seen_ids.add(variant_id)
            if not isinstance(variant.get("label"), str) or not variant["label"].strip():
                raise ConfigurationError(f"{field}.label must be a non-empty string.")
            unknown_keys = sorted(variant.keys() - {"id", "label", "potrace"})
            if unknown_keys:
                raise ConfigurationError(f"{field} contains unsupported keys: {', '.join(unknown_keys)}.")
            validate_potrace_options(variant.get("potrace"), f"{field}.potrace")


def validate_potrace_options(potrace_options: Any, field: str) -> None:
    if not isinstance(potrace_options, dict):
        raise ConfigurationError(f"{field} must be an object.")
    unknown_options = sorted(potrace_options.keys() - POTRACE_OPTION_RULES.keys())
    if unknown_options:
        raise ConfigurationError(
            f"{field} contains unsupported options: {', '.join(unknown_options)}."
        )
    for name, value in potrace_options.items():
        expected_type, minimum, maximum = POTRACE_OPTION_RULES[name]
        if isinstance(value, bool) or not isinstance(value, expected_type):
            raise ConfigurationError(f"{field}.{name} has the wrong numeric type.")
        if not minimum <= value <= maximum:
            raise ConfigurationError(
                f"{field}.{name} must be from {minimum} to {maximum}."
            )


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
) -> tuple[str, str | None, bool, dict[str, int | float]]:
    configured_options = trace.get("potrace", {})
    # Never let an artifact from an earlier run masquerade as this run's trace.
    destination.unlink(missing_ok=True)
    potrace = shutil.which("potrace")
    if not potrace:
        return "skipped", "potrace executable is not available on PATH", False, {}
    temporary_bitmap = output_dir / ".vectorize-reference-trace.pbm"
    # The cleaned mask uses white for selected foreground, while potrace traces
    # black bitmap pixels. Normalize that polarity only in the temporary input.
    trace_bitmap = cleaned.point(lambda value: 0 if value else 255)
    trace_bitmap.save(temporary_bitmap)
    try:
        command = [potrace, str(temporary_bitmap), "--svg", "--color", trace["fill_color"]]
        for name, value in configured_options.items():
            command.extend([f"--{name}", str(value)])
        command.extend(["--output", str(destination)])
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    finally:
        temporary_bitmap.unlink(missing_ok=True)
    if completed.returncode:
        destination.unlink(missing_ok=True)
        return (
            "skipped",
            f"potrace exited with code {completed.returncode}: {completed.stderr.strip()}",
            True,
            {},
        )
    return "created", None, True, dict(configured_options)


def analyze_trace_svg(svg_path: Path, trace: dict[str, Any], options_used: dict[str, Any]) -> dict[str, Any]:
    """Return structural SVG diagnostics without treating the trace as approved."""
    analysis: dict[str, Any] = {
        "svg_exists": svg_path.is_file(),
        "svg_file_size_bytes": svg_path.stat().st_size if svg_path.is_file() else None,
        "svg_path_count": None,
        "svg_contains_image_tag": None,
        "svg_contains_text_tag": None,
        "svg_contains_rect_background": None,
        "svg_fill_values": [],
        "svg_has_viewbox": False,
        "svg_width": None,
        "svg_height": None,
        "trace_transparent_background_expected": trace["background"] == "transparent",
        "trace_potrace_options_configured": trace.get("potrace", {}),
        "trace_potrace_options_used": options_used,
        "parse_error": None,
    }
    if not svg_path.is_file():
        return analysis
    try:
        root = ET.parse(svg_path).getroot()
        elements = list(root.iter())
        local_name = lambda element: element.tag.rsplit("}", 1)[-1].lower()
        analysis.update(
            {
                "svg_path_count": sum(local_name(element) == "path" for element in elements),
                "svg_contains_image_tag": any(local_name(element) == "image" for element in elements),
                "svg_contains_text_tag": any(local_name(element) == "text" for element in elements),
                "svg_contains_rect_background": any(local_name(element) == "rect" for element in elements),
                "svg_fill_values": sorted(
                    {element.attrib["fill"] for element in elements if "fill" in element.attrib}
                ),
                "svg_has_viewbox": "viewBox" in root.attrib,
                "svg_width": root.attrib.get("width"),
                "svg_height": root.attrib.get("height"),
            }
        )
    except (ET.ParseError, OSError) as exc:
        analysis["parse_error"] = str(exc)
    return analysis


def compare_trace_to_mask(cleaned_mask: Any, trace_render: Any | None) -> dict[str, Any]:
    """Compare thresholded pixels; this is not a perceptual quality score."""
    comparison = {
        "trace_render_available": trace_render is not None,
        "trace_vs_cleaned_mask_mismatch_ratio": None,
        "trace_vs_cleaned_mask_mismatch_pixels": None,
        "compared_pixel_count": 0,
        "unavailable_reason": None,
        "note": "Diagnostic thresholded mask/render comparison; not a perceptual logo quality score.",
    }
    if trace_render is None:
        return comparison
    expected = cleaned_mask.point(lambda value: 255 if value >= 128 else 0)
    rendered = trace_render.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    mismatches = sum(before != after for before, after in zip(expected.getdata(), rendered.getdata()))
    total = expected.width * expected.height
    comparison.update(
        {
            "trace_vs_cleaned_mask_mismatch_ratio": round(mismatches / total, 8),
            "trace_vs_cleaned_mask_mismatch_pixels": mismatches,
            "compared_pixel_count": total,
        }
    )
    return comparison


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


def save_trace_previews(trace_render: Any | None, output_dir: Path, image_module: Any) -> list[int]:
    """Write comparable trace previews only when an SVG renderer is available."""
    if trace_render is None:
        return []
    alpha = trace_render.getchannel("A")
    for size in SMALL_PREVIEW_SIZES:
        resized = alpha.resize((size, size), image_module.Resampling.LANCZOS)
        preview = image_module.new("RGBA", (size, size), "white")
        preview.paste(image_module.new("RGBA", (size, size), "black"), mask=resized)
        preview.save(output_dir / f"trace-preview-{size}.png")
    return list(SMALL_PREVIEW_SIZES)


def create_matrix_board(
    variants: list[dict[str, Any]],
    destination: Path,
    image_module: Any,
    image_draw: Any,
) -> None:
    """Create one explicitly unapproved, side-by-side trace comparison board."""
    column_width, margin, gap = 310, 28, 18
    width = 2 * margin + len(variants) * column_width + (len(variants) - 1) * gap
    board = image_module.new("RGB", (width, 760), "#ececec")
    draw = image_draw.Draw(board)
    draw.text((margin, 14), "ARTales symbol trace matrix - DIAGNOSTIC ONLY / NOT APPROVED / NOT A MASTER", fill="black")
    draw.text((margin, 38), "Mismatch is a thresholded pixel diagnostic, not a perceptual quality score.", fill="#333333")
    for index, variant in enumerate(variants):
        x = margin + index * (column_width + gap)
        draw.text((x, 76), variant["label"], fill="black")
        options = variant["potrace_options_configured"]
        draw.multiline_text(
            (x, 98),
            f"id: {variant['id']}\nturdsize={options['turdsize']}  alphamax={options['alphamax']}\nopttolerance={options['opttolerance']}",
            fill="#333333",
            spacing=3,
        )
        render = variant.pop("_trace_render", None)
        if render is not None:
            board.paste(_fit(render, (column_width, 300), image_module).convert("RGB"), (x, 160))
        else:
            draw.rectangle((x, 160, x + column_width, 460), fill="white", outline="#999999")
            draw.multiline_text(
                (x + 16, 182),
                "Trace render unavailable\n\n" + "\n".join(variant["fallback_messages"]),
                fill="#555555",
                spacing=5,
            )
        ratio = variant["mismatch_ratio"]
        ratio_text = "unavailable" if ratio is None else str(ratio)
        draw.text((x, 478), f"Mismatch ratio: {ratio_text}", fill="black")
        draw.text((x, 500), f"SVG path count: {variant['svg_path_count']}", fill="black")
        draw.text((x, 532), "Small-size previews", fill="black")
        preview_x = x
        for size in SMALL_PREVIEW_SIZES:
            preview_path = Path(variant["_output_dir"]) / f"trace-preview-{size}.png"
            draw.text((preview_x, 554), str(size), fill="#333333")
            if preview_path.is_file():
                with image_module.open(preview_path) as preview:
                    board.paste(preview.convert("RGB"), (preview_x, 574))
            else:
                draw.rectangle((preview_x, 574, preview_x + size, 574 + size), fill="white", outline="#999999")
            preview_x += max(size, 42) + 7
        variant.pop("_output_dir", None)
    draw.text((margin, 730), "Human review is required. No variant is selected, promoted, approved, or locked by this output.", fill="#333333")
    board.save(destination)


def run_trace_matrix(
    config_path: Path,
    config: dict[str, Any],
    source: Any,
    cleaned: Any,
    output_dir: Path,
    base_metrics: dict[str, Any],
    image_module: Any,
    image_draw: Any,
) -> None:
    matrix_dir = output_dir / "matrix"
    matrix_dir.mkdir(parents=True, exist_ok=True)
    base_trace = config.get("trace", DEFAULT_TRACE)
    variants: list[dict[str, Any]] = []
    for configured in config["trace_matrix"]:
        variant_dir = matrix_dir / configured["id"]
        variant_dir.mkdir(parents=True, exist_ok=True)
        trace = {**base_trace, "potrace": dict(configured["potrace"])}
        svg_path = variant_dir / "trace.svg"
        status, trace_message, _, options_used = try_trace(cleaned, svg_path, variant_dir, trace)
        analysis = analyze_trace_svg(svg_path, trace, options_used)
        trace_render, render_message = try_render_trace(svg_path, variant_dir, source.size, image_module)
        if trace_render is not None:
            trace_render.save(variant_dir / "trace-render.png")
        comparison = compare_trace_to_mask(cleaned, trace_render)
        if trace_render is None:
            comparison["unavailable_reason"] = render_message
        fallbacks = [message for message in (trace_message, render_message) if message]
        preview_sizes = save_trace_previews(trace_render, variant_dir, image_module)
        warnings = []
        if analysis["parse_error"]:
            warnings.append(f"SVG parse error: {analysis['parse_error']}")
        if trace_render is None:
            warnings.append("Render-dependent comparison metrics and previews are unavailable.")
        variant = {
            "id": configured["id"],
            "label": configured["label"],
            "potrace_options_configured": configured["potrace"],
            "potrace_options_used": options_used,
            "trace_status": status,
            "svg_exists": analysis["svg_exists"],
            "svg_file_size_bytes": analysis["svg_file_size_bytes"],
            "svg_path_count": analysis["svg_path_count"],
            "svg_fill_values": analysis["svg_fill_values"],
            "svg_contains_image_tag": analysis["svg_contains_image_tag"],
            "svg_contains_text_tag": analysis["svg_contains_text_tag"],
            "svg_contains_rect_background": analysis["svg_contains_rect_background"],
            "svg_has_viewbox": analysis["svg_has_viewbox"],
            "mismatch_ratio": comparison["trace_vs_cleaned_mask_mismatch_ratio"],
            "mismatch_pixels": comparison["trace_vs_cleaned_mask_mismatch_pixels"],
            "compared_pixel_count": comparison["compared_pixel_count"],
            "trace_render_available": trace_render is not None,
            "fallback_messages": fallbacks,
            "small_size_preview_sizes": preview_sizes,
            "notes": warnings,
            "review_required": True,
            "approval_state": "diagnostic_only_not_approved",
            "_trace_render": trace_render,
            "_output_dir": str(variant_dir),
        }
        serializable = {key: value for key, value in variant.items() if not key.startswith("_")}
        (variant_dir / "variant-metrics.json").write_text(json.dumps(serializable, indent=2) + "\n", encoding="utf-8")
        variants.append(variant)
    board_path = output_dir / "symbol-trace-matrix-board.png"
    create_matrix_board(variants, board_path, image_module, image_draw)
    report = {
        "tool_version": TOOL_VERSION,
        "source_config_path": report_path(config_path),
        "source_crop_path": report_path(repository_path(config["input_image"])),
        "cleaned_mask_metrics": base_metrics,
        "review_required": True,
        "approval_state": "diagnostic_only_not_approved",
        "diagnostic_note": "Mismatch is not a perceptual quality score; no variant is selected or promoted.",
        "matrix_board": report_path(board_path),
        "variants": variants,
    }
    (output_dir / "symbol-trace-matrix-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def package_matrix_candidate(
    config_path: Path,
    config: dict[str, Any],
    variant_id: str,
    source: Any,
    cleaned: Any,
    image_module: Any,
) -> None:
    """Regenerate and persist one explicitly unapproved symbol candidate."""
    if config["role"] != "artales_symbol_pen_drop":
        raise ConfigurationError(
            "Candidate packaging is currently restricted to the standalone ARTales symbol config."
        )
    variants = config.get("trace_matrix") or []
    selected = next((variant for variant in variants if variant["id"] == variant_id), None)
    if selected is None:
        available = ", ".join(variant["id"] for variant in variants) or "none"
        raise ConfigurationError(
            f"trace_matrix variant '{variant_id}' was not found (available: {available})."
        )

    trace = {**config.get("trace", DEFAULT_TRACE), "potrace": dict(selected["potrace"])}
    candidate_dir = REPOSITORY_ROOT / "brand/artales/candidates/symbol-pen-drop"
    basename = f"symbol-pen-drop.{variant_id}.candidate.v{config['version']}"
    svg_path = candidate_dir / f"{basename}.svg"
    metadata_path = candidate_dir / f"{basename}.json"
    with tempfile.TemporaryDirectory(prefix="artales-symbol-candidate-") as temporary:
        temporary_dir = Path(temporary)
        temporary_svg = temporary_dir / "candidate.svg"
        status, message, _, options_used = try_trace(
            cleaned, temporary_svg, temporary_dir, trace
        )
        if status != "created":
            raise ConfigurationError(f"Candidate SVG could not be generated: {message}")
        analysis = analyze_trace_svg(temporary_svg, trace, options_used)
        forbidden = (
            analysis["svg_contains_image_tag"],
            analysis["svg_contains_text_tag"],
            analysis["svg_contains_rect_background"],
        )
        if analysis["parse_error"] or any(forbidden) or not analysis["svg_has_viewbox"]:
            raise ConfigurationError("Generated candidate SVG failed candidate structure checks.")
        if trace["fill_color"].lower() not in {
            value.lower() for value in analysis["svg_fill_values"]
        }:
            raise ConfigurationError("Generated candidate SVG does not contain the configured fill color.")

        trace_render, render_message = try_render_trace(
            temporary_svg, temporary_dir, source.size, image_module
        )
        comparison = compare_trace_to_mask(cleaned, trace_render)
        if trace_render is None:
            comparison["unavailable_reason"] = render_message
        candidate_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(temporary_svg, svg_path)

    source_crop = report_path(repository_path(config["input_image"]))
    source_reference = "brand/artales/references/source/symbol-pen-drop.source.jpg"
    metadata = {
        "candidate_id": f"symbol-pen-drop.{variant_id}",
        "version": config["version"],
        "status": "candidate_review_only",
        "approval_state": "awaiting_human_visual_review",
        "not_master": True,
        "selected_from_matrix_variant": selected["id"],
        "selected_from_matrix_label": selected["label"],
        "selected_potrace_options": selected["potrace"],
        "source_config_path": report_path(config_path),
        "source_reference_path": source_reference,
        "source_crop_path": source_crop,
        "generated_from_trace_matrix": True,
        "deterministic_regeneration": True,
        "fill_color": trace["fill_color"],
        "background": "transparent",
        "svg_analysis": analysis,
        "trace_comparison": comparison,
        "small_size_note": "16 px likely needs a separate small-size or favicon variant later.",
        "runtimeImpact": False,
        "dbImpact": False,
        "envImpact": False,
        "limitations": [
            "Thresholded render mismatch is a technical diagnostic, not a perceptual quality score.",
            "The deterministic trace has not received human visual approval.",
            "This package does not define a master or a small-size variant.",
        ],
        "review_checklist": [
            "Compare silhouette and negative space with the source crop.",
            "Inspect curve continuity and retained pen/drop identity at useful zoom levels.",
            "Review 128, 64, 32, and 16 px behavior; do not infer favicon approval.",
            "Record explicit human approval before any separate master-lock proposal.",
        ],
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Unapproved candidate package written to: {candidate_dir}")


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
    trace_svg_analysis: dict[str, Any],
    trace_comparison: dict[str, Any],
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
        "tool_version": TOOL_VERSION,
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
        "trace_svg_analysis": trace_svg_analysis,
        "trace_comparison": trace_comparison,
        "review_board": report_path(paths["review_board"]),
        "trace_render_available": trace_render_available,
        "source_trace_overlay_generated": source_trace_overlay_generated,
        "small_size_preview_sizes": small_preview_sizes,
        "small_size_diagnostics": {
            "preview_sizes": small_preview_sizes,
            "small_size_warning": (
                "16 px likely loses internal detail; a separate small-size variant may be needed later."
            ),
            "note": "Diagnostic only; no size variant or approval decision is created.",
        },
        "fallback_messages": fallback_messages,
        "outputs": {
            key: report_path(path) if path.exists() else None
            for key, path in paths.items()
            if key != "report"
        },
        "review_required": True,
    }
    paths["report"].write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def run(
    config_path: Path,
    validate_only: bool,
    matrix: bool = False,
    candidate_from_matrix: str | None = None,
) -> int:
    config_path = config_path.resolve()
    config = load_config(config_path)
    input_path = repository_path(config["input_image"])
    if not input_path.is_file():
        raise ConfigurationError(f"Input image does not exist: {input_path}")
    if matrix and not config.get("trace_matrix"):
        raise ConfigurationError("--matrix requires a non-empty trace_matrix in the configuration.")
    if candidate_from_matrix and not config.get("trace_matrix"):
        raise ConfigurationError(
            "--candidate-from-matrix requires a non-empty trace_matrix in the configuration."
        )
    if matrix and candidate_from_matrix:
        raise ConfigurationError("--matrix and --candidate-from-matrix cannot be combined.")
    if validate_only:
        print(f"Configuration is valid: {config_path}")
        print(f"Input image exists: {input_path}")
        return 0
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
    mask = build_mask(source, config["segmentation"], Image)
    cleaned = clean_mask(mask, config["cleanup"], ImageFilter)
    if candidate_from_matrix:
        package_matrix_candidate(
            config_path, config, candidate_from_matrix, source, cleaned, Image
        )
        return 0
    output_dir = repository_path(config["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    output_names = dict(config["outputs"])
    output_names.setdefault("review_board", f"{config['role']}-review-board.png")
    paths = {key: output_dir / value for key, value in output_names.items()}
    mask.save(paths["mask"])
    cleaned.save(paths["cleaned_mask"])
    save_overlay(source, cleaned, paths["overlay"], Image)
    trace = config.get("trace", DEFAULT_TRACE)
    trace_status, trace_message, trace_inverted_for_potrace, potrace_options_used = try_trace(
        cleaned, paths["trace"], output_dir, trace
    )
    trace_svg_analysis = analyze_trace_svg(paths["trace"], trace, potrace_options_used)
    trace_render, render_message = try_render_trace(paths["trace"], output_dir, source.size, Image)
    trace_comparison = compare_trace_to_mask(cleaned, trace_render)
    if trace_render is None:
        trace_comparison["unavailable_reason"] = render_message
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
        trace_svg_analysis,
        trace_comparison,
        trace_render is not None,
        source_trace_overlay_generated,
        small_preview_sizes,
        fallback_messages,
    )
    if matrix:
        total = source.width * source.height
        cleaned_foreground = sum(1 for value in cleaned.getdata() if value)
        run_trace_matrix(
            config_path,
            config,
            source,
            cleaned,
            output_dir,
            {
                "total_pixels": total,
                "cleaned_foreground_pixels": cleaned_foreground,
                "cleaned_foreground_ratio": round(cleaned_foreground / total, 8),
                "cleanup_changed_pixels": sum(
                    1 for before, after in zip(mask.getdata(), cleaned.getdata()) if before != after
                ),
            },
            Image,
            ImageDraw,
        )
        print(f"Trace matrix report and comparison board written to: {output_dir}")
    print(f"Artifacts written to: {output_dir}")
    if trace_status == "skipped":
        print(f"Vector trace skipped: {trace_message}")
    print("All generated artifacts are unapproved and require human review.")
    return 0


def main() -> int:
    args = parse_args()
    try:
        return run(
            args.config,
            args.validate_config,
            args.matrix,
            args.candidate_from_matrix,
        )
    except ConfigurationError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
