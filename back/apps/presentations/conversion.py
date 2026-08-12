"""Server-side PPTX → PNG slide conversion.

Admins upload native .pptx files; this module turns each slide into a PNG and
persists them as :class:`Slide` rows. The .pptx itself is never exposed to
end-users — only the rendered images — so they can't download the editable
deck and walk away with the original.

Pipeline: LibreOffice headless (.pptx → .pdf) → poppler `pdftoppm` (.pdf →
one .png per page). Both are installed via the backend Dockerfile.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import transaction

from .models import Presentation, Slide

logger = logging.getLogger(__name__)


class ConversionError(RuntimeError):
    """Raised when the PPTX→PNG pipeline can't complete. The admin save
    handler turns this into a 400 response with a friendly message."""


# How fine to rasterise. 150 DPI keeps text crisp at fullscreen on a 1080p
# monitor without ballooning storage — most decks land at ~200KB per slide.
DEFAULT_DPI = 150


def _which(binary: str) -> str:
    """Locate a required binary; fail loudly with install instructions so a
    misconfigured image gets a clear error instead of a silent skip."""
    path = shutil.which(binary)
    if not path:
        raise ConversionError(
            f"`{binary}` topilmadi. Backend image'da {binary} o'rnatilgan emas."
        )
    return path


def _run(cmd: list[str], cwd: Path, timeout: int = 120) -> None:
    """Run a subprocess and surface its output in the ConversionError so
    devs can diagnose without re-running by hand. LibreOffice in particular
    fails silently on bad input otherwise."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ConversionError(
            f"Konvertatsiya {timeout}s ichida tugamadi: {' '.join(cmd[:2])}"
        ) from exc
    if result.returncode != 0:
        tail_lines = (result.stderr or result.stdout or "").strip().splitlines()[-3:]
        # f-strings can't host backslashes inside the expression, so build
        # the detail string outside it.
        detail = " | ".join(tail_lines) or "sabab noma'lum"
        raise ConversionError(
            f"Konvertatsiya muvaffaqiyatsiz ({cmd[0]}): {detail}"
        )


@transaction.atomic
def convert_pptx_to_slides(
    presentation: Presentation,
    *,
    dpi: int = DEFAULT_DPI,
) -> int:
    """Re-rasterise the presentation's attached .pptx into Slide rows.

    Wipes any existing Slides first — keeping stale images around when the
    admin re-uploads a new deck would mix old + new slides. Returns the
    number of slides created.

    Caller must guarantee `presentation.pptx_file` is populated and saved
    to storage (DRF FileField does this in `serializer.save()`).
    """
    if not presentation.pptx_file:
        raise ConversionError("Taqdimotda .pptx fayl yo'q.")

    soffice = _which("soffice")
    pdftoppm = _which("pdftoppm")

    # Stash the upload into a temp file. We can't use FileField.path
    # because S3-style storage backends (MinIO, R2, S3) don't expose a
    # local filesystem path — LibreOffice still needs a real file on disk,
    # so we stream the upload bytes into a temp dir and convert from there.
    original_name = presentation.pptx_file.name.rsplit("/", 1)[-1] or "upload.pptx"

    with tempfile.TemporaryDirectory(prefix="yordamchim-pptx-") as work_dir:
        work = Path(work_dir)
        src_path = work / original_name
        with presentation.pptx_file.open("rb") as src_fp:
            src_path.write_bytes(src_fp.read())

        # 1. LibreOffice → PDF. `--headless` runs without a display; `-env:`
        #    points the user profile at a temp dir so concurrent invocations
        #    don't trip over each other's locks.
        profile = work / "lo-profile"
        _run(
            [
                soffice,
                f"-env:UserInstallation=file://{profile}",
                "--headless",
                "--norestore",
                "--nologo",
                "--convert-to",
                "pdf",
                "--outdir",
                str(work),
                str(src_path),
            ],
            cwd=work,
            timeout=180,
        )

        pdf_path = work / (src_path.stem + ".pdf")
        if not pdf_path.exists():
            # LibreOffice sometimes silently produces no output for malformed
            # decks — check explicitly so admins get a real error.
            raise ConversionError("PDF generatsiya qilinmadi (fayl buzilgan bo'lishi mumkin).")

        # 2. pdftoppm → one PNG per page. Output names follow the prefix +
        #    zero-padded page number convention: `slide-001.png`, `-002.png`, …
        out_prefix = work / "slide"
        _run(
            [
                pdftoppm,
                "-png",
                "-r",
                str(dpi),
                str(pdf_path),
                str(out_prefix),
            ],
            cwd=work,
            timeout=180,
        )

        pages = sorted(work.glob("slide-*.png"))
        if not pages:
            raise ConversionError("PDF'dan rasm chiqarib bo'lmadi.")

        # 3. Replace existing Slides. CASCADE on the FK takes care of any
        #    rows; on the storage side we just orphan the old images — Django
        #    doesn't auto-delete files when a model row is removed.
        presentation.slides.all().delete()

        for idx, page in enumerate(pages, start=1):
            with page.open("rb") as fp:
                content = fp.read()
            # `save=True` (the default) on FileField.save flushes the model.
            slide = Slide(presentation=presentation, order=idx)
            slide.image.save(
                f"{idx:04d}.png",
                ContentFile(content),
                save=False,
            )
            slide.save()

        presentation.slide_count = len(pages)
        presentation.save(update_fields=["slide_count", "updated_at"])

    logger.info(
        "Converted presentation #%s (%s slides)",
        presentation.id,
        presentation.slide_count,
    )
    return presentation.slide_count
