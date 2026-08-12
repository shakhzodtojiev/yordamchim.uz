"""Per-subject colour themes for generated slide decks.

Each subject maps to a small palette. The SVG deck builder (`svgdeck`) reads
these to colour headers, accent bars, bullet markers, and to recolour the
Popsy hero illustration (its two green accents are swapped for `ill_light` /
`ill_dark`).

Subject lookup is by case-insensitive substring so minor naming variants
("Ingliz tili" vs "Ingliz") still resolve. Unknown subjects fall back to
DEFAULT (the original deep-blue brand palette).
"""

from __future__ import annotations

# Shared neutrals — same across every theme for a consistent reading feel.
_INK = "#0F172A"      # near-black body text
_MUTED = "#64748B"    # captions / footer
_BG = "#FFFFFF"       # slide background


def _theme(primary, accent, surface, ill_light, ill_dark):
    return {
        "primary": primary,      # headers, title-slide background
        "accent": accent,        # accent bars, bullet markers, icon tint
        "surface": surface,      # light panels, section/quote backgrounds
        "ink": _INK,
        "muted": _MUTED,
        "bg": _BG,
        # Injected into the hero illustration (replaces Popsy's #42E670/#07AA50).
        "ill_light": ill_light,
        "ill_dark": ill_dark,
    }


# Keyed by a lowercase substring of the subject name.
_THEMES: dict[str, dict] = {
    "adabiyot":   _theme("#9F1239", "#E11D48", "#FFF1F2", "#FB7185", "#E11D48"),
    "biologiya":  _theme("#15803D", "#22C55E", "#F0FDF4", "#4ADE80", "#16A34A"),
    "fizika":     _theme("#3730A3", "#6366F1", "#EEF2FF", "#818CF8", "#4F46E5"),
    "geografiya": _theme("#065F46", "#10B981", "#ECFDF5", "#34D399", "#059669"),
    "informatika":_theme("#155E75", "#06B6D4", "#ECFEFF", "#22D3EE", "#0891B2"),
    "ingliz":     _theme("#6D28D9", "#8B5CF6", "#F5F3FF", "#A78BFA", "#7C3AED"),
    "kimyo":      _theme("#86198F", "#C026D3", "#FDF4FF", "#E879F9", "#A21CAF"),
    "matematika": _theme("#1D4ED8", "#3B82F6", "#EFF6FF", "#60A5FA", "#2563EB"),
    "ona tili":   _theme("#C2410C", "#F97316", "#FFF7ED", "#FB923C", "#EA580C"),
    "tarix":      _theme("#92400E", "#D97706", "#FFFBEB", "#FBBF24", "#B45309"),
}

DEFAULT = _theme("#0F4C81", "#F6A609", "#F1F5F9", "#F6A609", "#D98D07")


def theme_for(subject_name: str | None) -> dict:
    """Return the palette for a subject, matching by lowercase substring."""
    if subject_name:
        key = subject_name.strip().lower()
        for needle, palette in _THEMES.items():
            if needle in key:
                return palette
    return DEFAULT
