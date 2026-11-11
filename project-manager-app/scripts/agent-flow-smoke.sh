#!/usr/bin/env bash
set -euo pipefail

# Contrato de testing local, NO smoke de producción. No aceptar un host remoto.
API_BASE_URL="${SEMSE_API_URL:-http://localhost:4000}"
case "$API_BASE_URL" in
  http://localhost:*|http://127.0.0.1:*) ;;
  *) echo "Agent smoke solo admite API en loopback" >&2; exit 2 ;;
esac
TENANT_ID="${SEMSE_TENANT_ID:-tnt_demo}"
USER_ID="${SEMSE_USER_ID:-usr_ops_001}"
ORG_ID="${SEMSE_ORG_ID:-org_ops}"
ROLES="${SEMSE_ROLES:-OPS_ADMIN,AGENT_RUNNER}"
WORKER_ID="${SEMSE_WORKER_ID:-worker-smoke-001}"

# Header identity must be explicitly opted into by the isolated test API.
# OPS_ADMIN here is the test creator, AGENT_RUNNER represents a synthetic
# service capability. Never use this combined-role identity in staging/prod.
hdr=(-H "content-type: application/json" \
     -H "x-tenant-id: ${TENANT_ID}" \
     -H "x-user-id: ${USER_ID}" \
     -H "x-org-id: ${ORG_ID}" \
     -H "x-roles: ${ROLES}")

parse_field() {
  local key="$1"
  node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{try{const obj=JSON.parse(s);const v=obj?.data?.[process.argv[1]];if(v===undefined||v===null)process.exit(2);process.stdout.write(String(v));}catch{process.exit(2)}})' "$key"
}
echo "[1/7] Crear run (entorno aislado)"
create_payload='{"agentType":"risk","triggerType":"manual","correlationId":"smoke-corr-001"}'
create_res=$(curl -fsS -X POST "${API_BASE_URL}/v1/agents/runs" "${hdr[@]}" -d "$create_payload")
run_id=$(printf '%s' "$create_res" | parse_field id)
[[ -n "$run_id" ]] || { echo "Create sin runId" >&2; exit 1; }
echo "run_id=$run_id"

echo "[2/7] Reclamar run específico"
claim_payload="{\"workerId\":\"${WORKER_ID}\",\"runId\":\"${run_id}\"}"
claim_res=$(curl -fsS -X POST "${API_BASE_URL}/v1/agents/runs/claim" "${hdr[@]}" -d "$claim_payload")
claimed_run=$(printf '%s' "$claim_res" | parse_field id)
claim_token=$(printf '%s' "$claim_res" | parse_field claimToken)
attempts=$(printf '%s' "$claim_res" | parse_field attempts)
[[ "$claimed_run" == "$run_id" && "$attempts" =~ ^[1-9][0-9]*$ && "${#claim_token}" -ge 32 ]] ||
  { echo "Claim no devolvió la capacidad del run solicitado" >&2; exit 1; }
# claim_token is intentionally never printed.

lifecycle_payload="{\"workerId\":\"${WORKER_ID}\",\"expectedAttempts\":${attempts},\"claimToken\":\"${claim_token}\"}"
echo "[3/7] Confirmar inicio protegido"
curl -fsS -X POST "${API_BASE_URL}/v1/agents/runs/${run_id}/start" "${hdr[@]}" -d "$lifecycle_payload" >/dev/null
echo "[4/7] Heartbeat con capacidad privada"
curl -fsS -X POST "${API_BASE_URL}/v1/agents/runs/${run_id}/heartbeat" "${hdr[@]}" -d "$lifecycle_payload" >/dev/null
echo "[5/7] Completar con capacidad privada"
complete_payload="{\"output\":{\"summary\":\"smoke ok\"},\"workerId\":\"${WORKER_ID}\",\"expectedAttempts\":${attempts},\"claimToken\":\"${claim_token}\"}"
curl -fsS -X POST "${API_BASE_URL}/v1/agents/runs/${run_id}/complete" "${hdr[@]}" -d "$complete_payload" >/dev/null

echo "[6/7] Verificar estado terminal"
final_res=$(curl -fsS "${API_BASE_URL}/v1/agents/runs/${run_id}" "${hdr[@]}")
status=$(printf '%s' "$final_res" | parse_field status)
[[ "$status" == "completed" ]] || { echo "Estado final inesperado: $status" >&2; exit 1; }
echo "estado=$status"

echo "[7/7] Reclaim de prueba"
curl -fsS -X POST "${API_BASE_URL}/v1/agents/runs/reclaim-stale" "${hdr[@]}" -d '{"staleAfterMs":1000,"maxItems":20}' >/dev/null
echo "Smoke de agentes PASS (solo API local sintética; no prueba BullMQ ni staging)."
