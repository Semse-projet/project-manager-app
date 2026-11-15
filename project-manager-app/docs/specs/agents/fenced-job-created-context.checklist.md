# Checklist de aceptación — AgentRun job.created scoped context

## Aislamiento y autorización
- [x] No se añaden projects:read, jobs:read ni OPS_ADMIN al rol AGENT_RUNNER.
- [x] El endpoint exige sesión firmada, permiso execute y claimToken HMAC.
- [x] Query de DB exige RUNNING, worker, attempts y tenant actual.
- [x] Job vinculado a clientOrgId y tenant de origen del evento.
- [x] Scope exacto de job.created/pricing/risk; correlación verificable.
- [x] No se pasa claimToken a agentes/handlers/LLMs o logs.
- [x] Reader bloquea otros Jobs, Projects, rutas y métodos de escritura.
- [ ] Tests HTTP de otro tenant/org y claim después de reclaim concurrente.
- [ ] Revisión humana independiente de posibles IDOR/capability leak.

## Funcionamiento y CI
- [x] E2E anterior: un Job sintético, pricing/risk COMPLETED (Actions #43765877708).
- [ ] E2E del SHA final incluyendo negativos HTTP.
- [ ] CI quality-gates + unit coverage + API Integration verde en HEAD final.
- [ ] pnpm spec:validate:strict y pnpm spec:index:check verdes.
- [ ] CodeQL/revisiones requeridas completas.
- [ ] Spec APPROVED por propietario antes de considerarlo listo.

## Producción
- [ ] GO/NO-GO humano explícito para merge/canary.
- [ ] SHA, deployment y API/Worker runtime comprobados.
- [ ] Sin reintento de las 12 ejecuciones antiguas ni pagos.
- [ ] Evidencia de ejecución nueva autenticada en versión productiva.
- [ ] Decisión separada sobre recuperación histórica y costos de staging.

NO-GO mientras cualquier gate de seguridad, CI o aprobación quede pendiente.
