"""Presentation generation orchestration.

Pipeline: LLM -> slide outline (JSON) -> `svgdeck` renders styled per-slide
SVGs (subject theme + local icons/illustration, no image API) -> `svgrender`
rasterises them into protected Slide PNGs. The generated deck flows through the
exact same viewer + signed-URL security as admin-uploaded decks.

Generation is slow (LLM round-trip + LibreOffice), so `start_generation`
charges the fee, creates the job + a placeholder unpublished Presentation,
and hands the heavy work to a background thread. The frontend polls the
GenerationJob for status. On failure the fee is refunded and the placeholder
is removed.

The background thread is fine for the current single-box deployment; if we
ever move to multiple workers or need restart-safety, swap
`_spawn(run_generation_job, ...)` for a real task queue — the job row already
models the async lifecycle.
"""

from __future__ import annotations

import logging
import threading

from django.conf import settings
from django.db import close_old_connections, transaction

from apps.wallet import services as wallet_services

from . import llm, svgdeck
from .svgrender import render_svgs_to_slides
from .models import GenerationJob, Presentation

logger = logging.getLogger("apps.presentations.generation")

MIN_SLIDES = 3
MAX_SLIDES = 20


@transaction.atomic
def start_generation(
    *,
    user,
    subject,
    grade,
    topic: str,
    num_slides: int,
    quarter: int | None,
    price: int,
    is_listed: bool,
) -> GenerationJob:
    """Charge the fee, create the job + placeholder deck, and queue the work.

    All inside one transaction: if the charge fails (insufficient funds) the
    job and placeholder are never created. The thread is only spawned after
    the transaction commits, so it sees the committed rows.
    """
    num_slides = max(MIN_SLIDES, min(MAX_SLIDES, num_slides))

    # Charge first — raises InsufficientFunds before we create anything.
    wallet_services.charge_generation(
        user,
        settings.PRESENTATION_GENERATION_PRICE,
        note=f"Taqdimot generatsiyasi: '{topic}'",
    )

    presentation = Presentation.objects.create(
        title=topic,
        subject=subject,
        grade=grade,
        quarter=quarter,
        author=user,
        price=price,
        is_listed=is_listed,
        # Hidden until slides exist; the fee's already covered the generation.
        is_published=False,
    )
    job = GenerationJob.objects.create(
        user=user,
        subject=subject,
        grade=grade,
        quarter=quarter,
        topic=topic,
        num_slides=num_slides,
        presentation=presentation,
        status=GenerationJob.Status.PENDING,
    )

    transaction.on_commit(lambda: _spawn(run_generation_job, job.id))
    return job


def _spawn(target, *args) -> None:
    threading.Thread(target=target, args=args, daemon=True).start()


def run_generation_job(job_id: int) -> None:
    """Do the actual generation. Runs in a background thread, so it manages its
    own DB connection lifecycle and never lets an exception escape unlogged."""
    close_old_connections()
    try:
        job = GenerationJob.objects.select_related(
            "presentation", "subject", "grade", "user"
        ).get(pk=job_id)
    except GenerationJob.DoesNotExist:
        logger.error("GenerationJob %s vanished before processing", job_id)
        return

    job.status = GenerationJob.Status.PROCESSING
    job.save(update_fields=["status", "updated_at"])

    presentation = job.presentation
    try:
        outline, model_used = llm.generate_outline(
            subject=job.subject.name,
            grade=job.grade.name,
            topic=job.topic,
            num_slides=job.num_slides,
            quarter=job.quarter,
        )
        # Build a styled deck as per-slide SVG (subject theme + local Lucide
        # icons + Popsy illustration — no image API) and rasterise straight to
        # protected Slide PNGs. No .pptx is produced or stored.
        svgs = svgdeck.build_slide_svgs(outline, job.subject.name, topic=job.topic)
        render_svgs_to_slides(presentation, svgs)

        presentation.title = outline.get("title") or job.topic
        presentation.is_published = True
        presentation.save(update_fields=["title", "is_published", "updated_at"])

        job.model_used = model_used
        job.status = GenerationJob.Status.DONE
        job.save(update_fields=["model_used", "status", "updated_at"])
        logger.info("GenerationJob %s done (%s slides)", job.pk, presentation.slide_count)
    except Exception as exc:  # noqa: BLE001 — any failure must refund + mark failed
        logger.exception("GenerationJob %s failed", job.pk)
        job.status = GenerationJob.Status.FAILED
        job.error = str(exc)[:2000]
        job.save(update_fields=["status", "error", "updated_at"])
        # Refund the fee and drop the empty placeholder so it doesn't clutter
        # the author's list. SET_NULL keeps the job row after the deck is gone.
        try:
            wallet_services.refund_generation(
                job.user,
                settings.PRESENTATION_GENERATION_PRICE,
                note=f"Generatsiya xatosi — qaytarildi: '{job.topic}'",
            )
            if presentation and presentation.pk:
                presentation.delete()
        except Exception:  # noqa: BLE001
            logger.exception("GenerationJob %s cleanup/refund failed", job.pk)
    finally:
        close_old_connections()
