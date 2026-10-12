#!/usr/bin/env bash
# Drill de restore de Postgres (F07). NO toca producción ni ninguna base existente.
#
# Uso:
#   scripts/backup/pg-restore-drill.sh <contenedor_origen> <usuario> <base>
# Ejemplo (base local de desarrollo):
#   scripts/backup/pg-restore-drill.sh semse-postgres semse semse
#
# Hace: pg_dump (custom) desde el contenedor origen -> contenedor DESECHABLE
# ($DRILL_PG_IMAGE, por defecto postgres:18) -> pg_restore -> compara conteos de tablas clave y migraciones
# fallidas -> mide tiempos parciales (NO es el RTO del servicio) -> destruye el contenedor y el dump.
# El dump contiene datos del origen: vive solo en un directorio temporal y se borra.
set -euo pipefail

SRC_CONTAINER="${1:?contenedor origen}"
SRC_USER="${2:?usuario}"
SRC_DB="${3:?base}"
DRILL_IMAGE="${DRILL_PG_IMAGE:-postgres:18}" # debe ser >= la versión del pg_dump que generó el dump
DRILL_CONTAINER="semse-restore-drill-$$"
DUMP_DIR="$(mktemp -d)"
DUMP_FILE="$DUMP_DIR/drill.dump"
KEY_TABLES=(Project Milestone PaymentEscrow PaymentTxn Evidence User Job Bid)

cleanup() {
  docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$DUMP_DIR"
}
trap cleanup EXIT

count() { # contenedor usuario base tabla
  docker exec "$1" psql -U "$2" -d "$3" -Atc "select count(*) from \"$4\"" | tr -d '\r'
}

t0=$(date +%s)
docker exec "$SRC_CONTAINER" pg_dump --format=custom --no-owner -U "$SRC_USER" "$SRC_DB" > "$DUMP_FILE"
t1=$(date +%s)
size=$(wc -c < "$DUMP_FILE")
if [ "$size" -lt 1024 ] || [ "$(head -c 5 "$DUMP_FILE")" != "PGDMP" ]; then
  echo "ERROR: dump vacío o inválido; se cancela la restauración" >&2
  exit 1
fi
sha=$(sha256sum "$DUMP_FILE" | cut -d' ' -f1)
echo "dump: ${size} bytes, sha256=${sha}, $((t1 - t0))s"

docker run -d --network none --name "$DRILL_CONTAINER" -e POSTGRES_PASSWORD=drill -e POSTGRES_USER=drill -e POSTGRES_DB=drill "$DRILL_IMAGE" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$DRILL_CONTAINER" pg_isready -U drill -d drill >/dev/null 2>&1 && break
  sleep 1
done

if ! docker exec "$DRILL_CONTAINER" pg_isready -U drill -d drill >/dev/null 2>&1; then
  echo "ERROR: el Postgres aislado no estuvo listo a tiempo" >&2
  exit 1
fi

t2=$(date +%s)
docker exec -i "$DRILL_CONTAINER" pg_restore --exit-on-error --no-owner -U drill -d drill < "$DUMP_FILE"
t3=$(date +%s)
echo "restore: $((t3 - t2))s"

fail=0
for tbl in "${KEY_TABLES[@]}"; do
  a=$(count "$SRC_CONTAINER" "$SRC_USER" "$SRC_DB" "$tbl")
  b=$(count "$DRILL_CONTAINER" drill drill "$tbl")
  if [ "$a" = "$b" ]; then echo "OK   $tbl origen=$a restaurado=$b"; else echo "FAIL $tbl origen=$a restaurado=$b"; fail=1; fi
done

# Un rollback histórico solo cuenta si la migración nunca se aplicó con éxito después.
failed=$(docker exec "$DRILL_CONTAINER" psql -U drill -d drill -Atc   "select count(distinct migration_name) from _prisma_migrations m where (finished_at is null or rolled_back_at is not null) and not exists (select 1 from _prisma_migrations ok where ok.migration_name = m.migration_name and ok.finished_at is not null and ok.rolled_back_at is null)" | tr -d '')
echo "migraciones sin aplicación exitosa en el restaurado: $failed"
[ "$failed" = "0" ] || fail=1

echo "total del drill: $(( $(date +%s) - t0 ))s (NO es RTO integral: excluye activación, usuarios, Redis y archivos)"
exit "$fail"
