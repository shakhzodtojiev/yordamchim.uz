"""Local visual assets for generated decks — zero network at render time.

Two bundled sets under ./assets:
  * icons/        Lucide stroke icons (ISC). Recoloured per theme at render.
  * illustrations/ Popsy hero illustrations (free). Green accents swapped for
                   the active theme via `#42E670`/`#07AA50` replacement.

Everything here is filesystem-only: the AI produces the outline text, but the
imagery is picked server-side (keyword heuristics), so a deck costs exactly one
LLM call and no image API. See `themes` for palettes and `svgdeck` for layout.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

_ASSETS = Path(__file__).resolve().parent / "assets"
_ICONS = _ASSETS / "icons"
_ILLUS = _ASSETS / "illustrations"

# Popsy's two green accents — replaced with the theme's ill_light / ill_dark.
_POPSY_LIGHT = "#42E670"
_POPSY_DARK = "#07AA50"

_SVG_OPEN_RE = re.compile(r"<svg[^>]*>", re.IGNORECASE)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)


# --------------------------------------------------------------------------
# icons
# --------------------------------------------------------------------------
@lru_cache(maxsize=256)
def _icon_inner(name: str) -> str | None:
    """Inner markup (paths) of a Lucide icon, viewBox 0 0 24 24. None if absent."""
    path = _ICONS / f"{name}.svg"
    if not path.is_file():
        return None
    raw = _COMMENT_RE.sub("", path.read_text(encoding="utf-8"))
    # Strip the outer <svg ...> / </svg> — we supply our own coloured wrapper.
    inner = _SVG_OPEN_RE.sub("", raw, count=1)
    inner = inner.replace("</svg>", "")
    return inner.strip()


def has_icon(name: str) -> bool:
    return _icon_inner(name) is not None


def icon_group(name: str, color: str, x: float, y: float, size: float,
               *, stroke: float = 2.0) -> str:
    """A positioned, coloured icon as a nested <svg> (24x24 viewBox scaled).

    Returns "" when the icon name is unknown so callers can no-op safely.
    """
    inner = _icon_inner(name)
    if inner is None:
        return ""
    return (
        f'<svg x="{x}" y="{y}" width="{size}" height="{size}" '
        f'viewBox="0 0 24 24" fill="none" stroke="{color}" '
        f'stroke-width="{stroke}" stroke-linecap="round" '
        f'stroke-linejoin="round">{inner}</svg>'
    )


# Keyword -> icon. Keys are lowercase substrings searched in bullet text
# (Uzbek + a few English). First match wins; order is broad-to-specific-safe.
_KEYWORD_ICONS: list[tuple[tuple[str, ...], str]] = [
    (("quyosh", "yorug", "nur", "sun", "light"), "sun"),
    (("suv", "namlik", "water", "h2o"), "droplet"),
    (("havo", "shamol", "gaz", "kislorod", "co2", "air", "wind"), "wind"),
    (("energiya", "quvvat", "kuch", "energy", "power"), "zap"),
    (("issiq", "harorat", "temperatura", "heat", "temp"), "thermometer"),
    (("sovuq", "muz", "qor", "cold", "ice", "snow"), "snowflake"),
    (("olov", "yong", "yonish", "fire", "flame"), "flame"),
    (("barg", "o'simlik", "usimlik", "gul", "plant", "leaf", "xlorofill",
      "pigment", "fotosintez"), "leaf"),
    (("urug", "nihol", "seed", "sprout"), "sprout"),
    (("hayvon", "jonzot", "hasharot", "animal", "bug"), "bug"),
    (("baliq", "dengiz", "fish", "sea", "ocean"), "fish"),
    (("qush", "parranda", "bird"), "bird"),
    (("atom", "molekula", "zarra", "atom", "molecule"), "atom"),
    (("kimyo", "reaksiya", "modda", "chemical", "chemistry"), "flask-conical"),
    (("tajriba", "sinov", "experiment", "test"), "test-tube"),
    (("dna", "gen", "hujayra", "cell"), "dna"),
    (("mikrob", "bakteriya", "microscope"), "microscope"),
    (("magnit", "magnet"), "magnet"),
    (("kosmos", "raketa", "sayyora", "space", "rocket", "planet"), "rocket"),
    (("yer", "dunyo", "global", "earth", "world", "globe"), "globe"),
    (("xarita", "hudud", "map", "region"), "map"),
    (("tog", "relef", "mountain"), "mountain"),
    (("yo'nalish", "kompas", "compass", "direction"), "compass"),
    (("kitob", "matn", "asar", "book", "text"), "book-open"),
    (("maktab", "ta'lim", "o'qish", "school", "education", "study"), "graduation-cap"),
    (("yozuv", "yozish", "qalam", "write", "pen", "pencil"), "pencil"),
    (("o'lchov", "o'lcham", "ruler", "measure"), "ruler"),
    (("hisob", "son", "raqam", "matematik", "number", "count", "calc"), "calculator"),
    (("yig'indi", "summa", "sum", "sigma"), "sigma"),
    (("foiz", "percent"), "percent"),
    (("qo'shish", "plus", "add"), "plus"),
    (("ayirish", "minus", "subtract"), "minus"),
    (("bo'lish", "divide"), "divide"),
    (("shakl", "geometr", "shape", "figure"), "shapes"),
    (("uchburchak", "triangle"), "triangle"),
    (("aylana", "doira", "circle"), "circle"),
    (("kvadrat", "square"), "square"),
    (("vaqt", "soat", "davr", "time", "clock"), "clock"),
    (("sana", "kun", "yil", "date", "calendar", "day", "year"), "calendar"),
    (("yulduz", "star"), "star"),
    (("yurak", "sevgi", "heart", "love"), "heart"),
    (("miya", "fikr", "aql", "brain", "think"), "brain"),
    (("g'oya", "kashfiyot", "idea", "lightbulb", "innovation"), "lightbulb"),
    (("maqsad", "nishon", "goal", "target", "aim"), "target"),
    (("bayroq", "davlat", "flag", "country"), "flag"),
    (("g'alaba", "yutuq", "mukofot", "win", "trophy", "award"), "trophy"),
    (("odam", "jamiyat", "guruh", "people", "society", "team"), "users"),
    (("musiqa", "kuy", "music", "song"), "music"),
    (("ovoz", "nutq", "voice", "speech", "mic"), "mic"),
    (("rang", "bo'yoq", "san'at", "color", "paint", "art"), "palette"),
    (("rasm", "surat", "foto", "image", "photo"), "image"),
    (("dastur", "kod", "kompyuter", "program", "code", "computer"), "code"),
    (("ma'lumot", "baza", "data", "database"), "database"),
    (("pul", "iqtisod", "savdo", "money", "economy", "trade", "coin"), "coins"),
    (("tarix", "o'tmish", "history", "past", "ancient"), "landmark"),
    (("qonun", "adolat", "law", "justice", "balance"), "scale"),
    (("til", "so'z", "grammatika", "language", "word", "grammar"), "languages"),
    (("o'sish", "rivoj", "grow", "increase", "trend"), "trending-up"),
    (("statistika", "grafik", "chart", "statistic", "graph"), "chart-bar"),
]

# Rotated for bullets with no keyword hit — keeps rows visually distinct
# without implying a wrong meaning.
_FALLBACK_ICONS = ["check-circle", "star", "target", "info", "layers", "list"]

_STRIP = ".,;:!?()[]{}\"'`«»—–-…"


def _words(text: str) -> list[str]:
    return [w.strip(_STRIP) for w in (text or "").lower().split()]


def bullet_icon_inner(text: str, index: int) -> str:
    """Icon name resolved from a bullet's text, or a rotating fallback.

    Matches on WORD START (not raw substring) so short English needles like
    "art" don't fire inside Uzbek words ("shARTlar"); Uzbek suffixes still
    match via prefix ("suv" -> "suvni", "suvdan").
    """
    words = _words(text)
    for needles, icon in _KEYWORD_ICONS:
        for n in needles:
            if any(w == n or w.startswith(n) for w in words):
                if has_icon(icon):
                    return icon
                break
    fb = _FALLBACK_ICONS[index % len(_FALLBACK_ICONS)]
    return fb if has_icon(fb) else "circle"


# Subject -> signature icon, shown in the content-slide side panel.
_SUBJECT_ICON = {
    "adabiyot": "book-open",
    "biologiya": "leaf",
    "fizika": "atom",
    "geografiya": "globe",
    "informatika": "cpu",
    "ingliz": "languages",
    "kimyo": "flask-conical",
    "matematika": "calculator",
    "ona tili": "book",
    "tarix": "landmark",
}


def subject_icon(subject_name: str | None) -> str:
    """Signature icon for a subject (leaf for Biologiya, atom for Fizika, ...)."""
    if subject_name:
        key = subject_name.strip().lower()
        for needle, icon in _SUBJECT_ICON.items():
            if needle in key and has_icon(icon):
                return icon
    return "lightbulb" if has_icon("lightbulb") else "star"


# --------------------------------------------------------------------------
# illustrations
# --------------------------------------------------------------------------
_AVAILABLE_ILLUS: set[str] | None = None


def _illus_names() -> set[str]:
    global _AVAILABLE_ILLUS
    if _AVAILABLE_ILLUS is None:
        _AVAILABLE_ILLUS = {p.stem for p in _ILLUS.glob("*.svg")} if _ILLUS.is_dir() else set()
    return _AVAILABLE_ILLUS


# Subject -> preferred illustration (best fit from the bundled set).
_SUBJECT_ILLUS = {
    "informatika": "man-with-a-laptop",
    "matematika": "taking-notes",
    "fizika": "man-riding-a-rocket",
    "adabiyot": "taking-notes",
    "ona tili": "communication",
    "ingliz": "communication",
    "tarix": "presentation",
    "geografiya": "man-riding-a-rocket",
}

# Topic-keyword -> illustration, checked before the subject default.
_TOPIC_ILLUS: list[tuple[tuple[str, ...], str]] = [
    (("kosmos", "raketa", "sayyora", "space", "rocket"), "man-riding-a-rocket"),
    (("kompyuter", "dastur", "internet", "computer", "laptop"), "man-with-a-laptop"),
    (("muloqot", "til", "suhbat", "communication", "language"), "communication"),
    (("taqdimot", "ma'ruza", "presentation"), "presentation"),
    (("yutuq", "muvaffaqiyat", "success", "achieve"), "success"),
]

_DEFAULT_ILLUS = "woman-with-a-laptop"


def illustration_name(subject_name: str | None, topic: str | None) -> str | None:
    """Pick a bundled illustration by topic keyword, else subject, else default."""
    names = _illus_names()
    if not names:
        return None
    low = (topic or "").lower()
    for needles, ill in _TOPIC_ILLUS:
        if ill in names and any(n in low for n in needles):
            return ill
    if subject_name:
        skey = subject_name.strip().lower()
        for needle, ill in _SUBJECT_ILLUS.items():
            if needle in skey and ill in names:
                return ill
    return _DEFAULT_ILLUS if _DEFAULT_ILLUS in names else next(iter(names))


def illustration_svg(name: str, ill_light: str, ill_dark: str,
                     x: float, y: float, w: float, h: float) -> str:
    """A recoloured, positioned Popsy illustration as a nested <svg>.

    Returns "" when the illustration is missing.
    """
    path = _ILLUS / f"{name}.svg"
    if not path.is_file():
        return ""
    raw = _COMMENT_RE.sub("", path.read_text(encoding="utf-8"))
    # Swap Popsy's green accents (either case) for the theme accents.
    for popsy in (_POPSY_LIGHT, _POPSY_LIGHT.lower()):
        raw = raw.replace(popsy, ill_light)
    for popsy in (_POPSY_DARK, _POPSY_DARK.lower()):
        raw = raw.replace(popsy, ill_dark)
    # Re-point the root <svg> at our slide coordinates (viewBox stays 960x960).
    positioned = _SVG_OPEN_RE.sub(
        f'<svg x="{x}" y="{y}" width="{w}" height="{h}" '
        f'viewBox="0 0 960 960" preserveAspectRatio="xMidYMid meet">',
        raw,
        count=1,
    )
    return positioned.strip()
