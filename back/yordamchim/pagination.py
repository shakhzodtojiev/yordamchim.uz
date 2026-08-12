from rest_framework.pagination import PageNumberPagination


class PageNumberPaginationWithSize(PageNumberPagination):
    """DRF's default PageNumberPagination ignores `?page_size=`; this
    subclass opts it in with a hard cap so dropdowns can request the whole
    list ("give me all pools for the lesson-form select") without letting
    a rogue query OOM the server on huge tables."""

    page_size_query_param = "page_size"
    max_page_size = 1000
