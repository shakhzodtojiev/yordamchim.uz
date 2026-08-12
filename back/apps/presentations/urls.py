from django.urls import path

from .views import (
    GenerationJobDetailView,
    GenerationJobListView,
    GeneratePresentationView,
    MyPresentationsView,
    MyPurchasedPresentationsView,
    PresentationDetailView,
    PresentationListView,
    PurchasePresentationView,
    RecommendedPresentationsView,
    SlideRawView,
)

# The /pptx/raw/ route was removed when we switched to server-side rasterising
# admin-uploaded decks into Slide PNGs — end-users can no longer reach the
# original .pptx file at all.
#
# Specific string routes precede `<int:pk>/` so they aren't shadowed by it.
urlpatterns = [
    path("", PresentationListView.as_view(), name="presentation-list"),
    path("recommended/", RecommendedPresentationsView.as_view(), name="presentation-recommended"),
    path("mine/", MyPresentationsView.as_view(), name="presentation-mine"),
    path("purchased/", MyPurchasedPresentationsView.as_view(), name="presentation-purchased"),
    path("generate/", GeneratePresentationView.as_view(), name="presentation-generate"),
    path("generation-jobs/", GenerationJobListView.as_view(), name="generation-job-list"),
    path("generation-jobs/<int:pk>/", GenerationJobDetailView.as_view(), name="generation-job-detail"),
    path("<int:pk>/", PresentationDetailView.as_view(), name="presentation-detail"),
    path("<int:pk>/purchase/", PurchasePresentationView.as_view(), name="presentation-purchase"),
    path("slides/<int:slide_id>/raw/", SlideRawView.as_view(), name="slide-raw"),
]
