#!/bin/sh
set -e # Exit immediately if a command exits with a non-zero status

echo "▶ Starting deployment entrypoint..."

# Run Migrations
echo "▶ Running Migrations..."
npm run migration:run:internal

echo "▶ Running Seeds..."
npm run seed:internal

echo "▶ Starting Application..."
# exec "$@" executes the CMD defined in the Dockerfile (pm2-runtime ...)
exec "$@"
