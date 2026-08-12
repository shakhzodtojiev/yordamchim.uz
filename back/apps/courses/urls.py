from django.urls import path

from .views import (
    AdminCourseDetailView,
    AdminCourseListCreateView,
    AdminLessonDetailView,
    AdminLessonListCreateView,
    AdminModuleCreateView,
    AdminModuleDetailView,
    AdminModuleLessonCreateView,
    AdminModuleLessonDetailView,
    CourseDetailView,
    CourseListView,
    LessonCompleteView,
    LessonDetailView,
)

urlpatterns = [
    # Teacher-facing
    path("courses/", CourseListView.as_view(), name="course-list"),
    path("courses/<int:pk>/", CourseDetailView.as_view(), name="course-detail"),
    path("lessons/<int:pk>/", LessonDetailView.as_view(), name="lesson-detail"),
    path(
        "lessons/<int:lesson_id>/complete/",
        LessonCompleteView.as_view(),
        name="lesson-complete",
    ),
    # Admin
    path(
        "admin/lessons/",
        AdminLessonListCreateView.as_view(),
        name="admin-lesson-list",
    ),
    path(
        "admin/lessons/<int:pk>/",
        AdminLessonDetailView.as_view(),
        name="admin-lesson-detail",
    ),
    path(
        "admin/courses/",
        AdminCourseListCreateView.as_view(),
        name="admin-course-list",
    ),
    path(
        "admin/courses/<int:pk>/",
        AdminCourseDetailView.as_view(),
        name="admin-course-detail",
    ),
    path(
        "admin/courses/<int:course_id>/modules/",
        AdminModuleCreateView.as_view(),
        name="admin-module-create",
    ),
    path(
        "admin/modules/<int:pk>/",
        AdminModuleDetailView.as_view(),
        name="admin-module-detail",
    ),
    path(
        "admin/modules/<int:module_id>/lessons/",
        AdminModuleLessonCreateView.as_view(),
        name="admin-module-lesson-create",
    ),
    path(
        "admin/module-lessons/<int:pk>/",
        AdminModuleLessonDetailView.as_view(),
        name="admin-module-lesson-detail",
    ),
]
