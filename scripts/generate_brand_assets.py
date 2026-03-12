import math
from pathlib import Path

from PIL import Image, ImageDraw


NAVY = "#1F3346"
IVORY = "#E8DEC7"
BLACK = "#000000"
WHITE = "#FFFFFF"

ROOT = Path(__file__).resolve().parents[1]
BRAND_DIR = ROOT / "public" / "brand"
APP_DIR = ROOT / "src" / "app"


def create_symbol_svg(path: Path, fg: str = NAVY, bg: str | None = None, size: int = 512, center_ratio: float = 0.18, segments: int = 8) -> None:
    radius = size / 2
    cx = cy = radius
    inner = radius * center_ratio
    outer = radius * 0.92

    paths: list[str] = []
    for i in range(segments):
        a0 = (i / segments) * 2 * math.pi + 0.05
        a1 = ((i + 1) / segments) * 2 * math.pi - 0.05

        x1 = cx + inner * math.cos(a0)
        y1 = cy + inner * math.sin(a0)
        x2 = cx + outer * math.cos(a0)
        y2 = cy + outer * math.sin(a0)
        x3 = cx + outer * math.cos(a1)
        y3 = cy + outer * math.sin(a1)
        x4 = cx + inner * math.cos(a1)
        y4 = cy + inner * math.sin(a1)

        d = (
            f"M{x1},{y1} L{x2},{y2} "
            f"A{outer},{outer} 0 0 1 {x3},{y3} "
            f"L{x4},{y4} "
            f"A{inner},{inner} 0 0 0 {x1},{y1} Z"
        )
        paths.append(f'<path d="{d}" fill="{fg}"/>')

    center_fill = IVORY if fg != WHITE else WHITE
    center = f'<circle cx="{cx}" cy="{cy}" r="{inner * 0.9}" fill="{center_fill}"/>'

    bg_rect = ""
    if bg:
        bg_rect = f'<rect width="100%" height="100%" fill="{bg}"/>'

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 {size} {size}">\n'
        f"{bg_rect}\n"
        f'{"".join(paths)}\n'
        f"{center}\n"
        "</svg>\n"
    )
    path.write_text(svg, encoding="utf-8")


def create_horizontal_svg(path: Path, fg: str = NAVY, bg: str | None = None) -> None:
    width, height = 1200, 400
    temp_symbol = BRAND_DIR / "_temp_symbol.svg"
    create_symbol_svg(temp_symbol, fg=fg, bg=None, size=320)
    symbol = temp_symbol.read_text(encoding="utf-8")
    symbol = symbol.replace('width="320" height="320"', 'width="220" height="220" x="60" y="90"')

    bg_rect = ""
    if bg:
        bg_rect = f'<rect width="100%" height="100%" fill="{bg}"/>'

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">\n'
        f"{bg_rect}\n"
        f"{symbol}\n"
        f'<text x="340" y="230" font-size="120" font-family="Helvetica,Arial,sans-serif" '
        f'fill="{fg}" letter-spacing="6">ROUND TABLE</text>\n'
        "</svg>\n"
    )
    path.write_text(svg, encoding="utf-8")
    temp_symbol.unlink(missing_ok=True)


def create_png(size: int, path: Path) -> None:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    cx = cy = size / 2
    outer = size * 0.46
    inner = size * 0.18

    for i in range(8):
        a0 = (i / 8) * 2 * math.pi + 0.15
        a1 = ((i + 1) / 8) * 2 * math.pi - 0.15
        x2 = cx + outer * math.cos(a0)
        y2 = cy + outer * math.sin(a0)
        x3 = cx + outer * math.cos(a1)
        y3 = cy + outer * math.sin(a1)
        x1 = cx + inner * math.cos(a0)
        y1 = cy + inner * math.sin(a0)
        x4 = cx + inner * math.cos(a1)
        y4 = cy + inner * math.sin(a1)
        draw.polygon([(x1, y1), (x2, y2), (x3, y3), (x4, y4)], fill=NAVY)

    draw.ellipse((cx - inner * 0.9, cy - inner * 0.9, cx + inner * 0.9, cy + inner * 0.9), fill=IVORY)
    image.save(path)


def main() -> None:
    BRAND_DIR.mkdir(parents=True, exist_ok=True)

    create_horizontal_svg(BRAND_DIR / "round-table-logo-horizontal.svg", NAVY)
    create_horizontal_svg(BRAND_DIR / "round-table-logo-horizontal-dark.svg", IVORY, NAVY)

    create_symbol_svg(BRAND_DIR / "round-table-symbol.svg", NAVY)
    create_symbol_svg(BRAND_DIR / "round-table-symbol-dark.svg", IVORY, NAVY)

    create_horizontal_svg(BRAND_DIR / "round-table-logo-monochrome-black.svg", BLACK)
    create_horizontal_svg(BRAND_DIR / "round-table-logo-monochrome-white.svg", WHITE, BLACK)

    create_symbol_svg(BRAND_DIR / "round-table-app-icon-light.svg", NAVY)
    create_symbol_svg(BRAND_DIR / "round-table-app-icon.svg", IVORY, NAVY)
    create_symbol_svg(BRAND_DIR / "round-table-favicon.svg", NAVY)

    png_sizes = {
        "round-table-favicon-16.png": 16,
        "round-table-favicon-32.png": 32,
        "round-table-favicon-64.png": 64,
        "round-table-app-icon-128.png": 128,
        "round-table-apple-touch-icon.png": 180,
        "round-table-app-icon-192.png": 192,
        "round-table-app-icon-512.png": 512,
    }
    for filename, size in png_sizes.items():
        create_png(size, BRAND_DIR / filename)

    icon_path = APP_DIR / "favicon.ico"
    icon_source = BRAND_DIR / "round-table-favicon-32.png"
    image = Image.open(icon_source)
    image.save(icon_path, format="ICO", sizes=[(16, 16), (32, 32)])

    app_icon_svg = BRAND_DIR / "round-table-favicon.svg"
    (APP_DIR / "icon.svg").write_text(app_icon_svg.read_text(encoding="utf-8"), encoding="utf-8")


if __name__ == "__main__":
    main()
