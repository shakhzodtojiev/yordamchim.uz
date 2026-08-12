from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

api_v1 = [
    path("auth/", include("apps.accounts.urls")),
    path("personalization/", include("apps.personalization.urls")),
    path("presentations/", include("apps.presentations.urls")),
    path("tests/", include("apps.tests.urls")),
    path("wallet/", include("apps.wallet.urls")),
    path("admin/", include("apps.admin_api.urls")),
    # courses.urls contains its own /admin/... paths; the admin_api include
    # above is a fall-through resolver, so requests that don't match inside
    # admin_api continue to courses and land on the right handler.
    path("", include("apps.courses.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
]

if settings.DEBUG and settings.STORAGE_BACKEND == "local":
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
