FROM node:22.19.0-slim AS base
WORKDIR /usr/src/app

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack disable \
  && npm i -g yarn@1.22.22

FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile


FROM deps AS build
ARG RELEASE_VERSION=local
ENV SENTRY_RELEASE=$RELEASE_VERSION
COPY . .
RUN yarn build:apps


FROM base AS prod-deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true \
  && yarn cache clean


FROM node:22.19.0-slim AS runtime-common
WORKDIR /usr/src/app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/default-kodus-config.yml ./default-kodus-config.yml
COPY --from=build /usr/src/app/kodus-config.yml ./kodus-config.yml
FROM runtime-common AS api
CMD ["node", "dist/apps/api/main.js"]
FROM runtime-common AS webhooks
CMD ["node", "dist/apps/webhooks/main.js"]
FROM runtime-common AS worker
CMD ["node", "dist/apps/worker/main.js"]
