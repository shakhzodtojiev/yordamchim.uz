"""Seed baseline data: subjects, grades, a sample TopicPool with mixed
question types/difficulties, and a regular Test that draws from it.

Idempotent — safe to re-run.
    python manage.py seed
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.personalization.models import Grade, Subject
from apps.tests.models import (
    Choice,
    MatchPair,
    Question,
    Test,
    TestPool,
    TopicPool,
)

SUBJECTS = [
    "Matematika",
    "Fizika",
    "Kimyo",
    "Biologiya",
    "Ona tili",
    "Adabiyot",
    "Tarix",
    "Geografiya",
    "Ingliz tili",
    "Informatika",
]

GRADES = [(f"{i}-sinf", i) for i in range(1, 12)]

SAMPLE_QUESTIONS = [
    {
        "type": "single",
        "difficulty": "easy",
        "text": "12 × 8 = ?",
        "choices": [("96", True), ("84", False), ("104", False), ("88", False)],
    },
    {
        "type": "single",
        "difficulty": "easy",
        "text": "Eng kichik tub son qaysi?",
        "choices": [("2", True), ("1", False), ("3", False), ("0", False)],
    },
    {
        "type": "single",
        "difficulty": "medium",
        "text": "Kvadratning tomoni 6 sm bo'lsa, perimetri necha sm?",
        "choices": [("24", True), ("12", False), ("36", False), ("18", False)],
    },
    {
        "type": "multi",
        "difficulty": "medium",
        "text": "Quyidagilardan qaysilari tub son? (bir nechta to'g'ri javob bo'lishi mumkin)",
        "choices": [("2", True), ("4", False), ("7", True), ("9", False), ("11", True)],
    },
    {
        "type": "multi",
        "difficulty": "hard",
        "text": "Quyidagilardan qaysilari 12 ning bo'luvchilari?",
        "choices": [
            ("1", True),
            ("2", True),
            ("3", True),
            ("5", False),
            ("4", True),
            ("7", False),
        ],
    },
    {
        "type": "matching",
        "difficulty": "hard",
        "text": "Sonni uning kvadrati bilan moslang.",
        "pairs": [("2", "4"), ("3", "9"), ("4", "16"), ("5", "25")],
    },
]

SAMPLE_POOL = {
    "title": "Matematika — namuna attestatsiya testi",
    "description": "Boshlang'ich namuna to'plam: turli xil savollar va qiyinlik darajalari.",
    "subject": "Matematika",
    "pool_type": "oddiy",
}

SAMPLE_TEST = {
    "title": "Matematika — namuna attestatsiya testi",
    "description": "Namuna pool'dan oddiy (regular) test.",
    "duration_seconds": 10 * 60,
    "kind": "regular",
    # One TestPool entry, easy=2 medium=2 hard=2
    "easy_count": 2,
    "medium_count": 2,
    "hard_count": 2,
}


class Command(BaseCommand):
    help = "Seed baseline subjects, grades, a sample pool + test."

    @transaction.atomic
    def handle(self, *args, **options):
        for name in SUBJECTS:
            Subject.objects.update_or_create(
                slug=slugify(name), defaults={"name": name, "is_active": True}
            )
        for name, level in GRADES:
            Grade.objects.update_or_create(
                level=level, defaults={"name": name, "is_active": True}
            )

        subject = Subject.objects.get(slug=slugify(SAMPLE_POOL["subject"]))

        pool, _ = TopicPool.objects.update_or_create(
            title=SAMPLE_POOL["title"],
            defaults={
                "description": SAMPLE_POOL["description"],
                "subject": subject,
                "pool_type": SAMPLE_POOL["pool_type"],
            },
        )

        # Only seed questions when the pool is brand new. Answer rows reference
        # questions via PROTECT, so blowing them away on every restart would
        # break (and silently destroy) real attempt history.
        if not pool.questions.exists():
            for idx, q in enumerate(SAMPLE_QUESTIONS, start=1):
                question = Question.objects.create(
                    pool=pool,
                    order=idx,
                    text=q["text"],
                    question_type=q["type"],
                    difficulty=q["difficulty"],
                )
                if q["type"] in ("single", "multi"):
                    for cidx, (text, is_correct) in enumerate(q["choices"], start=1):
                        Choice.objects.create(
                            question=question,
                            order=cidx,
                            text=text,
                            is_correct=is_correct,
                        )
                elif q["type"] == "matching":
                    for pidx, (left, right) in enumerate(q["pairs"], start=1):
                        MatchPair.objects.create(
                            question=question,
                            order=pidx,
                            left_text=left,
                            right_text=right,
                        )
            questions_msg = f", {len(SAMPLE_QUESTIONS)} questions seeded"
        else:
            questions_msg = " (questions already present, kept as-is)"

        test, _ = Test.objects.update_or_create(
            title=SAMPLE_TEST["title"],
            defaults={
                "description": SAMPLE_TEST["description"],
                "kind": SAMPLE_TEST["kind"],
                "duration_seconds": SAMPLE_TEST["duration_seconds"],
                "is_published": True,
            },
        )
        # Idempotent — replace the test's single TestPool entry every run so
        # tweaking SAMPLE_TEST counts in dev takes effect.
        test.test_pools.all().delete()
        TestPool.objects.create(
            test=test,
            pool=pool,
            order=1,
            easy_count=SAMPLE_TEST["easy_count"],
            medium_count=SAMPLE_TEST["medium_count"],
            hard_count=SAMPLE_TEST["hard_count"],
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(SUBJECTS)} subjects, {len(GRADES)} grades, "
                f"1 pool ({pool.title}){questions_msg} + 1 regular test."
            )
        )
