"""Provider-agnostic entry point for slide-outline generation.

`LLM_PROVIDER` selects the backend at runtime — "gemini" (default) or
"omniroute". Both return the same `(outline, model_used)` shape, so the rest of
the pipeline (python-pptx build, rasterisation) never changes.
"""

from __future__ import annotations

from django.conf import settings

from . import claude, gemini, omniroute


def generate_outline(**kwargs) -> tuple[dict, str]:
    provider = (settings.LLM_PROVIDER or "gemini").lower()
    if provider == "gemini":
        return gemini.generate_outline(**kwargs)
    if provider == "claude":
        return claude.generate_outline(**kwargs)
    if provider == "omniroute":
        return omniroute.generate_outline(**kwargs)
    raise omniroute.OmniRouteError(f"Noma'lum LLM_PROVIDER: {provider}")
