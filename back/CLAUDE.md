# Yordamchim Backend — loyiha kontekst

Django 5 + DRF + PostgreSQL backend. Frontend (Next.js 14) alohida repo'da
joylashgan va shu API'ni JWT bearer orqali iste'mol qiladi.

Hujjat tili — **O'zbek** (UI/help string'lar Uzbek tilida). Kod va commit
xabarlar — inglizcha.

## Apps

- **`accounts`** — custom `User` (email login). `is_admin` (custom panel
  access), `is_staff`/`is_superuser` (Django admin),
  `has_completed_onboarding`. JWT auth (register, login, refresh, logout,
  me). `telegram_id` + `auth/telegram/` — TMA initData verifier.
- **`personalization`** — `Subject`, `Grade`, `UserPreference` (per-user
  `subject × grade` cross-product). PUT `/preferences/` — bir martalik
  (kontent xavfsizligi uchun).
- **`presentations`** — `Presentation`, `Slide`, `PresentationView`. List
  endpoint user prefs bo'yicha filtrlanadi. Detail — HMAC-imzolangan,
  qisqa muddatli URL'lar bilan slaydlar.
- **`tests`** — `Test`, `Question`, `Choice` (`is_correct` server-only),
  `Attempt`, `Answer`. App label = `attestation` (Django test runner clash
  oldini olish uchun). Score serverda hisoblanadi; deadline serverda
  ushlab turiladi.
- **`admin_api`** — `is_admin` foydalanuvchilar uchun custom admin
  endpointlari. `IsAdminOrSuperuser` permission.

## Kritik qoidalar

### 1. Rol tizimi

| Rol | `is_admin` | `is_staff` | `is_superuser` | Django `/admin/` | Custom `/admin/` (frontend) |
|---|---|---|---|---|---|
| **teacher** | ✗ | ✗ | ✗ | ✗ | ✗ |
| **admin** | ✓ | ✗ | ✗ | ✗ | ✓ |
| **superadmin** | * | ✓ | ✓ | ✓ | ✓ |

Backend permission: `IsAdminOrSuperuser` (custom, `apps.accounts.permissions`).

### 2. Slide URL'lar relative

`build_signed_url` HMAC-imzolangan **relative** path qaytaradi
(`/api/v1/presentations/slides/<id>/raw/?u=&exp=&sig=`). Absolute URL
generatsiyasi frontend zimmasida — u `NEXT_PUBLIC_API_BASE_URL` bilan
to'ldiradi (cross-origin deploy'da kerak).

### 3. Onboarding bir martalik

`PUT /preferences/` `has_completed_onboarding=True` bo'lsa **403**
qaytaradi. Tayyorlangan kontent xavfsizligi uchun fan/sinf o'zgartirib
bo'lmaydi. Override — Django admin orqali generic exception sifatida.

### 4. Migrations workflow

Modellar o'zgargach:
```sh
docker compose exec backend python manage.py makemigrations <app>
docker compose exec backend python manage.py migrate
```

`docker-compose.yml` (dev) har container ko'tarilganda `makemigrations` +
`migrate` qiladi. Production entrypoint **faqat** `migrate` ishlatadi —
migrationlar repo'da check-in qilinadi, build paytida yaratilmaydi.

Yangi app qo'shsangiz:
1. `INSTALLED_APPS`'ga qo'shing
2. `apps/<name>/migrations/__init__.py` yarating
3. dev compose'dagi `makemigrations <app1> <app2> ...` ro'yxatiga qo'shing
4. `urls.py`'da include qiling

### 5. Question deletion va PROTECT

`Answer.question = ForeignKey(..., on_delete=PROTECT)`. Foydalanuvchi test
topshirgan bo'lsa savolni o'chirib bo'lmaydi — friendly 400 qaytadi.

### 6. Seed idempotent

`apps.personalization.management.commands.seed` har container
ko'tarilganda ishlaydi (dev). Subject/Grade/Test `update_or_create`.
Question/Choice — **faqat test'da hali savollar yo'q bo'lsa** yaratiladi
(real attempt history'ni saqlash uchun). Production'da `SEED_ON_BOOT=true`
bo'lganda ishlaydi.

### 7. JWT bearer (cookie emas)

Backend hech qanday cookie qo'ymaydi. JWT pair'ni JSON sifatida qaytaradi,
frontend o'zining `httpOnly` cookie'lariga saqlaydi. Cross-domain
`SameSite` muammolari shuning uchun yo'q.

### 8. App label `attestation`

`apps.tests`'ning Django app label'i — `attestation` (Django'ning ichki
test runner'i bilan to'qnashmaslik uchun). Migrations papkasi
`attestation_*` deb yoziladi. ORM query'lar — `apps.tests.models`'dan
import bilan ishlatish kerak (string label emas).

## Production deploy

Default `CMD` — `scripts/entrypoint.sh` (gunicorn). Compose dev'da
`command:` override bilan runserver ishlatiladi.

Reverse proxy (nginx/Traefik/Cloudflare) orqasida ishga tushirish:
- `USE_X_FORWARDED_HOST=True`
- `SECURE_PROXY_SSL_HEADER_NAME=HTTP_X_FORWARDED_PROTO`
- `DJANGO_ALLOWED_HOSTS` — proxy public hostname
- `CSRF_TRUSTED_ORIGINS` — `https://api.example.com` (faqat Django admin)
- `STORAGE_BACKEND=s3` — lokal disk Docker'da yo'qoladi

## Tez-tez uchraydigan tuzoqlar

1. **Yangi app qo'shganda** — `INSTALLED_APPS`, migrations papkasi, dev
   compose'dagi makemigrations ro'yxati, `urls.py`'da include.
2. **Annotation va `@property` to'qnashuvi** — model'da
   `@property def question_count` bo'lsa, ORM'da
   `.annotate(question_count=...)` qila olmaysiz. Bittasini tanlang.
3. **`apps.tests`'ning app label'i `attestation`** — testlar/migrations
   nomida `attestation_` prefiksini kuting.
4. **Production'da `makemigrations` ishlatmang** — entrypoint faqat
   `migrate` qiladi. Schema o'zgarishlarini repo'da commit qilib yuboring.
5. **Cookie auth yo'q** — DRF'ga JSON token qaytadi, cookie'lar frontend
   tomonida saqlanadi.
