# apps/worker

Procesadores de cola (BullMQ) y tareas asíncronas.

Responsabilidades:
- Runs de agentes IA.
- Procesamiento de evidencia (thumbnails, validaciones, scanning).
- Webhooks de pagos y reconciliación.
- Notificaciones por email/eventos.

Flujo API implementado:
1. `POST /v1/agents/runs/reclaim-stale` (periódico)
2. `POST /v1/agents/runs/claim`
3. `POST /v1/agents/runs/:runId/heartbeat`
4. `POST /v1/agents/runs/:runId/complete` o `.../fail`

## Ejecutar local

```bash
cd /home/yoni/labsemse/project-manager-app/apps/worker
pnpm start
```

## Variables de entorno

- `SEMSE_API_URL` (default: `http://localhost:4000`)
- `SEMSE_WORKER_ID` (default: `worker-local-<pid>`)
- `SEMSE_TENANT_ID` (default: `tnt_demo`)
- `SEMSE_USER_ID` (default: `usr_worker_001`)
- `SEMSE_ORG_ID` (default: `org_worker`)
- `SEMSE_ROLES` (default: `WORKER`)
- `SEMSE_POLL_MS` (default: `3000`)
- `SEMSE_HEARTBEAT_MS` (default: `2500`)
- `SEMSE_RUN_SIM_MS` (default: `4000`)
- `SEMSE_FAIL_RATE` (default: `0`, rango recomendado `0..1`)
- `SEMSE_RECLAIM_MS` (default: `10000`, intervalo para reclaim de runs stale)
- `SEMSE_STALE_AFTER_MS` (default: `10000`, antigüedad de heartbeat para considerar stale)
- `SEMSE_AGENT_TYPE` (opcional, filtra claims por tipo de agente)
