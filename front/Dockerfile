# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20-alpine

# ---- deps ---------------------------------------------------------------
# Install node_modules once; both `dev` and `build` reuse this layer.
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---- dev ----------------------------------------------------------------
# Used by docker-compose (target: dev). Source is bind-mounted, so we
# don't COPY it here — only carry the deps tree.
FROM node:${NODE_VERSION} AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- build --------------------------------------------------------------
# `next build` bakes NEXT_PUBLIC_* into the client bundle. They MUST be
# passed as build args, otherwise the production bundle calls localhost.
FROM node:${NODE_VERSION} AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `public/` may not exist when the project ships no static assets — ensure
# it does so the runtime stage's COPY doesn't fail.
RUN mkdir -p public && npm run build

# ---- runtime ------------------------------------------------------------
# Slim final image — relies on `output: "standalone"` in next.config.mjs.
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `nextjs` non-root user, parity with the Vercel reference Dockerfile.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# `output: "standalone"` produces .next/standalone (server.js + minimal
# node_modules). Static assets and public/ must be copied alongside.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
