#!/usr/bin/env bash
# Deploy: Prepara o novo ambiente no lado IDLE (não mexe nos pesos)
set -euo pipefail

if [ "$#" -lt 4 ] || [ "$#" -gt 5 ]; then
  echo "Usage: $0 <tfvars-file> <api-image> <webhooks-image> <worker-image> [desired-count]" >&2
  exit 2
fi

FILE="$1"
API_IMAGE="$2"
WEBHOOKS_IMAGE="$3"
WORKER_IMAGE="$4"
DESIRED_COUNT="${5:-2}"

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

node - "$FILE" "$API_IMAGE" "$WEBHOOKS_IMAGE" "$WORKER_IMAGE" "$DESIRED_COUNT" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const apiImage = process.argv[3];
const webhooksImage = process.argv[4];
const workerImage = process.argv[5];
const desiredCount = Number(process.argv[6] || 2);

try {
  const raw = fs.readFileSync(file, 'utf8');
  const obj = JSON.parse(raw);

  // Descobre qual lado está ativo (prioriza active_side, fallback para pesos)
  let activeSide;
  if (obj.api_active_side) {
    activeSide = obj.api_active_side;
  } else {
    activeSide = obj.api_green_weight === 100 ? 'green' : 'blue';
  }

  const targetSide = activeSide === 'green' ? 'blue' : 'green';
  const targetSideUpper = targetSide.toUpperCase();
  const activeSideUpper = activeSide.toUpperCase();

  console.log(`>>> Current production side: ${activeSideUpper} (active_side=${activeSide})`);
  console.log(`>>> Deploying NEW version to IDLE side: ${targetSideUpper}`);

  // ⚠️ SAFETY CHECK: Verifica se o lado idle está limpo (desired_count = 0)
  // Ignora worker pois ele é Rolling Update agora
  const idleDesiredCount = targetSide === 'green'
    ? (obj.api_green_desired_count || 0)
    : (obj.api_desired_count || 0);

  if (idleDesiredCount > 0) {
    console.error(`❌ ERROR: Target side ${targetSideUpper} is NOT clean (desired_count=${idleDesiredCount}).`);
    console.error(`   This means the previous deployment was not cleaned up yet.`);
    console.error(`   Run the CLEANUP workflow before deploying a new version.`);
    console.error(`   Or wait for the full Blue/Green cycle to complete.`);
    process.exit(1);
  }

  // --- API & WEBHOOK (Blue/Green) ---
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

  // --- WORKER (Rolling Update) ---
  // Atualiza diretamente a imagem do worker. O ECS gerencia o rolling update.
  console.log(`>>> Updating Worker image (Rolling Update)...`);
  obj.worker_image = workerImage;
  // Opcional: ajustar worker_desired_count se necessário, mas geralmente é fixo ou autoscaled
  // obj.worker_desired_count = desiredCount + 1; // Exemplo se quisesse aumentar durante deploy

  // ✅ CRÍTICO: Escala o cluster para caber ambos os lados (B/G) + Rolling do Worker
  obj.cluster_desired_capacity = 8;

  // NÃO MEXE NO active_side nem nos pesos (isso é na próxima etapa)

  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  console.log(`✅ SUCCESS: ${targetSideUpper} ready with new images.`);
  console.log(`    Worker image updated for rolling deploy.`);
  console.log(`    Cluster scaled to 8. active_side unchanged (${activeSide}).`);

} catch (error) {
  console.error(`❌ ERROR: ${error.message}`);
  process.exit(1);
}
NODE
