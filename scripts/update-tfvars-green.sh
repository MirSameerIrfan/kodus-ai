#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "Usage: $0 <tfvars-file> <api-image> <webhooks-image> <worker-image>" >&2
  exit 2
fi

FILE="$1"
API_IMAGE="$2"
WEBHOOKS_IMAGE="$3"
WORKER_IMAGE="$4"

if [ ! -f "$FILE" ]; then
  echo "tfvars file not found: $FILE" >&2
  exit 1
fi

node - "$FILE" "$API_IMAGE" "$WEBHOOKS_IMAGE" "$WORKER_IMAGE" <<'NODE'
const fs = require('fs');

// argv[0]=node, argv[1]='-' (script from stdin), argv[2..]=args
const file = process.argv[2];
const apiImage = process.argv[3];
const webhooksImage = process.argv[4];
const workerImage = process.argv[5];

if (!file.endsWith('.json')) {
  throw new Error(`Expected a JSON tfvars file (*.auto.tfvars.json): ${file}`);
}

const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);

const keys = [
  'api_green_image',
  'webhook_green_image',
  'worker_green_image',
  'api_green_desired_count',
  'webhook_green_desired_count',
  'worker_green_desired_count',
];
for (const k of keys) {
  if (!(k in obj)) {
    throw new Error(`Missing ${k} in tfvars (${file})`);
  }
}

obj.api_green_image = apiImage;
obj.webhook_green_image = webhooksImage;
obj.worker_green_image = workerImage;
obj.api_green_desired_count = 2;
obj.webhook_green_desired_count = 2;
obj.worker_green_desired_count = 2;

fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
NODE
