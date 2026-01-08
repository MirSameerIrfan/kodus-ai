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
const file = process.argv[2];

const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);

// TOGGLE LOGIC: Invert weights from 100/0 to 0/100
const isBlueActive = obj.api_blue_weight === 100;

console.log(`>>> Toggling weights!`);
console.log(`>>> From: BLUE=${obj.api_blue_weight}%, GREEN=${obj.api_green_weight}%`);

if (isBlueActive) {
  // If Blue was 100, Green now becomes 100
  obj.api_blue_weight = 0;
  obj.api_green_weight = 100;
  obj.webhook_blue_weight = 0;
  obj.webhook_green_weight = 100;
} else {
  // If Green was 100, Blue now becomes 100
  obj.api_blue_weight = 100;
  obj.api_green_weight = 0;
  obj.webhook_blue_weight = 100;
  obj.webhook_green_weight = 0;
}

console.log(`>>> To:   BLUE=${obj.api_blue_weight}%, GREEN=${obj.api_green_weight}%`);

fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
console.log(`✅ Success: Weights inverted in file ${file}.`);
NODE
