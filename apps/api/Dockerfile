# syntax=docker/dockerfile:1
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/strategy-core/package.json packages/strategy-core/
COPY apps/api/package.json apps/api/

RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY packages/strategy-core packages/strategy-core
COPY apps/api apps/api

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "apps/api/src/index.ts"]
