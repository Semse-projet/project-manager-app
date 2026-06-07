#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${SEMSE_API_URL:-http://localhost:4000}"
TENANT_ID="${SEMSE_TENANT_ID:-tnt_demo}"
USER_ID="${SEMSE_USER_ID:-usr_ops_001}"
ORG_ID="${SEMSE_ORG_ID:-org_ops}"
ROLES="${SEMSE_ROLES:-OPS_ADMIN,WORKER}"
WORKER_ID="${SEMSE_WORKER_ID:-worker-smoke-001}"

hdr=(-H "content-type: application/json" \
     -H "x-tenant-id: ${TENANT_ID}" \
     -H "x-user-id: ${USER_ID}" \
     -H "x-org-id: ${ORG_ID}" \
     -H "x-roles: ${ROLES}")

echo "[1/6] Crear run"
create_payload='{"agentType":"risk","triggerType":"manual","correlationId":"smoke-corr-001"}'
create_res=$(curl -sS -X POST "${API_BASE_URL}/v1/agents/runs" "${hdr[@]}" -d "$create_payload")
run_id=$(printf '%s' "$create_res" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [[ -z "${run_id}" ]]; then
  echo "No se pudo crear run. Respuesta: $create_res"
  exit 1
fi
echo "run_id=${run_id}"

echo "[2/6] Claim run"
claim_payload="{\"workerId\":\"${WORKER_ID}\"}"
claim_res=$(curl -sS -X POST "${API_BASE_URL}/v1/agents/runs/claim" "${hdr[@]}" -d "$claim_payload")
echo "$claim_res" >/dev/null

echo "[3/6] Heartbeat"
heartbeat_payload="{\"workerId\":\"${WORKER_ID}\"}"
curl -sS -X POST "${API_BASE_URL}/v1/agents/runs/${run_id}/heartbeat" "${hdr[@]}" -d "$heartbeat_payload" >/dev/null

echo "[4/6] Complete"
complete_payload='{"output":{"summary":"smoke ok"}}'
curl -sS -X POST "${API_BASE_URL}/v1/agents/runs/${run_id}/complete" "${hdr[@]}" -d "$complete_payload" >/dev/null

echo "[5/6] Detalle final"
final_res=$(curl -sS "${API_BASE_URL}/v1/agents/runs/${run_id}" "${hdr[@]}")
echo "$final_res"

echo "[6/6] Reclaim stale (esperado 0 normalmente)"
reclaim_payload='{"staleAfterMs":1000,"maxItems":20}'
reclaim_res=$(curl -sS -X POST "${API_BASE_URL}/v1/agents/runs/reclaim-stale" "${hdr[@]}" -d "$reclaim_payload")
echo "$reclaim_res"

echo "Smoke test de agentes finalizado."
