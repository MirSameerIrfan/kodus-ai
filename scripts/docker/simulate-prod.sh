#!/bin/bash
set -e

echo "🚀 Simulating Production Environment Locally"

# 1. Build Production Images Locally
echo "🔨 Building Production Images (Bake)..."
./scripts/docker/bake-local.sh

# 2. Create a temporary docker-compose override file to use local images
cat <<EOF > docker-compose.prod-local.yml
services:
  api:
    image: kodus-ai-api:local
    pull_policy: never
    environment:
      - NODE_OPTIONS=--max-old-space-size=1200 --max-semi-space-size=64 --openssl-legacy-provider
  worker:
    image: kodus-ai-worker:local
    pull_policy: never
    environment:
      - NODE_OPTIONS=--max-old-space-size=800 --max-semi-space-size=64 --openssl-legacy-provider
  webhooks:
    image: kodus-ai-webhook:local
    pull_policy: never
    environment:
      - NODE_OPTIONS=--max-old-space-size=400 --max-semi-space-size=16 --openssl-legacy-provider
EOF

# 3. Run with Production Compose + Local Override
echo "▶️ Starting Production Stack (Local Images)..."
# Setup environment file
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please create one."
    exit 1
fi

# Use .env as the source for production simulation if .env.prod doesn't exist or just use .env
# Docker compose usually looks for .env by default, but if we want to be explicit:
if [ ! -f .env.prod ]; then
    echo "⚠️ .env.prod not found, using .env as fallback"
    cp .env .env.prod
fi

export ENV_FILE=.env.prod
echo "🛑 Stopping Dev Apps..."
docker compose -f docker-compose.dev.yml stop api worker webhooks || true
docker compose -f docker-compose.dev.yml rm -f api worker webhooks || true

# Load DB variables for interpolation (needed for db_postgres in docker-compose.dev.yml)
echo "📥 Loading DB variables for interpolation..."
# Extract only DB variables to avoid issues with multi-line keys in source
export $(grep -E "^API_(PG|MG)_DB_" .env | xargs)

# Ensure Infrastructure is UP (Only DBs available in this compose)
echo "🐘 Ensuring Infra (DBs) is UP..."
docker compose -f docker-compose.dev.yml up -d db_postgres db_mongodb

# Export ENV_FILE for docker-compose interpolation
export ENV_FILE=.env.prod

docker compose -f docker-compose.prod.yml -f docker-compose.prod-local.yml up -d

echo "🎉 Production simulation is running!"
echo "   API: http://localhost:3331"
echo "   Webhooks: http://localhost:3333"
echo "   Use 'docker compose -f docker-compose.prod.yml -f docker-compose.prod-local.yml logs -f' to see logs."
