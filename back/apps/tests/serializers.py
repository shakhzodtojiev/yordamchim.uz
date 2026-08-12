import hashlib
import hmac
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.personalization.serializers import SubjectSerializer

from .models import (
    Answer,
    Attempt,
    AttemptQuestion,
    Choice,
    MatchPair,
    Question,
    QuestionObjection,
    Test,
)


class TestListSerializer(serializers.ModelSerializer):
    """Public test row — exposes aggregated subject info across all linked
    pools, plus the mock window flags. Pool-by-pool detail isn't needed by
    test-takers (they just see the questions)."""

    subjects = serializers.SerializerMethodField()
    subject = serializers.SerializerMethodField()
    pool_count = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()
    questions_per_attempt = serializers.IntegerField(read_only=True)
    is_within_window = serializers.BooleanField(read_only=True)
    has_started = serializers.BooleanField(read_only=True)
    has_ended = serializers.BooleanField(read_only=True)

    class Meta:
        model = Test
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "subjects",
            "pool_count",
            "kind",
            "available_from",
            "available_until",
            "duration_seconds",
            "question_count",
            "questions_per_attempt",
            "is_within_window",
            "has_started",
            "has_ended",
            "created_at",
        )

    def get_subject(self, test: Test) -> dict | None:
        # The first (primary) subject — what the test list card uses for the
        # main badge. May be None for a freshly-created test with no pools.
        primary = test.primary_subject
        return SubjectSerializer(primary).data if primary else None

    def get_subjects(self, test: Test) -> list[dict]:
        return SubjectSerializer(test.subjects, many=True).data

    def get_pool_count(self, test: Test) -> int:
        # Use the prefetched through-rows (list view prefetches test_pools) so
        # this doesn't fire a COUNT per row. `.count()` would ignore the cache.
        return len(test.test_pools.all())

    def get_question_count(self, test: Test) -> int:
        annotated = getattr(test, "question_count", None)
        if isinstance(annotated, int):
            return annotated
        # Fallback for non-list contexts (attempt nested test, etc.) —
        # sum pool question counts.
        return sum(tp.pool.questions.count() for tp in test.test_pools.all())


def _media_url(image_field) -> str | None:
    """Return a relative `/media/...` URL or None. Frontend `absolutize()`
    prepends the browser-facing base — same pattern as presentation slides."""
    if not image_field:
        return None
    try:
        return image_field.url
    except ValueError:
        return None


def match_option_token(attempt_id: int, pair_id: int) -> str:
    """Opaque, per-attempt token for a matching question's right-column
    option. The correct pairing is left.id == right.id (one MatchPair row
    owns both sides), so exposing the pair id on both columns would hand the
    answer to the client. We key each right option by an HMAC instead — the
    server maps token -> pair id at scoring time, the client never learns the
    linkage."""
    key = (getattr(settings, "SLIDE_URL_SIGNING_KEY", None) or settings.SECRET_KEY)
    msg = f"match:{attempt_id}:{pair_id}".encode()
    return hmac.new(key.encode(), msg, hashlib.sha256).hexdigest()[:20]


class ChoicePublicSerializer(serializers.ModelSerializer):
    """Public — no `is_correct` (would let users cheat)."""

    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Choice
        fields = ("id", "order", "text", "image_url")

    def get_image_url(self, choice: Choice) -> str | None:
        return _media_url(choice.image)


class QuestionPublicSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    choices = ChoicePublicSerializer(many=True, read_only=True)
    # Matching questions are split into two decoupled columns so the correct
    # pairing never travels to the client: `pairs` carries only the left
    # prompts (keyed by pair id), `options` carries the right answers keyed
    # by opaque per-attempt tokens (see match_option_token).
    pairs = serializers.SerializerMethodField()
    options = serializers.SerializerMethodField()
    # Pool info — the runner's right-hand navigation grid groups questions
    # by pool (Asosiy fan, Kasbiy standart, ...) and switches tile shape on
    # pool_type. `pool_id` is already a model field (the FK column), so we
    # let it be inferred from Meta.fields instead of redeclaring it.
    pool_title = serializers.CharField(source="pool.title", read_only=True)
    pool_type = serializers.CharField(source="pool.pool_type", read_only=True)

    class Meta:
        model = Question
        fields = (
            "id",
            "order",
            "text",
            "image_url",
            "question_type",
            "difficulty",
            "choices",
            "pairs",
            "options",
            "pool_id",
            "pool_title",
            "pool_type",
        )

    def get_image_url(self, question: Question) -> str | None:
        return _media_url(question.image)

    def get_pairs(self, question: Question) -> list[dict]:
        if question.question_type != Question.Type.MATCHING:
            return []
        return [
            {
                "id": pair.id,
                "order": pair.order,
                "left_text": pair.left_text,
                "left_image_url": _media_url(pair.left_image),
            }
            for pair in question.pairs.all()
        ]

    def get_options(self, question: Question) -> list[dict]:
        if question.question_type != Question.Type.MATCHING:
            return []
        attempt = self.context.get("attempt")
        if attempt is None:
            return []
        opts = [
            {
                "token": match_option_token(attempt.id, pair.id),
                "right_text": pair.right_text,
                "right_image_url": _media_url(pair.right_image),
            }
            for pair in question.pairs.all()
        ]
        # Order by token — an opaque order that doesn't leak the source row.
        opts.sort(key=lambda o: o["token"])
        return opts


class AttemptStartSerializer(serializers.ModelSerializer):
    test = TestListSerializer(read_only=True)
    questions = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = (
            "id",
            "test",
            "started_at",
            "deadline_at",
            "status",
            "questions",
        )
        read_only_fields = fields

    def get_questions(self, attempt: Attempt) -> list[dict]:
        # Use the materialized subset stored on AttemptQuestion — that's the
        # specific 10/10/10 the user got at start time.
        rows = (
            AttemptQuestion.objects.filter(attempt=attempt)
            .select_related("question__pool")
            .prefetch_related("question__choices", "question__pairs")
            .order_by("order")
        )
        questions = [row.question for row in rows]
        return QuestionPublicSerializer(
            questions, many=True, context={"attempt": attempt}
        ).data


class AttemptSubmitInputSerializer(serializers.Serializer):
    """Payload shape:
        {"answers": [
            {"question_id": 1, "choice_ids": [5]},                        # single
            {"question_id": 2, "choice_ids": [3, 7]},                     # multi
            {"question_id": 3, "matches": [[10, "a1b2..."], ...]},        # matching
        ]}

    For matching, each entry is [left_pair_id, right_option_token] — the
    token is the opaque per-attempt id the start payload handed the client
    (see match_option_token). The server resolves it back to a pair id."""

    answers = serializers.ListField(child=serializers.DictField(), allow_empty=True)

    def validate_answers(self, value):
        clean: list[dict] = []
        seen: set[int] = set()
        for entry in value:
            try:
                qid = int(entry["question_id"])
            except (KeyError, TypeError, ValueError) as exc:
                raise serializers.ValidationError(
                    "Each answer needs `question_id`."
                ) from exc
            if qid in seen:
                raise serializers.ValidationError(
                    f"Duplicate answer for question {qid}."
                )
            seen.add(qid)

            choice_ids = entry.get("choice_ids") or []
            matches = entry.get("matches") or []
            if not isinstance(choice_ids, list) or not isinstance(matches, list):
                raise serializers.ValidationError(
                    "`choice_ids` and `matches` must be lists."
                )
            try:
                choice_ids = [int(x) for x in choice_ids]
                # left is a pair id (int); right is an opaque option token (str).
                matches = [
                    (int(left), str(right)) for left, right in matches
                ]
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError(
                    "Answer payload must contain integers."
                ) from exc
            clean.append(
                {"question_id": qid, "choice_ids": choice_ids, "matches": matches}
            )
        return clean


class _AnswerChoiceSerializer(serializers.ModelSerializer):
    """Choice payload exposed in attempt results — `is_correct` is OK here
    because the attempt has been submitted."""

    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Choice
        fields = ("id", "order", "text", "image_url", "is_correct")

    def get_image_url(self, choice: Choice) -> str | None:
        return _media_url(choice.image)


class _AnswerPairSerializer(serializers.ModelSerializer):
    left_image_url = serializers.SerializerMethodField()
    right_image_url = serializers.SerializerMethodField()

    class Meta:
        model = MatchPair
        fields = (
            "id",
            "order",
            "left_text",
            "left_image_url",
            "right_text",
            "right_image_url",
        )

    def get_left_image_url(self, pair: MatchPair) -> str | None:
        return _media_url(pair.left_image)

    def get_right_image_url(self, pair: MatchPair) -> str | None:
        return _media_url(pair.right_image)


