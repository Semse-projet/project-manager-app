#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

if [ ! -f "package.json" ]; then
  echo "ERROR: package.json not found. Run from project-manager-app root."
  exit 1
fi

echo "== SEMSE Web Validation =="

echo "1) TypeScript check"
pnpm exec tsc --noEmit --project apps/web/tsconfig.json

echo "2) Web build"
pnpm build:web

echo "3) Lint if available"
if pnpm --filter @semse/web lint; then
  echo "Lint passed"
else
  echo "Lint failed or not configured. Document this result if known existing config issue."
fi

echo "Validation complete"
