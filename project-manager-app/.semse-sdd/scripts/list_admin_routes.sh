#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
ADMIN_DIR="$ROOT/apps/web/app/(app)/admin"

if [ ! -d "$ADMIN_DIR" ]; then
  echo "ERROR: Admin dir not found: $ADMIN_DIR"
  exit 1
fi

find "$ADMIN_DIR" -type f \( -name 'page.tsx' -o -name 'layout.tsx' -o -name 'route.ts' \) \
  | sed "s#^$ROOT/apps/web/app/(app)##" \
  | sort
