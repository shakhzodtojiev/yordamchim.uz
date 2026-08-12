from django.urls import path

from .views import (
    AdminObjectionDetailView,
    AdminObjectionListView,
    AdminPoolDetailView,
    AdminPoolListCreateView,
    AdminPresentationDetailView,
    AdminPresentationListCreateView,
    AdminQuestionCreateView,
    AdminQuestionDetailView,
    AdminSlideDeleteView,
    AdminSlideUploadView,
    AdminTeacherWalletPayoutView,
    AdminTeacherWalletTopupView,
    AdminTeacherWalletView,
    AdminTestDetailView,
    AdminTestListCreateView,
    StatsView,
    TeacherDetailView,
    TeacherListView,
    TeacherPasswordResetView,
    TeacherPreferencesView,
    TeacherUpdateView,
)

urlpatterns = [
    path("stats/", StatsView.as_view(), name="admin-stats"),
    path("teachers/", TeacherListView.as_view(), name="admin-teachers"),
    path(
        "teachers/<int:pk>/",
        TeacherDetailView.as_view(),
        name="admin-teacher-detail",
    ),
    path(
        "teachers/<int:pk>/update/",
        TeacherUpdateView.as_view(),
        name="admin-teacher-update",
    ),
    path(
        "teachers/<int:pk>/preferences/",
        TeacherPreferencesView.as_view(),
        name="admin-teacher-preferences",
    ),
    path(
        "teachers/<int:pk>/reset-password/",
        TeacherPasswordResetView.as_view(),
        name="admin-teacher-password-reset",
    ),
    path(
        "teachers/<int:pk>/wallet/",
        AdminTeacherWalletView.as_view(),
        name="admin-teacher-wallet",
    ),
    path(
        "teachers/<int:pk>/wallet/topup/",
        AdminTeacherWalletTopupView.as_view(),
        name="admin-teacher-wallet-topup",
    ),
    path(
        "teachers/<int:pk>/wallet/payout/",
        AdminTeacherWalletPayoutView.as_view(),
        name="admin-teacher-wallet-payout",
    ),

    # Presentations
    path(
        "presentations/",
        AdminPresentationListCreateView.as_view(),
        name="admin-presentation-list",
    ),
    path(
        "presentations/<int:pk>/",
        AdminPresentationDetailView.as_view(),
        name="admin-presentation-detail",
    ),
    path(
        "presentations/<int:presentation_id>/slides/",
        AdminSlideUploadView.as_view(),
        name="admin-slide-upload",
    ),
    path(
        "slides/<int:pk>/",
        AdminSlideDeleteView.as_view(),
        name="admin-slide-delete",
    ),

    # Topic pools (questions live here)
    path(
        "pools/",
        AdminPoolListCreateView.as_view(),
        name="admin-pool-list",
    ),
    path(
        "pools/<int:pk>/",
        AdminPoolDetailView.as_view(),
        name="admin-pool-detail",
    ),
    path(
        "pools/<int:pool_id>/questions/",
        AdminQuestionCreateView.as_view(),
        name="admin-question-create",
    ),
    path(
        "questions/<int:pk>/",
        AdminQuestionDetailView.as_view(),
        name="admin-question-detail",
    ),

    # Tests (reference a pool)
    path(
        "tests/",
        AdminTestListCreateView.as_view(),
        name="admin-test-list",
    ),
    path(
        "tests/<int:pk>/",
        AdminTestDetailView.as_view(),
        name="admin-test-detail",
    ),

    # Objections
    path(
        "objections/",
        AdminObjectionListView.as_view(),
        name="admin-objection-list",
    ),
    path(
        "objections/<int:pk>/",
        AdminObjectionDetailView.as_view(),
        name="admin-objection-detail",
    ),
]
