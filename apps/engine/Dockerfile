# syntax=docker/dockerfile:1
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/strategy-core/package.json packages/strategy-core/
COPY apps/api/package.json apps/api/
COPY apps/engine/package.json apps/engine/

RUN bun install --frozen-lockfile --ignore-scripts --production

COPY packages/shared packages/shared
COPY packages/strategy-core packages/strategy-core
COPY apps/api/src/db apps/api/src/db
COPY apps/api/src/utils apps/api/src/utils
COPY apps/engine apps/engine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/ready || exit 1

CMD ["bun", "run", "apps/engine/src/index.ts"]
