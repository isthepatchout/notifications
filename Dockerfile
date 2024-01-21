FROM node:21-alpine AS build

RUN corepack enable

WORKDIR /app

COPY package.json .
COPY pnpm-lock.yaml .
COPY .npmrc .

ARG GITHUB_SHA
ENV GITHUB_SHA=${GITHUB_SHA}
ENV PNPM_HOME=/pnpm
ENV CI=1
# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN pnpm --silent run build

FROM node:21-alpine

RUN corepack enable

WORKDIR /app

COPY src src
COPY .npmrc .
COPY package.json .

ARG GITHUB_SHA
ENV GITHUB_SHA=${GITHUB_SHA}
ENV PNPM_HOME=/pnpm
ENV CI=1
ENV NODE_ENV=production

COPY --from=build /app/dist dist

# Run with...
# Source maps enabled, since it does not affect performance from what I found
ENV NODE_OPTIONS="--enable-source-maps"
# Warnings disabled, we know what we're doing and they're annoying
ENV NODE_NO_WARNINGS=1
# Use production in case any dependencies use it in any way
ENV NODE_ENV=production
# Timezone UTC
ENV TZ=UTC

CMD ["pnpm", "--silent", "start"]
