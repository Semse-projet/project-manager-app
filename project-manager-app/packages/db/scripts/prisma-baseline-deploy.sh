#!/bin/sh
set -eu

echo "[prisma-deploy] applying reviewed Prisma migrations"
exec prisma migrate deploy
