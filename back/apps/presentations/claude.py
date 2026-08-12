"""Anthropic Claude client for slide-outline generation.

Uses the official `anthropic` SDK (not an OpenAI-compatible shim). Claude
follows the "return only JSON" instruction reliably, so the shared
`_extract_json` + `_validate_outline` helpers parse its reply directly.

The `anthropic` import is lazy so this module (and the provider dispatcher)
loads even where the package isn't installed — it's only needed when Claude is
the selected provider.
"""

from __future__ import annotations

import logging

from django.conf import settings

from .omniroute import (
    OmniRouteError as LLMError,
    _SYSTEM_PROMPT,
    _build_user_prompt,
    _extract_json,
    _validate_outline,
)

logger = logging.getLogger("apps.presentations.claude")


def generate_outline(
    *,
    subject: str,
    grade: str,
    topic: str,
    num_slides: int,
    quarter: int | None = None,
) -> tuple[dict, str]:
    if not settings.CLAUDE_API_KEY:
        raise LLMError("Claude API kaliti sozlanmagan (ANTHROPIC_API_KEY).")

    import anthropic  # lazy — only required when Claude is the provider

    client = anthropic.Anthropic(
        api_key=settings.CLAUDE_API_KEY,
        timeout=float(settings.CLAUDE_TIMEOUT_SECONDS),
    )
    user_prompt = _build_user_prompt(
        subject=subject,
        grade=grade,
        topic=topic,
        num_slides=num_slides,
        quarter=quarter,
    )

    try:
        response = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=16000,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.APIError as exc:
        raise LLMError(f"Claude xatosi: {exc}") from exc

    if getattr(response, "stop_reason", None) == "refusal":
        raise LLMError("Claude so'rovni rad etdi (refusal).")

    content = "".join(
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text"
    )
    if not content.strip():
        raise LLMError("Claude javobi bo'sh.")

    outline = _extract_json(content)
    _validate_outline(outline)
    return outline, f"claude:{getattr(response, 'model', settings.CLAUDE_MODEL)}"
