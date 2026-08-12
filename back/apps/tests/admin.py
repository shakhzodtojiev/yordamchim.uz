from django.contrib import admin

from .models import (
    Answer,
    Attempt,
    AttemptQuestion,
    Choice,
    MatchPair,
    Question,
    QuestionObjection,
    Test,
    TestPool,
    TopicPool,
)


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 4
    fields = ("order", "text", "image", "is_correct")


class MatchPairInline(admin.TabularInline):
    model = MatchPair
    extra = 2
    fields = ("order", "left_text", "left_image", "right_text", "right_image")


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0
    show_change_link = True
    ordering = ("order",)
    fields = ("order", "text", "image", "question_type", "difficulty")


@admin.register(TopicPool)
class TopicPoolAdmin(admin.ModelAdmin):
    list_display = ("title", "subject", "pool_type", "created_at")
    list_filter = ("subject", "pool_type")
    search_fields = ("title", "description")
    autocomplete_fields = ("subject",)
    inlines = [QuestionInline]


class TestPoolInline(admin.TabularInline):
    model = TestPool
    extra = 1
    fields = ("order", "pool", "easy_count", "medium_count", "hard_count")
    autocomplete_fields = ("pool",)


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "kind",
        "duration_seconds",
        "is_published",
        "available_from",
        "available_until",
        "created_at",
    )
    list_filter = ("kind", "is_published")
    search_fields = ("title", "description")
    inlines = [TestPoolInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("pool", "order", "text", "question_type", "difficulty")
    list_filter = ("pool", "question_type", "difficulty")
    inlines = [ChoiceInline, MatchPairInline]
    search_fields = ("text",)


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "test",
        "status",
        "score",
        "correct_count",
        "total_count",
        "started_at",
        "submitted_at",
    )
    list_filter = ("status", "test")
    autocomplete_fields = ("user", "test")
    readonly_fields = (
        "started_at",
        "submitted_at",
        "deadline_at",
        "correct_count",
        "total_count",
        "score",
        "status",
    )


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ("attempt", "question", "is_correct")
    list_filter = ("is_correct",)
    filter_horizontal = ("selected_choices",)


@admin.register(AttemptQuestion)
class AttemptQuestionAdmin(admin.ModelAdmin):
    list_display = ("attempt", "question", "order")
    list_filter = ("attempt",)


@admin.register(QuestionObjection)
class QuestionObjectionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "question",
        "reason",
        "status",
        "created_at",
        "resolved_at",
    )
    list_filter = ("status", "reason")
    search_fields = ("user__email", "question__text", "body")
    readonly_fields = ("created_at",)
