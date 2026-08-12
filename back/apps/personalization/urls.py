from django.urls import path

from .views import GradeListView, PreferencesView, SubjectListView

urlpatterns = [
    path("subjects/", SubjectListView.as_view(), name="subject-list"),
    path("grades/", GradeListView.as_view(), name="grade-list"),
    path("preferences/", PreferencesView.as_view(), name="preferences"),
]
