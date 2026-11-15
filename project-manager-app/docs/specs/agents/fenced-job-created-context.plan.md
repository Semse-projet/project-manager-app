# Plan — AgentRun #1161: contexto acotado en job.created

**Estado:** revisión humana pendiente (SDD DRAFT). **Dependencia:** issue #1147 y regresión E2E del PR #1160.

## Fase 0 — Reproducibilidad

- Demostrar 403 con API firmada, Worker real, PostgreSQL y Redis efímeros.
- Mantener identidad de servicio limitada a AGENT_RUNNER. Prohibido copiar credenciales productivas.
- Evidencia: GitHub Actions 43764752468 (ambos FAILED por projects:read).

## Fase 1 — Contrato y aislamiento

- Requisito API: entrada workerId + expectedAttempts + claimToken HMAC.
- Confrontar run RUNNING, worker, intento, tenant, trigger y eventPayload con DB.
- Resolver Job por tenant y clientOrgId del operador originador; nunca desde IDs sin ownership.
- Proyección mínima y lector Worker deny-by-default; claimToken no entra a handlers.

## Fase 2 — Verificación

- Unit tests para tenant, org, claim generation, evento, objeto ausente y métodos no GET.
- E2E real con un Job sintético; exactamente pricing/risk COMPLETED.
- HTTP negativos: HMAC inválido, CLIENT sin rol, run terminal, intento obsoleto.
- CI: SDD strict, spec index, API integration, coverage, quality gates, E2E, CodeQL.

## Fase 3 — Gobierno

- Review independiente de seguridad y SDD; aprobación humana.
- Fusionar solo con SHA probado y gates verdes. Sin reintentos históricos.
- Producción: canary separado y autorizado, health/trace/ownership y rollback.
- Cierre de #1147 sólo después de evidencia runtime en versión actual y decisión histórica independiente.

**Rollback:** revertir endpoint y lector juntos; sin migración de BD. **Prohibiciones:** grants globales a AGENT_RUNNER, pagos, tocar producción o replay de 12 ejecuciones.
