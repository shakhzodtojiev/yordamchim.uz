# Yordamchim — Backend

Django 5 + DRF + PostgreSQL. Maktab o'qituvchilari uchun SaaS API:
attestatsiya testlari, taqdimotlar, personalization, Telegram Mini App auth.

## Tezkor ishga tushirish (Docker, dev)

```sh
cp .env.example .env
docker compose up --build
```

- API: http://localhost:8000
- Django admin: http://localhost:8000/admin/
- Postgres: localhost:5432 (user/parol: `yordamchim`/`yordamchim`)

Birinchi `up` paytida `migrate` + `seed` avtomatik ishlaydi (10 ta fan, 11 ta
sinf, 1 ta namuna test). Superuser yaratish:

```sh
docker compose exec backend python manage.py createsuperuser
```

Hot reload — kod bind-mount qilingan, `runserver` filewatch qiladi.

## Komandalar

```sh
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py shell
docker compose logs -f backend
docker compose down -v   # bazani tozalab to'xtatish
```

Docker'siz (lokal venv) ishlamoqchi bo'lsangiz:

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # DATABASE_URL'ni lokal Postgres'ga moslang
python manage.py migrate && python manage.py seed
python manage.py runserver
```

## Apps

- `apps.accounts` — custom User (email login). `is_admin` (custom panel),
  `is_staff`/`is_superuser` (Django admin). JWT auth: register, login, refresh,
  logout, me. `+ /auth/telegram/` — Telegram Mini App initData verifier.
- `apps.personalization` — Subject, Grade, UserPreference. PUT
  `/preferences/` — bir martalik (kontent xavfsizligi uchun, 403 onboarding
  tugagandan keyin).
- `apps.presentations` — Presentation, Slide, PresentationView. List
  default'da user prefs bo'yicha filtrlanadi (`?all=1` to'liq). Detail —
  HMAC-imzolangan, qisqa muddatli URL'lar.
- `apps.tests` — Test, Question, Choice, Attempt, Answer. App label =
  `attestation` (Django test runner clash'idan qochish uchun). Score va
  deadline serverda.
- `apps.admin_api` — `is_admin` foydalanuvchilar uchun custom admin
  endpointlari. `IsAdminOrSuperuser` permission.

## URL ro'yxati

```
POST   /api/v1/auth/register/
POST   /api/v1/auth/login/
POST   /api/v1/auth/logout/
POST   /api/v1/auth/refresh/
POST   /api/v1/auth/telegram/
GET    /api/v1/auth/me/

GET    /api/v1/personalization/subjects/
GET    /api/v1/personalization/grades/
GET    /api/v1/personalization/preferences/
PUT    /api/v1/personalization/preferences/

GET    /api/v1/presentations/                  ?subject=&grade=&all=
GET    /api/v1/presentations/recommended/
GET    /api/v1/presentations/<id>/
GET    /api/v1/presentations/slides/<id>/raw/  ?u=&exp=&sig=

GET    /api/v1/tests/                          ?subject=
GET    /api/v1/tests/stats/
GET    /api/v1/tests/history/
POST   /api/v1/tests/<test_id>/start/
POST   /api/v1/tests/attempts/<id>/submit/
GET    /api/v1/tests/attempts/<id>/

# Admin (is_admin)
GET    /api/v1/admin/stats/
GET    /api/v1/admin/teachers/...
GET    /api/v1/admin/presentations/...
GET    /api/v1/admin/tests/...
GET    /api/v1/admin/objections/...
```

## Production deploy (Docker)

Image production'ga taxlangan: default `CMD` — gunicorn'ni ishga tushiruvchi
`scripts/entrypoint.sh`:

1. `migrate --noinput`
2. `collectstatic --noinput`
3. `seed` (faqat `SEED_ON_BOOT=true` bo'lsa)
4. `gunicorn yordamchim.wsgi:application` (env: `PORT`, `GUNICORN_WORKERS`,
   `GUNICORN_TIMEOUT`)

Image build:

```sh
docker build -t yordamchim-backend .
```

Run:

```sh
docker run -p 8000:8000 --env-file .env.production yordamchim-backend
```

### Production env (qo'shimcha)

`.env.example` ichida hammasi bor. Eng muhim production-only:

| Env | Misol | Izoh |
|---|---|---|
| `DJANGO_DEBUG` | `False` | Production'da har doim `False`. |
| `DJANGO_ALLOWED_HOSTS` | `api.example.com` | Reverse-proxy hostnomi. |
| `CORS_ALLOWED_ORIGINS` | `https://app.example.com` | Frontend prod URL. |
| `CSRF_TRUSTED_ORIGINS` | `https://api.example.com` | Faqat Django admin uchun. |
| `USE_X_FORWARDED_HOST` | `True` | Reverse proxy orqasida. |
| `SECURE_PROXY_SSL_HEADER_NAME` | `HTTP_X_FORWARDED_PROTO` | Proxy HTTPS belgisi. |
| `STORAGE_BACKEND` | `s3` | Lokal disk Docker'da yo'qoladi. |
| `SEED_ON_BOOT` | `true` (1 marta) | Birinchi deploy'dan keyin `false`. |

### Reverse proxy

Django runserver/gunicorn brauzerga bevosita tegmasligi kerak — nginx /
Traefik / Cloudflare'da TLS terminatsiya qilib backend'ga `8000`'ga
proxy_pass qiling. `X-Forwarded-Proto` va `X-Forwarded-Host` header'larini
o'tkazing.

## Auth oqimi

JWT bearer (SimpleJWT). Frontend tokenlarni o'z tomonida `httpOnly`
cookie'ga saqlaydi, har bir API chaqiruvga `Authorization: Bearer ...`
qo'shadi. Backend cookie'ga tegmaydi — bu cross-domain'da auth
qiyinchiligini bartaraf qiladi.

`/auth/telegram/` Telegram Mini App initData'ni HMAC-SHA256 bilan
tekshiradi (bot token yordamida) va birinchi marta bo'lsa
`tg-{telegram_id}@noreply.yordamchim.local` synthetic email bilan user
yaratadi.

## Slide URL signing

`/presentations/<id>/` so'rovi har bir slayd uchun
HMAC-SHA256(`SLIDE_URL_SIGNING_KEY`, `slide_id.user_id.exp`) generatsiya
qiladi. URL'ga `u=`, `exp=`, `sig=` ulanadi. `SlideRawView` keladigan
so'rovni `verify(...)` orqali tekshiradi va `FileResponse` qaytaradi
(inline, `Content-Disposition: attachment` qo'yilmaydi).

URL **relative** qaytadi — frontend `NEXT_PUBLIC_API_BASE_URL` bilan
to'ldiradi. Sabab: brauzer Docker tarmog'idagi `backend:8000`'ni ko'rmaydi.

## Storage

- `STORAGE_BACKEND=local` — Django `MEDIA_ROOT` (`/app/media`). Docker'da
  bind-mount yoki nomli volume kerak.
- `STORAGE_BACKEND=s3` — `django-storages` orqali S3-compatible (R2,
  MinIO, AWS). Kalitlarni `.env`'ga qo'ying.
