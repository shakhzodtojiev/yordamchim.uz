# Yordamchim — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind. Server-first arxitektura
(RSC + Server Actions). Backend (Django REST API) alohida repo'da
joylashgan; frontend uni `NEXT_PUBLIC_API_BASE_URL` orqali iste'mol qiladi.

## Tezkor ishga tushirish (Docker, dev)

```sh
cp .env.local.example .env.local
# .env.local'da API_BASE_URL va NEXT_PUBLIC_API_BASE_URL'ni o'z backendingiz
# manziliga o'zgartiring (lokal Django, cloudflared tunnel yoki staging URL).
docker compose up --build
```

Frontend: http://localhost:3030

Hot reload — kod bind-mount qilingan, `next dev` filewatch qiladi.

## Docker'siz (lokal Node)

```sh
npm install
cp .env.local.example .env.local
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # ishga tushirish (build keyingi)
npm run typecheck
```

## Strukturasi

```
src/
├── app/
│   ├── (auth)/             login, register
│   ├── (app)/
│   │   ├── layout.tsx      auth gate
│   │   ├── onboarding/     fan + sinf tanlash (gate'dan tashqari)
│   │   └── (shell)/        sidebar + topbar + bottom nav
│   │       ├── dashboard/
│   │       ├── presentations/[id]/
│   │       ├── tests/[id]/run/
│   │       ├── tests/attempts/[id]/results/
│   │       ├── settings/
│   │       └── admin/      can_admin gate
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── app-shell/          sidebar, topbar, bottom-nav, nav-progress
│   └── ui/                 shadcn-style primitives
├── features/               feature-grouped UI + actions
│   ├── auth/, personalization/, presentations/, tests/, dashboard/, admin/
├── lib/
│   ├── api/                client.ts, cookies.ts, endpoints.ts
│   ├── constants.ts
│   └── utils.ts
├── types/api.ts
└── middleware.ts           login redirect for protected routes
```

## Auth oqimi

- `loginAction` / `registerAction` server actions Django REST'ga POST qiladi.
- Tokenlar (`access`, `refresh`) JSON sifatida qaytadi va frontend o'zining
  `httpOnly` cookie'lariga (`uh_access`, `uh_refresh`) yozadi.
- `apiFetch` (server-only) har RSC chaqiruvga `Authorization: Bearer ...`
  qo'shadi. 401 olganda `refresh` tokeni bilan avtomatik yangilaydi.
- Cross-domain cookie muammolari yo'q — backend cookie qo'ymaydi, faqat
  JSON token qaytaradi.

## Onboarding gating

`(app)/layout.tsx` — autentifikatsiya. `(app)/(shell)/layout.tsx` —
`has_completed_onboarding=false` bo'lsa, `/onboarding`ga redirect.
`/onboarding` `(shell)`'dan tashqari, shu sababli loop bo'lmaydi.

## Production deploy (Docker)

Image multi-stage: `deps → dev → build → runtime`. Default target —
`runtime` (slim Next.js standalone bundle). `next.config.mjs`'da
`output: "standalone"` yoqilgan.

### Build args (KRITIK)

`NEXT_PUBLIC_*` env'lar **build paytida** bundle'ga embed qilinadi.
Production image build qilayotganda ularni `--build-arg` bilan bering:

```sh
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.example.com \
  -t yordamchim-frontend .
```

Server-only env (`API_BASE_URL`, `ACCESS_TOKEN_COOKIE`,
`REFRESH_TOKEN_COOKIE`) runtime'da `process.env`'dan o'qiladi — image
ichida hardcode qilinmagan.

### Run

```sh
docker run -p 3000:3000 \
  -e API_BASE_URL=http://backend:8000 \
  -e ACCESS_TOKEN_COOKIE=uh_access \
  -e REFRESH_TOKEN_COOKIE=uh_refresh \
  yordamchim-frontend
```

### Env (production)

| Env | Qachon | Misol |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | **build-arg** | `https://api.example.com` |
| `NEXT_PUBLIC_SITE_URL` | **build-arg** | `https://app.example.com` |
| `API_BASE_URL` | runtime | `http://backend:8000` (Docker net) yoki public URL |
| `ACCESS_TOKEN_COOKIE` | runtime | `uh_access` |
| `REFRESH_TOKEN_COOKIE` | runtime | `uh_refresh` |

`API_BASE_URL` brauzerga ko'rinmaydi — server-side fetch'lar uchun.
Internal Docker network'da `http://backend:8000` ishlatish mumkin.
`NEXT_PUBLIC_API_BASE_URL` — bu brauzerdan chiqadigan public manzil.

### Reverse proxy

TLS — nginx/Traefik/Cloudflare'da terminate. Frontend container 3000-portda
plain HTTP eshitadi. Backend — alohida domen (masalan `api.example.com`),
shuning uchun backend `CORS_ALLOWED_ORIGINS`'iga frontend URL'ini qo'shing.

## Presentation viewer

`presentation-viewer.tsx`:
- Klaviatura: ←/→/PageUp/PageDown, Home/End, F (fullscreen), +/-/0 (zoom)
- Touch swipe (zoom 1x bo'lganda)
- Right-click va drag bloklangan
- Watermark — 3×3 grid'da user emaili
- Slayd URL'lari signed URL'lar (relative); `endpoints.ts` ichida
  `absolutize()` `NEXT_PUBLIC_API_BASE_URL` bilan to'ldiradi.

## Telegram Mini App

`<TelegramProvider>` `window.Telegram.WebApp`'ni payqasa `data-tma="1"`
flag'ini html'ga qo'yadi. CSS shellni yashiradi (Telegram o'z chrome'iga
ega). Auto-login keyingi Phase'da.
