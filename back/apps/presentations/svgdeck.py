"""Build a styled slide deck as per-slide SVG strings.

Input: a validated outline (title + slides[{title, bullets, notes, layout?}])
plus the subject name (chooses the colour theme). Output: one SVG string per
slide, ready for `svgrender` to rasterise into protected Slide PNGs.

Design system: a 16:9 canvas drawn in a 1280x720 coordinate space (emitted at
1920x1080 for crisp rasterising). Layouts — title, section, content, quote —
share a subject palette (`themes`), Lucide bullet icons and a Popsy hero
illustration (`assetlib`). No AI images: imagery is picked from bullet/topic
text, so a deck stays at one LLM call.
"""

from __future__ import annotations

from html import escape

from . import assetlib, themes

# Coordinate space (content authored here); emitted 1.5x for raster crispness.
_VW, _VH = 1280, 720
_OUT_W, _OUT_H = 1920, 1080
_ML = 84  # left margin


def _esc(text: str) -> str:
    return escape(str(text), quote=True)


def _wrap(text: str, max_chars: int) -> list[str]:
    """Greedy word-wrap to at most `max_chars` per line."""
    words = str(text).split()
    lines: list[str] = []
    cur = ""
    for w in words:
        if not cur:
            cur = w
        elif len(cur) + 1 + len(w) <= max_chars:
            cur += " " + w
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def _text(x, y, text, *, size, color, weight="normal", italic=False,
          anchor="start", family="Liberation Sans, DejaVu Sans, sans-serif"):
    style = f'font-weight="{weight}"'
    if italic:
        style += ' font-style="italic"'
    return (
        f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" '
        f'text-anchor="{anchor}" {style}>{_esc(text)}</text>'
    )


def _text_block(x, y, lines, *, size, color, weight="normal", line_h=None,
                anchor="start"):
    """Multi-line text; `y` is the baseline of the first line."""
    line_h = line_h or size * 1.28
    parts = [
        f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" '
        f'text-anchor="{anchor}" font-weight="{weight}">'
    ]
    for i, line in enumerate(lines):
        dy = 0 if i == 0 else line_h
        parts.append(f'<tspan x="{x}" dy="{dy}">{_esc(line)}</tspan>')
    parts.append("</text>")
    return "".join(parts)


