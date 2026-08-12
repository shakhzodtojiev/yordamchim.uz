import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

logger = logging.getLogger(__name__)

from apps.personalization.models import Grade, Subject
from apps.personalization.serializers import GradeSerializer, SubjectSerializer
from apps.presentations.models import Presentation, Slide
from apps.tests.models import (
    Answer,
    Choice,
    MatchPair,
    Question,
    Test,
    TestPool,
    TopicPool,
)

User = get_user_model()


class TeacherListSerializer(serializers.ModelSerializer):
    subjects = serializers.SerializerMethodField()
    grades = serializers.SerializerMethodField()
    attempts_count = serializers.IntegerField(read_only=True)
    presentation_views_count = serializers.IntegerField(read_only=True)
    role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "is_active",
            "has_completed_onboarding",
            "role",
            "date_joined",
            "last_login",
            "subjects",
            "grades",
            "attempts_count",
            "presentation_views_count",
        )

    def get_subjects(self, user) -> list[dict]:
        ids = (
            user.preferences.values_list("subject_id", flat=True).distinct()
        )
        return SubjectSerializer(
            Subject.objects.filter(id__in=list(ids)), many=True
        ).data

    def get_grades(self, user) -> list[dict]:
        ids = user.preferences.values_list("grade_id", flat=True).distinct()
        return GradeSerializer(
            Grade.objects.filter(id__in=list(ids)).order_by("level"), many=True
        ).data


class AdminTeacherUpdateSerializer(serializers.ModelSerializer):
    """PATCHable subset — email intentionally read-only (JWT bearer subject;
    changing it mid-session would invalidate refresh tokens and confuse the
    audit trail). Password changes go through the dedicated reset endpoint.

    is_superuser is NOT exposed here — only Django /admin/ can grant it,
    matching the CLAUDE.md rule that the custom admin panel is separate."""

    class Meta:
        model = User
        fields = (
            "full_name",
            "is_admin",
            "is_active",
            "has_completed_onboarding",
        )

    def validate_is_admin(self, value: bool) -> bool:
        # Prevent a superuser from being demoted-by-flag mistake through
        # this endpoint — superusers are managed via Django /admin/.
        instance = self.instance
        if instance and instance.is_superuser and value is False:
            raise serializers.ValidationError(
                "Superuser rolini bu yerdan olib bo'lmaydi. Django admin panelidan."
            )
        return value


class AdminTeacherPreferencesSerializer(serializers.Serializer):
    """Admin can freely rewrite a teacher's (subject × grade) preferences,
    bypassing the one-shot onboarding lock in the public endpoint. Kept as a
    separate call so full_name / role updates don't accidentally rewrite
    content scoping."""

    subjects = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=True
    )
    grades = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=True
    )

    def validate_subjects(self, ids: list[int]) -> list[int]:
        # Deduplicate and confirm every id resolves — an invalid id would
        # otherwise silently vanish from the cross-product.
        ids = list(dict.fromkeys(ids))
        found = set(Subject.objects.filter(id__in=ids).values_list("id", flat=True))
        missing = set(ids) - found
        if missing:
            raise serializers.ValidationError(
                f"Noma'lum subject id: {sorted(missing)}"
            )
        return ids

    def validate_grades(self, ids: list[int]) -> list[int]:
        ids = list(dict.fromkeys(ids))
        found = set(Grade.objects.filter(id__in=ids).values_list("id", flat=True))
        missing = set(ids) - found
        if missing:
            raise serializers.ValidationError(
                f"Noma'lum grade id: {sorted(missing)}"
            )
        return ids


class AdminPresentationSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    grade = GradeSerializer(read_only=True)
    subject_id = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), source="subject", write_only=True
    )
    grade_id = serializers.PrimaryKeyRelatedField(
        queryset=Grade.objects.all(), source="grade", write_only=True
    )
    cover_image = serializers.ImageField(required=False, allow_null=True)
    # Surfaced on read so the admin UI can show "Slaydlar tayyor / .pptx bor
    # edi" — the file itself is deleted once converted, see save() below.
    pptx_filename = serializers.SerializerMethodField()
    # Write-only — incoming upload triggers the PPTX→PNG conversion in save().
    pptx_file = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Presentation
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "grade",
            "quarter",
            "subject_id",
            "grade_id",
            "cover_image",
            "pptx_file",
            "pptx_filename",
            "slide_count",
            "view_count",
            "is_published",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "slide_count",
            "view_count",
            "created_at",
            "updated_at",
            "pptx_filename",
        )

    def get_pptx_filename(self, obj) -> str | None:
        if not obj.pptx_file:
            return None
        # Strip the upload prefix so the admin sees just the original name.
        name = obj.pptx_file.name
        return name.rsplit("/", 1)[-1] if "/" in name else name

    def validate_pptx_file(self, value):
        if value is None:
            return value
        name = (value.name or "").lower()
        if not (name.endswith(".pptx") or name.endswith(".ppt")):
            raise serializers.ValidationError(
                "Faqat .ppt yoki .pptx formatdagi fayllar qabul qilinadi."
            )
        return value

    def save(self, **kwargs):
        """After the model is persisted, convert any newly-uploaded .pptx
        into per-slide PNGs and delete the .pptx so end-users can never get
        their hands on the editable deck — they only ever see signed image
        URLs through the public viewer."""
        from apps.presentations.conversion import (
            ConversionError,
            convert_pptx_to_slides,
        )

        # `pptx_file` is write-only, so it lives in validated_data only on
        # this save call. If absent, no upload happened and we skip the
        # conversion path entirely.
        pptx_uploaded = "pptx_file" in self.validated_data and self.validated_data.get(
            "pptx_file"
        )

        instance = super().save(**kwargs)

        if pptx_uploaded:
            # LibreOffice is flaky under load — a cold start with a fresh
            # user profile occasionally fails on the first try but works on
            # the second (subprocess timing, boto3 write-then-read latency,
            # ephemeral profile-lock races). One transparent retry hides
            # those without letting the admin see a 500 and re-upload by
            # hand. The whole convert function is @transaction.atomic so
            # a failed first attempt leaves no half-created Slide rows.
            try:
                convert_pptx_to_slides(instance)
            except ConversionError as first_exc:
                logger.warning(
                    "PPTX conversion attempt 1 failed for #%s, retrying: %s",
                    instance.id,
                    first_exc,
                )
                try:
                    convert_pptx_to_slides(instance)
                except ConversionError as exc:
                    # Both attempts failed — surface as a 400 and roll back
                    # the orphaned upload so the admin can retry cleanly.
                    logger.warning(
                        "PPTX conversion rejected for presentation #%s: %s",
                        instance.id,
                        exc,
                    )
                    instance.pptx_file.delete(save=False)
                    instance.pptx_file = None
                    instance.save(update_fields=["pptx_file"])
                    raise serializers.ValidationError({"pptx_file": str(exc)}) from exc
                except Exception:
                    logger.exception(
                        "PPTX conversion crashed on retry for #%s",
                        instance.id,
                    )
                    raise
            except Exception:
                # Non-ConversionError crashes (boto3 ClientError, OSError,
                # subprocess death) used to bubble up as a bare 500 with no
                # traceback. Log the full traceback for diagnosis. No
                # retry here — these are usually infra failures that
                # won't fix themselves in 1 second.
                logger.exception(
                    "PPTX conversion crashed for presentation #%s",
                    instance.id,
                )
                raise

            # Conversion succeeded — the .pptx has done its job. Delete it
            # so the next public-API request can't possibly leak it (even
            # if a stray signed-URL endpoint stuck around).
            instance.pptx_file.delete(save=False)
            instance.pptx_file = None
            instance.save(update_fields=["pptx_file"])

        return instance


class AdminSlideSerializer(serializers.ModelSerializer):
    image = serializers.ImageField()

    class Meta:
        model = Slide
        fields = ("id", "presentation", "order", "image", "width", "height")
        read_only_fields = ("id", "width", "height")


# ---- Tests admin ----

MIN_SINGLE_CHOICES = 2
MIN_MULTI_CHOICES = 2
MIN_MATCH_PAIRS = 2


