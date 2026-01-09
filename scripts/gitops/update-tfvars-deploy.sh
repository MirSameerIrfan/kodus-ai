#!/usr/bin/env bash
# Deploy: Prepara o novo ambiente no lado IDLE
# Auto-detecta se é PROD (seguro) ou QA (atropela)
set -euo pipefail

if [ "$#" -lt 4 ] || [ "$#" -gt 5 ]; then
  echo "Usage: $0 <tfvars-file> <api-image> <webhooks-image> <worker-image> [desired-count]" >&2
  exit 2
fi

FILE="$1"
API_IMAGE="$2"
WEBHOOKS_IMAGE="$3"
WORKER_IMAGE="$4"
DESIRED_COUNT="${5:-1}"

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

# Detecta se é PROD baseando-se no caminho do arquivo
IS_PROD="false"
if [[ "$FILE" == *"prod"* ]]; then
  IS_PROD="true"
fi

export IS_PROD

node - "$FILE" "$API_IMAGE" "$WEBHOOKS_IMAGE" "$WORKER_IMAGE" "$DESIRED_COUNT" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const apiImage = process.argv[3];
const webhooksImage = process.argv[4];
const workerImage = process.argv[5];
const desiredCount = Number(process.argv[6] || 1);
const isProd = process.env.IS_PROD === 'true';

try {
  const raw = fs.readFileSync(file, 'utf8');
  const obj = JSON.parse(raw);

  let activeSide;
  if (obj.api_active_side) {
    activeSide = obj.api_active_side;
  } else {
    activeSide = obj.api_green_weight === 100 ? 'green' : 'blue';
  }

  const targetSide = activeSide === 'green' ? 'blue' : 'green';
  const targetSideUpper = targetSide.toUpperCase();

  console.log(`>>> Environment: ${isProd ? 'PRODUCTION 🚨' : 'QA (Fast Mode) ⚡'}`);
  console.log(`>>> Deploying to IDLE side: ${targetSideUpper}`);

  // ⚠️ SAFETY CHECK (Só para PROD)
  const idleDesiredCount = targetSide === 'green'
    ? (obj.api_green_desired_count || 0)
    : (obj.api_desired_count || 0);

  if (idleDesiredCount > 0) {
    if (isProd) {
      console.error(`❌ ERROR (PROD): Target side ${targetSideUpper} is NOT clean (desired_count=${idleDesiredCount}).`);
      console.error(`   Run CLEANUP before deploying.`);
      process.exit(1);
    } else {
       console.warn(`⚠️ WARNING (QA): Target side ${targetSideUpper} was not clean. Overwriting anyway.`);
    }
  }

  // --- Lógica de Update ---
  if (targetSide === 'green') {
    obj.api_green_image = apiImage;
    obj.webhook_green_image = webhooksImage;
    obj.api_green_desired_count = desiredCount;
    obj.webhook_green_desired_count = desiredCount;
  } else {
    obj.api_image = apiImage;
    obj.webhook_image = webhooksImage;
    obj.api_desired_count = desiredCount;
    obj.webhook_desired_count = desiredCount;
  }

  // Worker Rolling Update
  obj.worker_image = workerImage;
  delete obj.worker_green_image;
  delete obj.worker_green_desired_count;

  // Escala Cluster para Prod (8) ou mantém QA (2)
  if (isProd) {
     obj.cluster_desired_capacity = 8;
  } else {
     // QA mantém o que está ou força minimo
     // obj.cluster_desired_capacity = 2;
  }

  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  console.log(`✅ SUCCESS: ${targetSideUpper} updated.`);

} catch (error) {
  console.error(`❌ ERROR: ${error.message}`);
  process.exit(1);
}
NODE
