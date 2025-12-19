#!/bin/sh
set -e # Exit immediately if a command exits with a non-zero status

echo "▶ Starting deployment entrypoint..."

# ----------------------------------------------------------------
# Dynamic Environment Configuration
# ----------------------------------------------------------------
# Generates the environment.js file at runtime based on ENV vars.
# This allows changing CLOUD_MODE/DEV_MODE without rebuilding the image.
# ----------------------------------------------------------------

CLOUD_MODE=${API_CLOUD_MODE:-false}
DEV_MODE=${API_DEVELOPMENT_MODE:-false}

echo "▶ Configuring Environment..."
echo "  - API_CLOUD_MODE: $CLOUD_MODE"
echo "  - API_DEVELOPMENT_MODE: $DEV_MODE"

# Create the JS content
# We use a temporary file first
cat <<EOF > /tmp/env_config.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.environment = {
    API_CLOUD_MODE: ${CLOUD_MODE},
    API_DEVELOPMENT_MODE: ${DEV_MODE},
};
EOF

# Distribute the config file to potential locations where the app might look for it.
# We search for any directory named "environment" inside dist and drop the config there.
# This covers:
# - dist/libs/ee/configs/environment (Standard Monorepo)
# - dist/apps/worker/libs/ee/configs/environment (App-specific build)
# - dist/apps/api/libs/ee/configs/environment (App-specific build)

echo "▶ Distributing environment config..."
find ./dist -type d -name "environment" 2>/dev/null | while read dir; do
    echo "  - Writing to $dir/environment.js"
    cp /tmp/env_config.js "$dir/environment.js"
done

# Also put in apps root for good measure (for Webpack bundles if any remain or flatten structure)
for app_dir in ./dist/apps/*; do
    if [ -d "$app_dir" ]; then
        # Check if it's not already covered (avoid overwriting if 'libs' exists inside)
        if [ ! -d "$app_dir/libs" ]; then
             echo "  - Writing to $app_dir/environment.js (Bundle fallback)"
             cp /tmp/env_config.js "$app_dir/environment.js"
        fi
    fi
done


# ----------------------------------------------------------------
# Standard Startup
# ----------------------------------------------------------------

RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
RUN_SEEDS="${RUN_SEEDS:-true}"

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "▶ Running Migrations (internal)..."
  yarn migration:run:internal
else
  echo "▶ Skipping migrations (RUN_MIGRATIONS=$RUN_MIGRATIONS)"
fi

if [ "$RUN_SEEDS" = "true" ]; then
  echo "▶ Running Seeds (internal)..."
  yarn seed:internal
else
  echo "▶ Skipping seeds (RUN_SEEDS=$RUN_SEEDS)"
fi

echo "▶ Starting Application..."
# exec "$@" executes the CMD defined in the Dockerfile (pm2-runtime ...)
exec "$@"
