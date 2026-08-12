"""AI image generation for slides — Google Gemini image models.

Uses the Gemini `:generateContent` image models (e.g. gemini-2.5-flash-image)
rather than the Imagen `:predict` endpoint, which is closed to new API keys.
The model returns an inline image part which we base64-decode.

Best-effort by design: any failure (no key, quota, API error) returns None and
the deck builder falls back to a text-only layout. Image generation needs a
billing-enabled key, so the paid Gemini key is tried first, then the free key.
"""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger("apps.presentations.imagegen")

# Layouts whose design actually places an image — don't spend on the rest.
_IMAGE_LAYOUTS = {"title", "content"}


def _keys() -> list[str]:
    # Paid first (image gen is billed), free as a long shot.
    return [k for k in (settings.GEMINI_API_KEY_PAID, settings.GEMINI_API_KEY) if k]


def _extract_inline_image(body: dict) -> bytes | None:
    candidates = body.get("candidates") or []
    for cand in candidates:
        for part in (cand.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"])
    return None


def generate_image(prompt: str) -> bytes | None:
    if not (getattr(settings, "GENERATE_IMAGES", True) and prompt):
        return None
    keys = _keys()
    if not keys:
        return None

    model = settings.GEMINI_IMAGE_MODEL
    # A light directive biases the model toward returning an image.
    body = json.dumps(
        {
            "contents": [
                {"parts": [{"text": f"Generate a high-quality illustration. {prompt}"}]}
            ]
        }
    ).encode("utf-8")

    for key in keys:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={key}"
        )
        request = urllib.request.Request(
            url, data=body, headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(
                request, timeout=settings.GEMINI_TIMEOUT_SECONDS
            ) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            image = _extract_inline_image(data)
            if image:
                return image
            logger.warning("Image model returned no inline image for: %.50s", prompt)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "ignore")[:200]
            logger.warning("Image HTTP %s (%s...): %s", exc.code, key[:6], detail)
            continue  # 429/403 on this key — try the next
        except Exception as exc:  # noqa: BLE001 — best-effort, never fatal
            logger.warning("Image call failed: %s", exc)
            continue
    return None


def generate_images_for_outline(outline: dict) -> list[bytes | None]:
    """One image per slide (aligned by index); None where not applicable."""
    results: list[bytes | None] = []
    for idx, entry in enumerate(outline.get("slides") or []):
        layout = (entry.get("layout") or "content").lower()
        prompt = entry.get("image_prompt")
        uses_image = layout in _IMAGE_LAYOUTS or idx == 0
        results.append(generate_image(prompt) if (uses_image and prompt) else None)
    return results
