from django.urls import path

from .views import (
    AttemptCurrentView,
    AttemptDetailView,
    AttemptHistoryView,
    AttemptStartView,
    AttemptSubmitView,
    ObjectionListCreateView,
    StatsView,
    TestDetailView,
    TestListView,
)

urlpatterns = [
    path("", TestListView.as_view(), name="test-list"),
    path("stats/", StatsView.as_view(), name="test-stats"),
    path("history/", AttemptHistoryView.as_view(), name="attempt-history"),
    path(
        "objections/",
        ObjectionListCreateView.as_view(),
        name="objection-list-create",
    ),
    path("<int:test_id>/start/", AttemptStartView.as_view(), name="attempt-start"),
    path(
        "<int:test_id>/current/",
        AttemptCurrentView.as_view(),
        name="attempt-current",
    ),
    path(
        "attempts/<int:attempt_id>/submit/",
        AttemptSubmitView.as_view(),
        name="attempt-submit",
    ),
    path("attempts/<int:pk>/", AttemptDetailView.as_view(), name="attempt-detail"),
    # Keep last — a bare <int> segment would otherwise shadow the string
    # prefixes above (stats/, history/, objections/, attempts/).
    path("<int:test_id>/", TestDetailView.as_view(), name="test-detail"),
]
