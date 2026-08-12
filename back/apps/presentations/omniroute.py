"""OmniRoute client — the LLM behind presentation generation.

OmniRoute is an OpenAI-compatible AI gateway (a local proxy that routes to
many providers with auto-fallback). We only need its `/chat/completions`
endpoint, so we talk to it with the stdlib rather than pulling in the OpenAI
SDK. The `auto` model lets OmniRoute pick the cheapest/fastest healthy
provider itself.

This module knows nothing about presentations beyond asking the model for a
slide outline and returning it as a validated dict.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger("apps.presentations.omniroute")


class OmniRouteError(RuntimeError):
    """Raised when the gateway is unreachable or returns something unusable."""


# The model is asked to return exactly this shape. Kept small on purpose:
# python-pptx renders title + bullets per slide; speaker notes ride along.
_SYSTEM_PROMPT = (
    "Siz tajribali o'zbek maktab o'qituvchisisiz va dizaynli dars taqdimoti "
    "tuzasiz. Javobni FAQAT to'g'ri JSON ko'rinishida qaytaring, boshqa hech "
    "qanday matn, izoh yoki markdown belgilarisiz. JSON sxemasi:\n"
    '{"title": string, "subtitle": string, "slides": [{'
    '"layout": "title" | "section" | "content" | "quote", '
    '"title": string, "bullets": [string, ...], "notes": string, '
    '"image_prompt": string}]}\n'
    "Qoidalar:\n"
    "- Matn (title/subtitle/bullets/notes) o'zbek tilida (lotin yozuvi, oddiy "
    "ASCII apostrof ').\n"
    "- image_prompt esa INGLIZCHA: slayd mazmuniga mos, matnsiz, illyustrativ "
    "rasm tavsifi (fotorealistik yoki toza illyustratsiya). Masalan: 'a clean "
    "vector illustration of fractions divided into equal parts, soft colors'.\n"
    "- layout: birinchi slayd 'title'; yirik bo'lim boshlanishi 'section'; "
    "odatiy slaydlar 'content'; muhim fikr/iqtibos uchun 'quote'.\n"
    "- 'content' slaydda 3-5 ta qisqa, aniq bullet. 'title'/'section'/'quote' "
    "da bullets bo'sh yoki 1-2 ta bo'lishi mumkin.\n"
    "- Bulletlarda raqamlash yoki '-' belgisi qo'ymang. Oxirgi slayd — xulosa."
)


def _build_user_prompt(
    *, subject: str, grade: str, topic: str, num_slides: int, quarter: int | None
) -> str:
    quarter_line = f"Chorak: {quarter}. " if quarter else ""
    return (
        f"Fan: {subject}. Sinf: {grade}. {quarter_line}"
        f"Mavzu: {topic}. "
        f"Aynan {num_slides} ta slayd tayyorlang."
    )


def _extract_json(content: str) -> dict:
    """Providers sometimes wrap JSON in ```json fences or add stray prose.
    Grab the outermost object and parse it, repairing minor LLM malformations
    (unescaped quotes, trailing commas, stray control chars) before giving up."""
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise OmniRouteError("Model javobida JSON topilmadi.")
    candidate = content[start : end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as exc:
        # LLM JSON is frequently *almost* valid — an unescaped quote inside a
        # bullet, a trailing comma. A tolerant repair recovers most of these
        # instead of failing (and refunding) the whole generation.
        try:
            from json_repair import repair_json

            repaired = repair_json(candidate)
            parsed = json.loads(repaired)
            if isinstance(parsed, dict):
                return parsed
        except Exception:  # noqa: BLE001 — fall through to the original error
            pass
        raise OmniRouteError(f"Model JSON'ini o'qib bo'lmadi: {exc}") from exc


def _post_chat(messages: list[dict], *, timeout: int) -> tuple[str, str]:
    """POST to the OpenAI-compatible endpoint. Returns (content, model_used)."""
    base = settings.OMNIROUTE_BASE_URL.rstrip("/")
    url = f"{base}/chat/completions"
    payload = json.dumps(
        {
            "model": settings.OMNIROUTE_MODEL,
            "messages": messages,
            "temperature": 0.7,
            # OmniRoute streams (SSE) by default; we want one JSON body with
            # choices[0].message.content, so opt out of streaming explicitly.
            "stream": False,
        }
    ).encode("utf-8")

    headers = {"Content-Type": "application/json"}
    if settings.OMNIROUTE_API_KEY:
        headers["Authorization"] = f"Bearer {settings.OMNIROUTE_API_KEY}"

    request = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise OmniRouteError(
            f"OmniRoute'ga ulanib bo'lmadi ({url}): {exc}"
        ) from exc
    except (ValueError, json.JSONDecodeError) as exc:
        raise OmniRouteError(f"OmniRoute javobi noto'g'ri: {exc}") from exc

    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise OmniRouteError("OmniRoute javobida kontent yo'q.") from exc
    model_used = body.get("model", settings.OMNIROUTE_MODEL)
    return content, model_used


def generate_outline(
    *,
    subject: str,
    grade: str,
    topic: str,
    num_slides: int,
    quarter: int | None = None,
) -> tuple[dict, str]:
    """Ask the model for a slide outline. Returns (outline, model_used).

    The outline is validated to the expected shape before returning so callers
    (the pptx builder) can trust it.
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
    content, model_used = _post_chat(
        messages, timeout=settings.OMNIROUTE_TIMEOUT_SECONDS
    )
    outline = _extract_json(content)
    _validate_outline(outline)
    return outline, model_used


def _validate_outline(outline: dict) -> None:
    if not isinstance(outline, dict) or not isinstance(outline.get("slides"), list):
        raise OmniRouteError("Outline sxemasi noto'g'ri: 'slides' ro'yxati yo'q.")
    if not outline["slides"]:
        raise OmniRouteError("Model birorta slayd qaytarmadi.")
    for slide in outline["slides"]:
        if not isinstance(slide, dict) or "title" not in slide:
            raise OmniRouteError("Slayd sxemasi noto'g'ri: 'title' yo'q.")
