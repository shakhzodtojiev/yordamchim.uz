#!/usr/bin/env sh
set -e

# Production entrypoint. Dev (docker-compose) overrides `command:` to use
# Django's autoreloading runserver instead.

# Migrations are checked into the repo — never run makemigrations at boot.
python manage.py migrate --noinput

# Static files for Django admin + DRF browsable API. Whitenoise serves them
# from the same app process, so collectstatic must run before gunicorn.
python manage.py collectstatic --noinput

# Off by default — flip SEED_ON_BOOT=true on the first deploy to populate
# subjects/grades/sample test, then turn it back off.
if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
    python manage.py seed
fi

exec gunicorn yordamchim.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - \
    --error-logfile -
