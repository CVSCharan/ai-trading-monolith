FROM oven/bun:1.3-alpine AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/strategy-core/package.json ./packages/strategy-core/
COPY apps/engine/package.json ./apps/engine/

RUN bun install --frozen-lockfile --production

COPY packages/shared ./packages/shared
COPY packages/strategy-core ./packages/strategy-core
COPY apps/engine ./apps/engine

ENV NODE_ENV=production
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["bun", "run", "apps/engine/src/index.ts"]
