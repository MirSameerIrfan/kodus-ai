#!/bin/sh
set -eu

echo "▶ dev-entrypoint: starting (NODE_ENV=${NODE_ENV:-})"

# 1. Install dependencies if necessary
if [ ! -x node_modules/.bin/nest ]; then
  echo "▶ Installing deps (yarn --frozen-lockfile)…"
  yarn install --frozen-lockfile
fi

# 1b. Ensure @nestjs/common exports are valid (guard against broken node_modules)
if ! node -e "const { Module } = require('@nestjs/common'); process.exit(typeof Module === 'function' ? 0 : 1)"; then
  echo "▶ @nestjs/common export invalid; reinstalling deps..."
  rm -rf node_modules
  yarn install --frozen-lockfile
fi

# 2. Run Migrations and Seeds (if configured)
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
echo "▶ Running Migrations..."
npm run migration:run:internal

echo "▶ Running Seeds..."
npm run seed:internal
else
  echo "▶ Skipping Migrations and Seeds."
fi

# 3. Yalc Check
[ -d ".yalc/@kodus/flow" ] && echo "▶ yalc detected: using .yalc/@kodus/flow"

# 4. Execute container command (Full flexibility)
# If no command is passed, use nodemon as fallback
if [ $# -eq 0 ]; then
    echo "▶ No command specified, defaulting to nodemon..."
    exec nodemon --config nodemon.json
else
    echo "▶ Executing command: $@"
    exec "$@"
fi
