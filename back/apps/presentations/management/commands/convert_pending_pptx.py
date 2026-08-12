"""One-shot backfill: rasterise every Presentation that still has a .pptx
attached but no Slide rows yet.

Run this once after deploying the server-side rasterisation change. Decks
uploaded under the old "Office Online iframe" flow only have the .pptx
saved — no slides were generated, so they appear empty in the new viewer.
This command turns each of them into per-slide PNGs and deletes the .pptx
afterwards (matching the new upload pipeline).

Idempotent: skips presentations that already have slides.
"""

from django.core.management.base import BaseCommand

from apps.presentations.conversion import ConversionError, convert_pptx_to_slides
from apps.presentations.models import Presentation


class Command(BaseCommand):
    help = "Convert .pptx files of existing presentations into slide PNGs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help=(
                "Re-rasterise even when slides already exist (default: skip)."
            ),
        )
        parser.add_argument(
            "--keep-pptx",
            action="store_true",
            help=(
                "Don't delete the .pptx after conversion. Useful for debugging."
            ),
        )

    def handle(self, *args, force: bool = False, keep_pptx: bool = False, **opts):
        qs = Presentation.objects.exclude(pptx_file="").exclude(pptx_file=None)
        if not force:
            qs = qs.filter(slide_count=0)

        total = qs.count()
        if not total:
            self.stdout.write(self.style.SUCCESS("No pending presentations."))
            return

        self.stdout.write(f"Converting {total} presentation(s)…")

        ok = 0
        failed: list[tuple[int, str]] = []
        for p in qs:
            label = f"#{p.id} {p.title[:40]!r}"
            self.stdout.write(f"  → {label} … ", ending="")
            try:
                count = convert_pptx_to_slides(p)
            except ConversionError as exc:
                self.stdout.write(self.style.ERROR(f"FAIL: {exc}"))
                failed.append((p.id, str(exc)))
                continue
            if not keep_pptx:
                p.pptx_file.delete(save=False)
                p.pptx_file = None
                p.save(update_fields=["pptx_file"])
            self.stdout.write(self.style.SUCCESS(f"{count} slides"))
            ok += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Done — {ok}/{total} converted."))
        if failed:
            self.stdout.write(self.style.ERROR(f"{len(failed)} failed:"))
            for pid, msg in failed:
                self.stdout.write(self.style.ERROR(f"  #{pid}: {msg}"))