def _admin_image_url(image_field) -> str | None:
    if not image_field:
        return None
    try:
        return image_field.url
    except ValueError:
        return None


class AdminChoiceSerializer(serializers.ModelSerializer):
    """Read + nested-write piece. `is_correct` is exposed only in admin
    serializers — never leak it to test-takers."""

    # `id` is writable so the parent serializer can match incoming entries to
    # existing rows during merge-by-id updates (preserves uploaded images).
    id = serializers.IntegerField(required=False)
    text = serializers.CharField(required=False, allow_blank=True, max_length=400)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Choice
        fields = ("id", "order", "text", "image_url", "is_correct")
        read_only_fields = ("order", "image_url")

    def get_image_url(self, choice: Choice) -> str | None:
        return _admin_image_url(choice.image)


class AdminMatchPairSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    left_text = serializers.CharField(
        required=False, allow_blank=True, max_length=400
    )
    right_text = serializers.CharField(
        required=False, allow_blank=True, max_length=400
    )
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
        read_only_fields = ("order", "left_image_url", "right_image_url")

    def get_left_image_url(self, pair: MatchPair) -> str | None:
        return _admin_image_url(pair.left_image)

    def get_right_image_url(self, pair: MatchPair) -> str | None:
        return _admin_image_url(pair.right_image)


