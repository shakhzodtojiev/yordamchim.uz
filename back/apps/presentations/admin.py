from django.contrib import admin

from .models import (
    GenerationJob,
    Presentation,
    PresentationPurchase,
    PresentationView,
    Slide,
)


class SlideInline(admin.TabularInline):
    model = Slide
    extra = 0
    fields = ("order", "image", "width", "height")
    ordering = ("order",)


@admin.register(Presentation)
class PresentationAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "subject",
        "grade",
        "author",
        "price",
        "is_listed",
        "slide_count",
        "view_count",
        "is_published",
        "created_at",
    )
    list_filter = ("subject", "grade", "is_published", "is_listed")
    search_fields = ("title", "description")
    autocomplete_fields = ("subject", "grade", "author")
    inlines = [SlideInline]
    readonly_fields = ("view_count", "created_at", "updated_at")

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        presentation: Presentation = form.instance
        Presentation.objects.filter(pk=presentation.pk).update(
            slide_count=presentation.slides.count()
        )


@admin.register(PresentationPurchase)
class PresentationPurchaseAdmin(admin.ModelAdmin):
    list_display = ("buyer", "presentation", "price_paid", "commission", "created_at")
    search_fields = ("buyer__email", "presentation__title")
    autocomplete_fields = ("buyer", "presentation")
    date_hierarchy = "created_at"


@admin.register(GenerationJob)
class GenerationJobAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "topic", "status", "presentation", "created_at")
    list_filter = ("status", "subject", "grade")
    search_fields = ("user__email", "topic")
    autocomplete_fields = ("user", "subject", "grade", "presentation")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PresentationView)
class PresentationViewAdmin(admin.ModelAdmin):
    list_display = ("presentation", "user", "viewed_at")
    list_filter = ("viewed_at",)
    autocomplete_fields = ("presentation", "user")
