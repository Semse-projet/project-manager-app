#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WEB_PORT="${SEMSE_DEMO_WEB_PORT:-3301}"
API_PORT="${SEMSE_DEMO_API_PORT:-4301}"

printf '\n[demo] SEMSE demo start\n'
printf '[demo] repo: %s\n' "$ROOT_DIR"
printf '[demo] web port: %s | api port: %s\n' "$WEB_PORT" "$API_PORT"

if [ ! -d node_modules ]; then
  printf '[demo] node_modules missing -> running bootstrap:semse\n'
  npm run bootstrap:semse
fi

if ss -ltn "( sport = :$WEB_PORT or sport = :$API_PORT )" | tail -n +2 | grep -q .; then
  printf '[demo] port conflict detected on %s or %s\n' "$WEB_PORT" "$API_PORT"
  printf '[demo] either stop the previous demo process or rerun with custom ports, e.g.:\n'
  printf 'SEMSE_DEMO_WEB_PORT=3302 SEMSE_DEMO_API_PORT=4302 bash ./scripts/start-demo.sh\n'
  exit 1
fi

node ./scripts/demo-web-runtime.mjs
