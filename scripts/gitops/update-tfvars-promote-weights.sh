#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <tfvars-file>" >&2
  exit 2
fi

FILE="$1"

if [ ! -f "$FILE" ]; then
  echo "tfvars file not found: $FILE" >&2
  exit 1
fi

node - "$FILE" <<'NODE'
const fs = require('fs');

// argv[0]=node, argv[1]='-' (script from stdin), argv[2..]=args
const file = process.argv[2];

if (!file.endsWith('.json')) {
  throw new Error(`Expected a JSON tfvars file (*.auto.tfvars.json): ${file}`);
}

const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);

const keys = ['api_blue_weight','api_green_weight','webhook_blue_weight','webhook_green_weight'];
for (const k of keys) {
  if (!(k in obj)) {
    throw new Error(`Missing ${k} in tfvars (${file})`);
  }
}

obj.api_blue_weight = 0;
obj.api_green_weight = 100;
obj.webhook_blue_weight = 0;
obj.webhook_green_weight = 100;

fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
NODE