class AdminQuestionSerializer(serializers.ModelSerializer):
    """Question + nested choices (single/multi) or pairs (matching).

    Validation rules per type:
      - single: at least 2 choices, exactly 1 marked correct. Each choice may
        have text, image, or both — but at least one. No pairs.
      - multi:  at least 2 choices, at least 1 marked correct. Same per-choice
        text/image rule. No pairs.
      - matching: at least 2 (left, right) pairs. Each side needs text or
        image. No choices.

    Question.text/image are also both optional in storage, but at least one
    must be present.
    """

    choices = AdminChoiceSerializer(many=True, required=False)
    pairs = AdminMatchPairSerializer(many=True, required=False)
    text = serializers.CharField(required=False, allow_blank=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = (
            "id",
            "pool",
            "order",
            "text",
            "image_url",
            "question_type",
            "difficulty",
            "choices",
            "pairs",
        )
        read_only_fields = ("id", "pool", "order", "image_url")

    def get_image_url(self, question: Question) -> str | None:
        return _admin_image_url(question.image)

    def validate(self, attrs):
        # On PATCH, pull existing question_type if not in payload.
        question_type = attrs.get(
            "question_type",
            getattr(self.instance, "question_type", Question.Type.SINGLE),
        )

        choices_in_payload = "choices" in self.initial_data
        pairs_in_payload = "pairs" in self.initial_data

        choices = attrs.get("choices", [])
        pairs = attrs.get("pairs", [])

        if question_type in (Question.Type.SINGLE, Question.Type.MULTI):
            if pairs:
                raise serializers.ValidationError(
                    "Variantli savolda 'pairs' bo'lmasligi kerak."
                )
            # Validate choices either when explicitly sent or on create.
            if choices_in_payload or self.instance is None:
                self._validate_choice_payload(choices, question_type)

        elif question_type == Question.Type.MATCHING:
            if choices:
                raise serializers.ValidationError(
                    "Mos qo'yish savolida 'choices' bo'lmasligi kerak."
                )
            if pairs_in_payload or self.instance is None:
                self._validate_pair_payload(pairs)

        return attrs

    def _validate_choice_payload(self, choices, question_type):
        # Text/image emptiness is enforced in the frontend — choices may
        # legitimately be image-only here (the file arrives via multipart
        # alongside this JSON envelope).
        correct_count = sum(1 for c in choices if c.get("is_correct"))
        if question_type == Question.Type.SINGLE:
            if len(choices) < MIN_SINGLE_CHOICES:
                raise serializers.ValidationError(
                    f"Single-choice savolida kamida {MIN_SINGLE_CHOICES} ta variant kerak."
                )
            if correct_count != 1:
                raise serializers.ValidationError(
                    "Single-choice savolida aynan bitta to'g'ri javob belgilang."
                )
        else:  # MULTI
            if len(choices) < MIN_MULTI_CHOICES:
                raise serializers.ValidationError(
                    f"Multi-choice savolida kamida {MIN_MULTI_CHOICES} ta variant kerak."
                )
            if correct_count < 1:
                raise serializers.ValidationError(
                    "Multi-choice savolida kamida bitta to'g'ri javob belgilang."
                )

    def _validate_pair_payload(self, pairs):
        # Same as choices — text emptiness is permitted here so an image-only
        # pair can flow through.
        if len(pairs) < MIN_MATCH_PAIRS:
            raise serializers.ValidationError(
                f"Mos qo'yish savolida kamida {MIN_MATCH_PAIRS} ta juftlik kerak."
            )

    @transaction.atomic
    def create(self, validated_data):
        choices_data = validated_data.pop("choices", [])
        pairs_data = validated_data.pop("pairs", [])
        pool = validated_data["pool"]
        # Use max(order)+1 rather than count()+1: deleted questions leave
        # gaps, so count can land on an existing order and trip the
        # (pool, order) unique constraint.
        current_max = pool.questions.aggregate(m=Max("order"))["m"] or 0
        order = current_max + 1
        question = Question.objects.create(
            pool=pool,
            order=order,
            text=validated_data.get("text", ""),
            question_type=validated_data.get("question_type", Question.Type.SINGLE),
            difficulty=validated_data.get("difficulty", Question.Difficulty.MEDIUM),
        )
        self._sync_children(question, choices_data, pairs_data)
        return question

    @transaction.atomic
    def update(self, instance, validated_data):
        choices_data = validated_data.pop("choices", None)
        pairs_data = validated_data.pop("pairs", None)

        # Once a question has been answered, its structure is frozen. Deleting
        # a choice/pair silently strips it from past Answer.selected_choices,
        # and toggling is_correct or the type desyncs the already-stored
        # is_correct/score of those attempts. Text/image edits stay allowed;
        # structural edits are refused with a friendly error (mirrors the
        # PROTECT guard on question deletion).
        if Answer.objects.filter(question=instance).exists():
            self._reject_structural_changes(
                instance, validated_data, choices_data, pairs_data
            )

        update_fields: list[str] = []
        for field in ("text", "question_type", "difficulty"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
                update_fields.append(field)
        if update_fields:
            instance.save(update_fields=update_fields)

        # If the type changed, blow away the children that no longer apply.
        if instance.question_type in (Question.Type.SINGLE, Question.Type.MULTI):
            instance.pairs.all().delete()
            if choices_data is not None:
                self._merge_choices(instance, choices_data)
        elif instance.question_type == Question.Type.MATCHING:
            instance.choices.all().delete()
            if pairs_data is not None:
                self._merge_pairs(instance, pairs_data)
        return instance

    @staticmethod
    def _reject_structural_changes(instance, validated_data, choices_data, pairs_data):
        err = serializers.ValidationError(
            "Bu savolga allaqachon javob berilgan — variantlar tarkibini "
            "(qo'shish/o'chirish, to'g'ri javobni o'zgartirish yoki savol "
            "turini almashtirish) o'zgartirib bo'lmaydi. Faqat matn va "
            "rasmlarni tahrirlash mumkin."
        )
        new_type = validated_data.get("question_type", instance.question_type)
        if new_type != instance.question_type:
            raise err

        if instance.question_type in (Question.Type.SINGLE, Question.Type.MULTI):
            if choices_data is None:
                return
            existing = {c.id: c for c in instance.choices.all()}
            # No additions (an entry without an id is a new choice).
            if any(not c.get("id") for c in choices_data):
                raise err
            incoming_ids = {c.get("id") for c in choices_data}
            # No deletions — the incoming id set must exactly match existing.
            if incoming_ids != set(existing):
                raise err
            # No is_correct flips — that would desync stored scores.
            for data in choices_data:
                cur = existing.get(data["id"])
                if cur and bool(data.get("is_correct", False)) != cur.is_correct:
                    raise err
        elif instance.question_type == Question.Type.MATCHING:
            if pairs_data is None:
                return
            existing = {p.id: p for p in instance.pairs.all()}
            if any(not p.get("id") for p in pairs_data):
                raise err
            incoming_ids = {p.get("id") for p in pairs_data}
            if incoming_ids != set(existing):
                raise err

    def _sync_children(self, question, choices_data, pairs_data):
        if question.question_type in (Question.Type.SINGLE, Question.Type.MULTI):
            self._create_choices(question, choices_data)
        elif question.question_type == Question.Type.MATCHING:
            self._create_pairs(question, pairs_data)

    @staticmethod
    def _create_choices(question, choices_data):
        for idx, choice in enumerate(choices_data, start=1):
            Choice.objects.create(
                question=question,
                order=idx,
                text=choice.get("text", ""),
                is_correct=choice.get("is_correct", False),
            )

    @staticmethod
    def _create_pairs(question, pairs_data):
        for idx, pair in enumerate(pairs_data, start=1):
            MatchPair.objects.create(
                question=question,
                order=idx,
                left_text=pair.get("left_text", ""),
                right_text=pair.get("right_text", ""),
            )

    @staticmethod
    def _merge_choices(question, choices_data):
        """Update existing choices by id, create new ones, delete the rest.
        This preserves uploaded images on choices that are still around."""
        existing = {c.id: c for c in question.choices.all()}
        keep_ids: set[int] = set()
        for idx, data in enumerate(choices_data, start=1):
            cid = data.get("id")
            if cid and cid in existing:
                choice = existing[cid]
                choice.order = idx
                choice.text = data.get("text", "")
                choice.is_correct = data.get("is_correct", False)
                choice.save(update_fields=["order", "text", "is_correct"])
                keep_ids.add(cid)
            else:
                new = Choice.objects.create(
                    question=question,
                    order=idx,
                    text=data.get("text", ""),
                    is_correct=data.get("is_correct", False),
                )
                keep_ids.add(new.id)
        question.choices.exclude(id__in=keep_ids).delete()

    @staticmethod
    def _merge_pairs(question, pairs_data):
        existing = {p.id: p for p in question.pairs.all()}
        keep_ids: set[int] = set()
        for idx, data in enumerate(pairs_data, start=1):
            pid = data.get("id")
            if pid and pid in existing:
                pair = existing[pid]
                pair.order = idx
                pair.left_text = data.get("left_text", "")
                pair.right_text = data.get("right_text", "")
                pair.save(update_fields=["order", "left_text", "right_text"])
                keep_ids.add(pid)
            else:
                new = MatchPair.objects.create(
                    question=question,
                    order=idx,
                    left_text=data.get("left_text", ""),
                    right_text=data.get("right_text", ""),
                )
                keep_ids.add(new.id)
        question.pairs.exclude(id__in=keep_ids).delete()


class AdminPoolListSerializer(serializers.ModelSerializer):
    """Lightweight pool entry for the admin pool list / pickers."""

    subject = SubjectSerializer(read_only=True)
    question_count = serializers.SerializerMethodField()

    def get_question_count(self, obj) -> int:
        # Prefer the annotated value (set in list/detail views) — fall back to
        # a count() so freshly-saved instances don't blow up.
        annotated = getattr(obj, "question_count", None)
        if isinstance(annotated, int):
            return annotated
        questions = getattr(obj, "questions", None)
        return questions.count() if questions is not None else 0

    class Meta:
        model = TopicPool
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "pool_type",
            "question_count",
            "created_at",
        )


class AdminPoolSerializer(serializers.ModelSerializer):
    """Detail pool serializer with full question list — used by the admin
    pool detail page that drives the question CRUD UI."""

    subject = SubjectSerializer(read_only=True)
    subject_id = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), source="subject", write_only=True
    )
    questions = AdminQuestionSerializer(many=True, read_only=True)
    question_count = serializers.SerializerMethodField()

    def get_question_count(self, obj) -> int:
        # Prefer the annotated value (set in list/detail views) — fall back to
        # a count() so freshly-saved instances don't blow up.
        annotated = getattr(obj, "question_count", None)
        if isinstance(annotated, int):
            return annotated
        questions = getattr(obj, "questions", None)
        return questions.count() if questions is not None else 0

    class Meta:
        model = TopicPool
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "subject_id",
            "pool_type",
            "question_count",
            "questions",
            "created_at",
        )
        read_only_fields = ("created_at",)


