#!/bin/sh
set -eu

echo "▶ dev-entrypoint: starting (NODE_ENV=${NODE_ENV:-})"

if [ ! -x node_modules/.bin/nest ]; then
  echo "▶ Installing deps (yarn --frozen-lockfile)…"
  yarn install --frozen-lockfile
fi

echo "▶ Running Migrations..."
npm run migration:run:internal

echo "▶ Running Seeds..."
npm run seed:internal

[ -d ".yalc/@kodus/flow" ] && echo "▶ yalc detected: using .yalc/@kodus/flow"

echo "▶ starting nodemon…"
exec nodemon --config nodemon.json
