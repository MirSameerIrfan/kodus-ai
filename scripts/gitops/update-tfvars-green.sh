#!/usr/bin/env bash
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
  echo "tfvars file not found: $FILE" >&2
  exit 1
fi

node - "$FILE" "$API_IMAGE" "$WEBHOOKS_IMAGE" "$WORKER_IMAGE" "$DESIRED_COUNT" <<'NODE'
const fs = require('fs');

const file = process.argv[2];
const apiImage = process.argv[3];
const webhooksImage = process.argv[4];
const workerImage = process.argv[5];
const desiredCount = Number(process.argv[6] || 2);

const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);

// SMART LOGIC: Discover which side has 0% traffic
// If Green is at 100%, the deploy target is Blue.
const isGreenActive = obj.api_green_weight === 100;
const targetSide = isGreenActive ? 'BLUE' : 'GREEN';

console.log(`>>> Current production is on side: ${isGreenActive ? 'GREEN' : 'BLUE'}`);
console.log(`>>> Deploying new version to idle side: ${targetSide}`);

if (targetSide === 'GREEN') {
  obj.api_green_image = apiImage;
  obj.webhook_green_image = webhooksImage;
  obj.worker_green_image = workerImage;
  obj.api_green_desired_count = desiredCount;
  obj.webhook_green_desired_count = desiredCount;
  obj.worker_green_desired_count = desiredCount;
} else {
  // BLUE side uses default variables in Terraform (api_image, etc)
  obj.api_image = apiImage;
  obj.webhook_image = webhooksImage;
  obj.worker_image = workerImage;
  obj.api_desired_count = desiredCount;
  obj.webhook_desired_count = desiredCount;
  obj.worker_desired_count = desiredCount;
}

fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
console.log(`✅ Success: File ${file} updated for deployment on ${targetSide}.`);
NODE
