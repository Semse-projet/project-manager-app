#!/usr/bin/env bash
# Runs only against an isolated disposable PostgreSQL 16 GitHub Actions service.
# NEVER point this at Railway, production, or user-provided databases.
set -euo pipefail
if [[ "${SEMSE_P0_SYNTHETIC_DB:-}" != "1" || "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5433" || "${PGDATABASE:-}" != "semse_p0_synthetic" ||
      "${PGUSER:-}" != "semse" ]]; then
  echo "P0 SQL integration denied: ephemeral CI database guard missing" >&2
  exit 2
fi
# libpq can redirect a host=127.0.0.1 connection using PGHOSTADDR or
# a PGSERVICE definition; never load fixture SQL with alternate sources.
if [[ ${PGHOSTADDR+x} || ${PGSERVICE+x} || ${PGSERVICEFILE+x} ||
      ${PGSYSCONFDIR+x} || ${PGOPTIONS+x} ]]; then
  echo "P0 SQL integration denied: alternate libpq settings are not allowed" >&2
  exit 2
fi
# Every psql invocation pins host/port/user/db explicitly as defense in depth.
# This is CI's loopback mapped PostgreSQL service, NOT a Railway connection.
PSQL=(psql -X -q -h 127.0.0.1 -p 5433 -U semse -d semse_p0_synthetic -v ON_ERROR_STOP=1)
cd "$(dirname "$0")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

"${PSQL[@]}" -f fixture_postgres16_synthetic.sql

# The document, owner, project, grant, chunk and feedback match. The single
# active grant must block any activation even though all integrity checks pass.
"${PSQL[@]}" -t -A \
  -f prometeo_p0_historical_inventory_json_readonly.sql > "$tmp/consistent.json"
if python3 evaluate_inventory.py "$tmp/consistent.json" > "$tmp/consistent-result.json"; then
  echo "P0 synthetic grant did not force HOLD_CLASSIFICATION" >&2
  exit 1
else
  code=$?
  [[ "$code" -eq 1 ]] || exit "$code"
fi
python3 - "$tmp/consistent.json" "$tmp/consistent-result.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
result = json.load(open(sys.argv[2], encoding="utf-8"))
assert data["documents"]["documents_total"] == 1
assert data["grants"]["grants_active"] == 1
assert data["chunks"]["chunk_tenant_mismatch"] == 0
assert result["data_quality_assessment"] == "HOLD_CLASSIFICATION"
assert result["activation_decision"] == "NOT_AUTHORIZED_BY_THIS_AUDIT"
print("P0_POSTGRES16_SYNTHETIC_GRANT_CLASSIFICATION_PASS")
PY

# Synthetic cross-tenant child row: schema has no composite tenant/document FK.
# This tests the aggregate SQL detection path, not exploitation of production.
"${PSQL[@]}" -c \
  "INSERT INTO \"DocumentChunk\" VALUES ('fixture-inconsistent-chunk', 'fixture-other-tenant', 'fixture-doc', 2)"
"${PSQL[@]}" -t -A \
  -f prometeo_p0_historical_inventory_json_readonly.sql > "$tmp/mismatch.json"
if python3 evaluate_inventory.py "$tmp/mismatch.json" > "$tmp/mismatch-result.json"; then
  echo "P0 synthetic mismatch did not force HOLD_INTEGRITY" >&2
  exit 1
else
  code=$?
  [[ "$code" -eq 1 ]] || exit "$code"
fi
python3 - "$tmp/mismatch.json" "$tmp/mismatch-result.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
result = json.load(open(sys.argv[2], encoding="utf-8"))
assert data["chunks"]["chunk_tenant_mismatch"] == 1
assert result["data_quality_assessment"] == "HOLD_INTEGRITY"
assert "chunks.chunk_tenant_mismatch" in result["integrity_flags"]
assert result["activation_decision"] == "NOT_AUTHORIZED_BY_THIS_AUDIT"
print("P0_POSTGRES16_SYNTHETIC_CROSS_TENANT_CHUNK_DETECTION_PASS")
PY
