"""Rasterise per-slide SVG strings into protected Slide PNGs.

The generation pipeline builds each slide as an SVG (`svgdeck`); this module
turns them into PNGs with LibreOffice headless and persists them as Slide rows
— the same protected-image model as admin PPTX uploads, so the viewer and
signed-URL security are unchanged. No .pptx is produced or stored.

Reuses `conversion`'s subprocess helpers so the two rasterising paths share
the same error handling.
"""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import transaction

from .conversion import ConversionError, _run, _which
from .models import Presentation, Slide

logger = logging.getLogger(__name__)


@transaction.atomic
def render_svgs_to_slides(presentation: Presentation, svgs: list[str]) -> int:
    """Rasterise `svgs` (one per slide) into ordered Slide rows. Returns count.

    Replaces any existing slides — a re-render should not mix old + new pages.
    """
    if not svgs:
        raise ConversionError("Render uchun SVG slaydlar yo'q.")

    soffice = _which("soffice")

    with tempfile.TemporaryDirectory(prefix="yordamchim-svg-") as work_dir:
        work = Path(work_dir)
        profile = work / "lo-profile"

        inputs = []
        for i, svg in enumerate(svgs, start=1):
            p = work / f"slide-{i:03d}.svg"
            p.write_text(svg, encoding="utf-8")
            inputs.append(str(p))

        # One LibreOffice call converts every SVG -> its own PNG. `-env:` isolates
        # the user profile so concurrent generations don't fight over locks.
        _run(
            [
                soffice,
                f"-env:UserInstallation=file://{profile}",
                "--headless",
                "--norestore",
                "--nologo",
                "--convert-to",
                "png",
                "--outdir",
                str(work),
                *inputs,
            ],
            cwd=work,
            timeout=240,
        )

        pages = sorted(work.glob("slide-*.png"))
        if not pages:
            raise ConversionError("SVG'dan rasm chiqarib bo'lmadi.")
        if len(pages) != len(svgs):
            logger.warning(
                "SVG render: %s SVG kiritildi, %s PNG chiqdi", len(svgs), len(pages)
            )

        presentation.slides.all().delete()
        for idx, page in enumerate(pages, start=1):
            content = page.read_bytes()
            slide = Slide(presentation=presentation, order=idx)
            slide.image.save(f"{idx:04d}.png", ContentFile(content), save=False)
            slide.save()

        presentation.slide_count = len(pages)
        presentation.save(update_fields=["slide_count", "updated_at"])

    logger.info(
        "Rendered presentation #%s from SVG (%s slides)",
        presentation.id,
        presentation.slide_count,
    )
    return presentation.slide_count
