# Agents Smoke Test (Local)

Valida rápidamente el flujo base de ejecución de agentes contra `apps/api`:

1. Crear run
2. Claim
3. Heartbeat
4. Complete
5. Verificar detalle
6. Reclaim stale

Notas:
- Los runs soportan `maxAttempts` al crearse (`POST /v1/agents/runs`).
- Al superar el máximo de intentos, reclaim puede marcar el run como `dead-letter` lógico.

## Prerrequisitos

- API corriendo en `http://localhost:4000` (o `SEMSE_API_URL`).
- Rol con permisos de agentes (`OPS_ADMIN` o `WORKER` para claim/heartbeat/reclaim).

## Ejecución

```bash
cd /home/yoni/labsemse/project-manager-app
./scripts/agent-flow-smoke.sh
```

## Variables opcionales

- `SEMSE_API_URL`
- `SEMSE_TENANT_ID`
- `SEMSE_USER_ID`
- `SEMSE_ORG_ID`
- `SEMSE_ROLES`
- `SEMSE_WORKER_ID`

## Ejemplo

```bash
SEMSE_API_URL=http://localhost:4000 \
SEMSE_ROLES=OPS_ADMIN,WORKER \
SEMSE_WORKER_ID=worker-local-01 \
./scripts/agent-flow-smoke.sh
```