class AnswerResultSerializer(serializers.ModelSerializer):
    question_type = serializers.CharField(source="question.question_type", read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_image_url = serializers.SerializerMethodField()
    selected_choice_ids = serializers.SerializerMethodField()
    choices = serializers.SerializerMethodField()
    pairs = serializers.SerializerMethodField()
    correct_matches = serializers.SerializerMethodField()
    # Pool info — the results-page grid groups answers by pool and renders
    # circle tiles for theoretical pools vs. squares for regular pools.
    pool_id = serializers.IntegerField(source="question.pool_id", read_only=True)
    pool_title = serializers.CharField(source="question.pool.title", read_only=True)
    pool_type = serializers.CharField(source="question.pool.pool_type", read_only=True)

    class Meta:
        model = Answer
        fields = (
            "question",
            "question_type",
            "question_text",
            "question_image_url",
            "choices",
            "pairs",
            "selected_choice_ids",
            "match_payload",
            "correct_matches",
            "is_correct",
            "pool_id",
            "pool_title",
            "pool_type",
        )

    def get_question_image_url(self, answer: Answer) -> str | None:
        return _media_url(answer.question.image)

    def get_selected_choice_ids(self, answer: Answer) -> list[int]:
        return list(answer.selected_choices.values_list("id", flat=True))

    def get_choices(self, answer: Answer) -> list[dict]:
        if answer.question.question_type == Question.Type.MATCHING:
            return []
        return _AnswerChoiceSerializer(answer.question.choices.all(), many=True).data

    def get_pairs(self, answer: Answer) -> list[dict]:
        if answer.question.question_type != Question.Type.MATCHING:
            return []
        return _AnswerPairSerializer(answer.question.pairs.all(), many=True).data

    def get_correct_matches(self, answer: Answer) -> list[list[int]]:
        # The "correct" answer for matching is each pair matched to itself —
        # i.e. left.id == right.id. We return them so the UI can mark wrong
        # matches and reveal the correct mapping.
        return [[p.id, p.id] for p in answer.question.pairs.all()]


class AttemptResultSerializer(serializers.ModelSerializer):
    test = TestListSerializer(read_only=True)
    answers = AnswerResultSerializer(many=True, read_only=True)
    # Rank within this test's submitted attempts. Computed in the view via
    # annotation so it joins on a small, indexed set rather than re-querying
    # per-attempt. Null for in-progress attempts.
    rank = serializers.IntegerField(read_only=True, allow_null=True)
    rank_total = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Attempt
        fields = (
            "id",
            "test",
            "started_at",
            "submitted_at",
            "deadline_at",
            "status",
            "correct_count",
            "total_count",
            "score",
            "answers",
            "rank",
            "rank_total",
        )
        read_only_fields = fields


class AttemptHistorySerializer(serializers.ModelSerializer):
    test = TestListSerializer(read_only=True)

    class Meta:
        model = Attempt
        fields = (
            "id",
            "test",
            "started_at",
            "submitted_at",
            "status",
            "score",
            "correct_count",
            "total_count",
        )
        read_only_fields = fields


def _is_choice_answer_correct(question: Question, picked_ids: set[int]) -> bool:
    """All-or-nothing: user must pick exactly the set of correct choices."""
    correct_ids = {c.id for c in question.choices.all() if c.is_correct}
    valid_ids = {c.id for c in question.choices.all()}
    if not picked_ids.issubset(valid_ids):
        return False
    return picked_ids == correct_ids and len(correct_ids) > 0


def _score_matches(
    attempt: Attempt, question: Question, matches: list[tuple[int, str]]
) -> tuple[bool, list[list[int | None]]]:
    """Resolve each (left_pair_id, right_option_token) and score it.

    The canonical pairing is left.id == right.id (a pair owns both columns).
    The client only ever saw opaque tokens for the right options, so we map
    each token back to its pair id here. Returns (is_correct, resolved) where
    resolved is [[left_pair_id, right_pair_id], ...] for storage and results
    display; right_pair_id is None for an unrecognized token."""
    pairs = list(question.pairs.all())
    pair_ids = {p.id for p in pairs}
    token_to_pair = {
        match_option_token(attempt.id, p.id): p.id for p in pairs
    }
    resolved: list[list[int | None]] = []
    seen_left: set[int] = set()
    correct = bool(pairs)
    for left, token in matches:
        right_pair = token_to_pair.get(token)
        resolved.append([left, right_pair])
        if left not in pair_ids or left in seen_left or right_pair is None:
            correct = False
            continue
        seen_left.add(left)
        if right_pair != left:
            correct = False
    if seen_left != pair_ids:
        correct = False
    return correct, resolved


@transaction.atomic
def submit_attempt(attempt: Attempt, raw_answers: list[dict]) -> Attempt:
    """Score the attempt server-side. Trusts no client-supplied scoring."""
    if attempt.status != Attempt.Status.IN_PROGRESS:
        raise serializers.ValidationError(
            {"detail": "This attempt has already been submitted."}
        )

    now = timezone.now()
    # Small server-side grace window past the deadline. The client auto-submits
    # at deadline_at, but a locked phone (paused JS timers) or a slightly slow
    # clock lands the request a little late — without grace the whole attempt
    # would be discarded. Within grace we still accept and score it.
    grace = timedelta(
        seconds=getattr(settings, "TEST_SUBMIT_GRACE_SECONDS", 120)
    )
    if attempt.deadline_at + grace < now:
        attempt.status = Attempt.Status.EXPIRED
        attempt.submitted_at = now
        attempt.save(update_fields=["status", "submitted_at"])
        raise serializers.ValidationError(
            {"detail": "Time is up — this attempt has expired."}
        )

    # Score only the materialized subset for this attempt — not every question
    # in the test bank.
    attempt_question_ids = list(
        AttemptQuestion.objects.filter(attempt=attempt).values_list(
            "question_id", flat=True
        )
    )
    questions = list(
        Question.objects.filter(id__in=attempt_question_ids).prefetch_related(
            "choices", "pairs"
        )
    )
    answers_by_qid = {a["question_id"]: a for a in raw_answers}

    Answer.objects.filter(attempt=attempt).delete()

    correct = 0
    for question in questions:
        payload = answers_by_qid.get(question.id)
        is_correct = False
        picked_choice_ids: list[int] = []
        match_payload: list[list[int]] = []

        if payload is not None:
            if question.question_type == Question.Type.MATCHING:
                matches = payload.get("matches", [])
                is_correct, match_payload = _score_matches(
                    attempt, question, matches
                )
            else:
                picked_ids = set(payload.get("choice_ids", []))
                if question.question_type == Question.Type.SINGLE and len(picked_ids) > 1:
                    # Single-choice answers must pick exactly one option.
                    is_correct = False
                else:
                    is_correct = _is_choice_answer_correct(question, picked_ids)
                picked_choice_ids = list(picked_ids)

        if is_correct:
            correct += 1
        answer = Answer.objects.create(
            attempt=attempt,
            question=question,
            match_payload=match_payload,
            is_correct=is_correct,
        )
        if picked_choice_ids:
            answer.selected_choices.set(picked_choice_ids)

    total = len(questions)
    attempt.correct_count = correct
    attempt.total_count = total
    attempt.score = round((correct / total) * 100, 2) if total else 0.0
    attempt.submitted_at = now
    attempt.status = Attempt.Status.SUBMITTED
    attempt.save(
        update_fields=[
            "correct_count",
            "total_count",
            "score",
            "submitted_at",
            "status",
        ]
    )
    return attempt


class QuestionObjectionInputSerializer(serializers.Serializer):
    """Payload teachers send when filing an objection. We trust the question
    id (server checks it exists) and optional attempt id."""

    question_id = serializers.IntegerField(min_value=1)
    attempt_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    reason = serializers.ChoiceField(choices=QuestionObjection.Reason.choices)
    body = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class QuestionObjectionSerializer(serializers.ModelSerializer):
    """Read-side payload for the user's own objection list — keeps it tight."""

    reason_label = serializers.CharField(source="get_reason_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)

    class Meta:
        model = QuestionObjection
        fields = (
            "id",
            "question",
            "question_text",
            "attempt",
            "reason",
            "reason_label",
            "body",
            "status",
            "status_label",
            "admin_note",
            "created_at",
            "resolved_at",
        )
        read_only_fields = fields