def _rect(x, y, w, h, color, *, rx=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{color}"/>'


def _open(bg: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{_OUT_W}" '
        f'height="{_OUT_H}" viewBox="0 0 {_VW} {_VH}" '
        f'font-family="Liberation Sans, DejaVu Sans, sans-serif">'
        f'{_rect(0, 0, _VW, _VH, bg)}'
    )


def _footer(deck_title, index, total, pal):
    return (
        _text(_ML, 694, deck_title, size=15, color="#94A3B8")
        + _text(_VW - _ML, 694, f"{index} / {total}", size=15,
                color="#94A3B8", anchor="end")
    )


# --------------------------------------------------------------------------
# layouts
# --------------------------------------------------------------------------
def _title_slide(title, subtitle, illus, pal) -> str:
    s = _open(pal["primary"])
    if illus:
        s += _rect(812, 150, 384, 420, "#FFFFFF", rx=28)
        s += assetlib.illustration_svg(
            illus, pal["ill_light"], pal["ill_dark"], 840, 180, 328, 360
        )
    s += _rect(_ML, 250, 104, 12, pal["accent"], rx=6)
    for i, line in enumerate(_wrap(title, 22)):
        s += _text(_ML, 340 + i * 66, line, size=54, color="#FFFFFF", weight="bold")
    if subtitle:
        s += _text(_ML, 540, subtitle, size=22, color="#C7D2E0")
    return s + "</svg>"


def _section_slide(title, illus, pal) -> str:
    s = _open(pal["surface"])
    s += _rect(0, 0, 16, _VH, pal["accent"])
    if illus:
        s += assetlib.illustration_svg(
            illus, pal["ill_light"], pal["ill_dark"], 800, 190, 340, 340
        )
    lines = _wrap(title, 20)
    y0 = _VH / 2 - (len(lines) - 1) * 30
    s += _text_block(96, y0, lines, size=48, color=pal["primary"], weight="bold")
    return s + "</svg>"


def _quote_slide(title, bullets, pal) -> str:
    s = _open(pal["surface"])
    s += _text(70, 300, "“", size=170, color=pal["accent"], weight="bold")
    lines = _wrap(title, 46)
    s += _text_block(150, 330, lines, size=32, color=pal["ink"], weight="normal")
    if bullets:
        s += _text(150, 560, f"— {bullets[0]}", size=20,
                   color=pal["primary"], weight="bold")
    return s + "</svg>"


def _content_slide(title, bullets, pal, deck_title, index, total, panel_icon) -> str:
    s = _open("#FFFFFF")
    # header: accent tab + title + divider
    s += _rect(_ML, 66, 92, 12, pal["accent"], rx=6)
    for i, line in enumerate(_wrap(title, 40)):
        s += _text(_ML, 128 + i * 44, line, size=34, color=pal["primary"], weight="bold")
    s += _rect(_ML, 168, _VW - 2 * _ML, 2, "#E2E8F0")

    # right panel: subject signature icon (consistent per deck)
    s += _rect(966, 214, 230, 430, pal["surface"], rx=22)
    s += _circle_icon(1081, 380, 58, panel_icon, pal["accent"])

    # bullets with per-bullet icons, adaptive spacing
    bullets = bullets[:6] or [title]
    top, bottom = 214, 648
    n = len(bullets)
    row_h = min(104, (bottom - top) / max(n, 1))
    icon_r = 26 if row_h >= 84 else 20
    text_size = 21 if n <= 4 else 18
    for i, b in enumerate(bullets):
        cy = top + row_h * i + row_h / 2
        icon = assetlib.bullet_icon_inner(b, i)
        s += _circle_icon(_ML + icon_r, cy, icon_r, icon, pal["accent"],
                          bg=pal["surface"])
        lines = _wrap(b, 52 if n <= 4 else 58)[:2]
        ty = cy - (len(lines) - 1) * (text_size * 0.62) + text_size * 0.34
        s += _text_block(_ML + icon_r * 2 + 26, ty, lines, size=text_size,
                         color=pal["ink"], line_h=text_size * 1.2)
    s += _footer(deck_title, index, total, pal)
    return s + "</svg>"


def _circle_icon(cx, cy, r, icon_inner_name, color, *, bg=None) -> str:
    """A theme circle with a centred icon (icon sized ~1.1r)."""
    parts = []
    if bg:
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{bg}"/>')
    size = r * 1.15
    parts.append(
        assetlib.icon_group(icon_inner_name, color, cx - size / 2, cy - size / 2,
                            size, stroke=2.2)
    )
    return "".join(parts)


# --------------------------------------------------------------------------
# public API
# --------------------------------------------------------------------------
def build_slide_svgs(outline: dict, subject_name: str | None,
                     topic: str | None = None) -> list[str]:
    pal = themes.theme_for(subject_name)
    slides = outline.get("slides") or []
    total = len(slides)
    deck_title = outline.get("title") or (topic or "Taqdimot")
    subtitle = outline.get("subtitle") or ""
    hero = assetlib.illustration_name(subject_name, topic or deck_title)
    panel_icon = assetlib.subject_icon(subject_name)

    svgs: list[str] = []
    for idx, entry in enumerate(slides):
        layout = (entry.get("layout") or "").lower()
        title = str(entry.get("title", ""))
        bullets = [str(b) for b in (entry.get("bullets") or [])]

        if idx == 0 or layout == "title":
            svgs.append(_title_slide(title or deck_title, subtitle or
                                     (subject_name or ""), hero, pal))
        elif layout == "section":
            svgs.append(_section_slide(title, hero, pal))
        elif layout == "quote":
            svgs.append(_quote_slide(title, bullets, pal))
        else:
            svgs.append(_content_slide(title, bullets, pal, deck_title,
                                       idx + 1, total, panel_icon))
    return svgs
