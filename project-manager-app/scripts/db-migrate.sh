#!/bin/sh
set -eu

PRISMA="./node_modules/.bin/prisma"
SCHEMA="./packages/db/prisma/schema.prisma"

echo "[db-migrate] applying reviewed Prisma migrations"
exec "$PRISMA" migrate deploy --schema "$SCHEMA"