class _TestPoolNestedSerializer(serializers.ModelSerializer):
    """Compact pool block embedded in test responses so the admin UI doesn't
    need a second round-trip to fetch pool metadata."""

    subject = SubjectSerializer(read_only=True)
    question_count = serializers.SerializerMethodField()

    def get_question_count(self, obj) -> int:
        # Prefer the annotated value (set in list/detail views) — fall back to
        # a count() so freshly-saved instances don't blow up.
        annotated = getattr(obj, "question_count", None)
        if isinstance(annotated, int):
            return annotated
        questions = getattr(obj, "questions", None)
        return questions.count() if questions is not None else 0

    class Meta:
        model = TopicPool
        fields = ("id", "title", "subject", "pool_type", "question_count")


class AdminTestPoolSerializer(serializers.ModelSerializer):
    """One row in a test's pools[] — links a pool with its per-difficulty
    quotas. Also surfaces pool metadata for the admin UI."""

    pool = _TestPoolNestedSerializer(read_only=True)
    pool_id = serializers.PrimaryKeyRelatedField(
        queryset=TopicPool.objects.all(), source="pool", write_only=True
    )

    class Meta:
        model = TestPool
        fields = (
            "id",
            "pool",
            "pool_id",
            "order",
            "easy_count",
            "medium_count",
            "hard_count",
        )
        read_only_fields = ("id", "order")


