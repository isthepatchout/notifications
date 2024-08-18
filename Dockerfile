FROM oven/bun:1.1-alpine AS build

WORKDIR /app

COPY bunfig.toml .
COPY package.json .
COPY bun.lockb .

ENV CI=1
# Install dependencies
RUN --mount=type=cache,id=bun,target=~/.bun/install/cache bun install --frozen-lockfile

COPY . .

ENV BUN_ENV=production
RUN bun run build

FROM oven/bun:1.1-alpine

WORKDIR /app

COPY src src
COPY bunfig.toml .
COPY package.json .
COPY bun.lockb .

ENV CI=1
ENV BUN_ENV=production

COPY --from=build /app/dist dist

# Run with...
# Source maps enabled, since it does not affect performance from what I found
ENV NODE_OPTIONS="--enable-source-maps"
# Warnings disabled, we know what we're doing and they're annoying
ENV NODE_NO_WARNINGS=1
# Use production in case any dependencies use it in any way
ENV BUN_ENV=production
# Timezone UTC
ENV TZ=UTC

CMD ["bun", "run", "dist/index.js"]
