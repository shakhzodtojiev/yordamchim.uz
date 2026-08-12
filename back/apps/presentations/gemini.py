"""Google Gemini client for slide-outline generation.

Talks to Gemini through its OpenAI-compatible endpoint, so it reuses the same
prompt + JSON-parsing helpers as the OmniRoute client. Two keys are supported:
the free-tier key is tried first, and when its quota is exhausted (HTTP 429 /
RESOURCE_EXHAUSTED) the request transparently retries on the paid-tier key.
JSON mode (`response_format`) is requested so the model returns a clean object.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

# Shared prompt + parsing logic lives in the OmniRoute client — reuse it so the
# outline schema stays identical no matter which provider generated it.
from .omniroute import (
    OmniRouteError as LLMError,
    _SYSTEM_PROMPT,
    _build_user_prompt,
    _extract_json,
    _validate_outline,
)

logger = logging.getLogger("apps.presentations.gemini")


def _post_chat(api_key: str, messages: list[dict], *, timeout: int) -> tuple[str, str]:
    base = settings.GEMINI_BASE_URL.rstrip("/")
    url = f"{base}/chat/completions"
    payload = json.dumps(
        {
            "model": settings.GEMINI_MODEL,
            "messages": messages,
            "temperature": 0.7,
            # Force a JSON object back — eliminates the "no JSON found" failures
            # weaker gateways produced.
            "response_format": {"type": "json_object"},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMError("Gemini javobida kontent yo'q.") from exc
    return content, body.get("model", settings.GEMINI_MODEL)


def generate_outline(
    *,
    subject: str,
    grade: str,
    topic: str,
    num_slides: int,
    quarter: int | None = None,
) -> tuple[dict, str]:
    """Ask Gemini for a validated slide outline. Returns (outline, model_used).

    `model_used` is tagged with the tier that served it (e.g.
    "gemini:free:gemini-2.5-flash") so the job record shows which quota was hit.
    """
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": _build_user_prompt(
                subject=subject,
                grade=grade,
                topic=topic,
                num_slides=num_slides,
                quarter=quarter,
            ),
        },
    ]

    # Free first, paid as fallback. Skip empty keys so a single-key setup works.
    tiers = [("free", settings.GEMINI_API_KEY), ("paid", settings.GEMINI_API_KEY_PAID)]
    tiers = [(name, key) for name, key in tiers if key]
    if not tiers:
        raise LLMError("Gemini API kaliti sozlanmagan (GEMINI_API_KEY).")

    quota_error: LLMError | None = None
    for name, key in tiers:
        try:
            content, model = _post_chat(
                key, messages, timeout=settings.GEMINI_TIMEOUT_SECONDS
            )
            outline = _extract_json(content)
            _validate_outline(outline)
            return outline, f"gemini:{name}:{model}"
        except urllib.error.HTTPError as exc:
            # 429 = quota/rate limit exhausted for this tier — fall through to
            # the next key (paid). Anything else is a real error.
            if exc.code == 429:
                logger.warning(
                    "Gemini %s tier quota exhausted (429); trying next key", name
                )
                quota_error = LLMError("Gemini kvotasi tugadi (429).")
                continue
            detail = exc.read().decode("utf-8", "ignore")[:300]
            raise LLMError(f"Gemini xatosi {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise LLMError(f"Gemini'ga ulanib bo'lmadi: {exc}") from exc

    # Every configured tier was quota-exhausted.
    raise quota_error or LLMError("Gemini: barcha kalitlar kvotasi tugagan.")