class AdminTestListSerializer(serializers.ModelSerializer):
    pools = AdminTestPoolSerializer(source="test_pools", many=True, read_only=True)
    subjects = serializers.SerializerMethodField()
    questions_per_attempt = serializers.IntegerField(read_only=True)

    class Meta:
        model = Test
        fields = (
            "id",
            "title",
            "description",
            "pools",
            "subjects",
            "kind",
            "available_from",
            "available_until",
            "duration_seconds",
            "questions_per_attempt",
            "is_published",
            "created_at",
        )

    def get_subjects(self, test: Test) -> list[dict]:
        return SubjectSerializer(test.subjects, many=True).data


class AdminTestSerializer(serializers.ModelSerializer):
    pools = AdminTestPoolSerializer(source="test_pools", many=True, read_only=True)
    pools_input = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        help_text=(
            "List of {pool_id, easy_count, medium_count, hard_count}. "
            "Replaces the test's pool set on each write."
        ),
    )
    subjects = serializers.SerializerMethodField()
    questions_per_attempt = serializers.IntegerField(read_only=True)

    class Meta:
        model = Test
        fields = (
            "id",
            "title",
            "description",
            "pools",
            "pools_input",
            "subjects",
            "kind",
            "available_from",
            "available_until",
            "duration_seconds",
            "questions_per_attempt",
            "is_published",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def get_subjects(self, test: Test) -> list[dict]:
        return SubjectSerializer(test.subjects, many=True).data

    def validate_pools_input(self, value):
        clean: list[dict] = []
        seen_ids: set[int] = set()
        for entry in value:
            try:
                pid = int(entry["pool_id"])
            except (KeyError, TypeError, ValueError) as exc:
                raise serializers.ValidationError(
                    "Har bir pool yozuvida `pool_id` bo'lishi kerak."
                ) from exc
            if pid in seen_ids:
                raise serializers.ValidationError(
                    f"Bir xil to'plam ikki marta qo'shilgan: id={pid}."
                )
            if not TopicPool.objects.filter(pk=pid).exists():
                raise serializers.ValidationError(
                    f"To'plam topilmadi: id={pid}."
                )
            try:
                e = int(entry.get("easy_count", 0))
                m = int(entry.get("medium_count", 0))
                h = int(entry.get("hard_count", 0))
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError(
                    "Sonlar butun bo'lishi kerak."
                ) from exc
            if min(e, m, h) < 0:
                raise serializers.ValidationError(
                    "Sonlar manfiy bo'la olmaydi."
                )
            seen_ids.add(pid)
            clean.append(
                {
                    "pool_id": pid,
                    "easy_count": e,
                    "medium_count": m,
                    "hard_count": h,
                }
            )
        return clean

    def validate(self, attrs):
        kind = attrs.get(
            "kind", getattr(self.instance, "kind", Test.Kind.REGULAR)
        )
        af = attrs.get(
            "available_from", getattr(self.instance, "available_from", None)
        )
        au = attrs.get(
            "available_until", getattr(self.instance, "available_until", None)
        )
        if kind == Test.Kind.MOCK:
            if not af or not au:
                raise serializers.ValidationError(
                    "Mock test uchun boshlanish va tugash vaqti kerak."
                )
            if au <= af:
                raise serializers.ValidationError(
                    "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak."
                )

        # On create require at least one pool; on update only enforce when
        # pools_input is part of the payload.
        pools_input = self.initial_data.get("pools_input")
        if self.instance is None and not pools_input:
            raise serializers.ValidationError(
                "Kamida bitta to'plam tanlang (pools_input)."
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        pools_input = validated_data.pop("pools_input", [])
        test = super().create(validated_data)
        self._sync_test_pools(test, pools_input)
        return test

    @transaction.atomic
    def update(self, instance, validated_data):
        pools_input = validated_data.pop("pools_input", None)
        test = super().update(instance, validated_data)
        if pools_input is not None:
            self._sync_test_pools(test, pools_input)
        return test

    @staticmethod
    def _sync_test_pools(test: Test, pools_input: list[dict]) -> None:
        """Replace the test's pool set with the given list. Order of input is
        preserved as TestPool.order."""
        test.test_pools.all().delete()
        for idx, entry in enumerate(pools_input, start=1):
            TestPool.objects.create(
                test=test,
                pool_id=entry["pool_id"],
                order=idx,
                easy_count=entry["easy_count"],
                medium_count=entry["medium_count"],
                hard_count=entry["hard_count"],
            )


class AdminObjectionSerializer(serializers.ModelSerializer):
    """Read serializer for the admin objections page. Embeds enough question
    + user context for the admin to triage without extra round-trips."""

    reason_label = serializers.CharField(source="get_reason_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_id = serializers.IntegerField(source="question.id", read_only=True)
    question_pool_id = serializers.IntegerField(source="question.pool_id", read_only=True)
    question_pool_title = serializers.CharField(
        source="question.pool.title", read_only=True
    )
    attempt_id = serializers.IntegerField(source="attempt.id", read_only=True, default=None)

    class Meta:
        from apps.tests.models import QuestionObjection as _QO

        model = _QO
        fields = (
            "id",
            "user",
            "user_email",
            "user_full_name",
            "question",
            "question_id",
            "question_text",
            "question_pool_id",
            "question_pool_title",
            "attempt",
            "attempt_id",
            "reason",
            "reason_label",
            "body",
            "status",
            "status_label",
            "admin_note",
            "created_at",
            "resolved_at",
        )
        read_only_fields = (
            "id",
            "user",
            "user_email",
            "user_full_name",
            "question",
            "question_id",
            "question_text",
            "question_pool_id",
            "question_pool_title",
            "attempt",
            "attempt_id",
            "reason",
            "reason_label",
            "status_label",
            "body",
            "created_at",
            "resolved_at",
        )

    def update(self, instance, validated_data):
        from django.utils import timezone as _tz

        from apps.tests.models import QuestionObjection as _QO

        new_status = validated_data.get("status", instance.status)
        instance.status = new_status
        if "admin_note" in validated_data:
            instance.admin_note = validated_data["admin_note"]
        # Stamp resolved_at on first transition out of pending.
        if (
            new_status != _QO.Status.PENDING
            and instance.resolved_at is None
        ):
            instance.resolved_at = _tz.now()
        instance.save(
            update_fields=["status", "admin_note", "resolved_at"]
        )
        return instance


class AdminWalletActionSerializer(serializers.Serializer):
    """Body for admin manual top-up / payout. Amount is in so'm, positive."""

    amount = serializers.IntegerField(min_value=1)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)
