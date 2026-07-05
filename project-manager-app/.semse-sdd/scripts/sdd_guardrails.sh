#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

echo "== SEMSE SDD Guardrails =="

if git diff --name-only | grep -E '(^|/)prisma/|schema\.prisma|migrations/' >/dev/null; then
  echo "WARNING: Prisma or migration files changed. Confirm this is allowed for the current phase."
else
  echo "OK: No Prisma/migration changes detected."
fi

if git diff --name-only | grep -E '^apps/api/' >/dev/null; then
  echo "WARNING: apps/api changed. Confirm backend changes are allowed for the current phase."
else
  echo "OK: No apps/api changes detected."
fi

if git diff --name-only | grep -E 'railway\.json|Dockerfile|\.env' >/dev/null; then
  echo "WARNING: Infra/environment files changed. Confirm Railway changes are allowed."
else
  echo "OK: No Railway/env infra changes detected."
fi

echo "Changed files:"
git diff --name-only
