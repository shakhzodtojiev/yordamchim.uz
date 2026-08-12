FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Tashkent

WORKDIR /app

# `psycopg[binary]` ships its own libpq wheel, so no compile toolchain is
# needed at install time. `curl` is kept for container healthchecks.
#
# `libreoffice` + `poppler-utils` are used to convert admin-uploaded
# .pptx files into PNG slides server-side. We never serve the .pptx
# back to the browser — only the rendered images — so end-users can't
# download the original deck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        libreoffice-impress \
        libreoffice-core \
        poppler-utils \
        fonts-dejavu \
        fonts-liberation \
        tzdata \
    && ln -sf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo "$TZ" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run as an unprivileged user in production. This image shells out to
# LibreOffice + poppler to parse untrusted admin .pptx uploads (historically
# RCE-prone parsers) — a compromise there should not land as root. The dev
# compose overrides `user: root` so bind-mounted makemigrations still works.
RUN chmod +x /app/scripts/entrypoint.sh \
    && useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Production by default. Dev compose overrides `command:` to run
# Django's autoreloading runserver instead.
CMD ["/app/scripts/entrypoint.sh"]
