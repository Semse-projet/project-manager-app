---
type: plan
feature: "Mission Control 2.0 F4"
domain: "operations"
spec: "docs/specs/operations/mission-control-2.spec.md"
version: "2.0"
status: "APPROVED"
branch: "feat/f4-mission-control-2"
date: "2026-07-31"
---

# Plan técnico: Mission Control 2.0 F4

## 1. Snapshot de verdad

- Base Git al especificar: `origin/main@fa9a10db867603e10bf673979775278eb1ce2ef5`.
- Producción previa confirmada: `114cb9ca`; el deploy del cierre TLS `fa9a10db`
  se verifica por separado antes de implementar.
- API/Web/Worker/Vision previos: `SUCCESS`.
- Mission Control actual: summary, señales, SSE, Observer, worker metrics,
  intelligence runs y UI parcial; no existe cola normalizada ni receipt común.
- Replay de eventos ya exige reason y AuditLog; sirve como adapter de referencia.
- Retry/requeue AgentRun, pause/resume loops y ejecución nominal de runbook no
  comparten reason, idempotency o receipt.
- `reportIncident` de Ops sólo crea AuditLog y retorna un ID efímero; no es un
  incidente operacional durable.
- El stream Mission Control es `@Public` y mezcla un canal global; el servicio de
  incidentes AI puede publicar un item tenant-scoped también al global.
- Flags F4 no existen todavía y se crearán default-off.

## 2. Constitution check

- [x] Spec `APPROVED` antes de código.
- [x] Tenant/global scope y RBAC definidos.
- [x] Evidence/Payment sólo lectura/enlace; no release ni aprobación.
- [x] Audit, reason, runbook, receipt e idempotencia definidos.
- [x] Tests rojos preceden implementación.
- [x] No hay backend paralelo ni acceso Prisma desde agentes.
- [x] Código, CI, merge, deploy y canary se medirán por separado.

## 3. Arquitectura y autoridad

- Fuente de verdad: cada módulo propietario (`OperationalSignal`, outbox,
  AgentRun, loops, approvals, incidentes).
- Read model: normalizador F4 calculado, paginado y tenant-scoped sobre fuentes
  de dominio más readiness/Observer/Worker; no tabla duplicada de excepciones.
- Escritura F4: `MissionControlActionReceipt` + adapter allowlisted.
- Contratos Zod: filtros/cursor, action request, receipt y runbook descriptor.
- UI/BFF: tres endpoints F4 y SSE existente endurecido.
- Worker: no worker nuevo; adapters reutilizan colas existentes.
- Agentes: Prometeo sólo resume/explica en este slice.
- ADR: no requerido si se preservan ADR-022 y autoridad existente; documentar
  la decisión en spec/API/event catalog.

## 4. Datos y migración

- Añadir `MissionControlActionReceipt` y columnas opcionales de
  `MissionControlIncident`.
- Migración aditiva, compatible con API previa.
- Sin backfill; defaults/nullable conservan incidentes AI.
- Unique `(tenantId,idempotencyKey)` e índices de estado/target/correlation.
- Pre-deploy: `prisma migrate deploy`.
- Rollback de código: flags off + UI previa.
- Rollback de datos: no drop; forward-fix.
- Test: aplicar historial completo sobre PostgreSQL limpio y fixture pre-F4.

## 5. Seguridad y política

- Lectura: `ops:dashboard:read`.
- Acción: `ops:dashboard:write`; replay además aplica policy OPS_ADMIN y adapter
  `domain-events:replay`.
- Tenant se deriva de sesión; target cross-tenant devuelve 404.
- Loops son scope global explícito, sólo IDs canónicos.
- Reason/runbook/idempotency obligatorios; no comandos libres.
- Receipt/AuditLog no guardan secretos ni payloads completos.
- Corregir publicación tenant→global antes del canary.

## 6. Idempotencia, receipts y reconstrucción

- Crear/reclamar receipt antes del adapter.
- Hash de intención detecta misma key con payload diferente.
- Lease evita dos operadores concurrentes y permite recuperar `RUNNING` stale.
- Adapters deben ser idempotentes o convertir el estado ya convergido en
  `NO_OP`.
- GET reconstruye excepciones desde fuentes canónicas.
- SSE no es fuente de verdad.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- Reemplazar lógica copiada de `ops-mission-control.test.ts` por pruebas al
  servicio real.
- Tests de normalización, policy, idempotencia, 404 tenant y SSE.
- Schemas request/response y catálogo de runbooks.

### Fase B — Datos y dominio

- Migración, repositorio de receipts y normalizador de excepciones.
- Action service con registry de adapters y leases.
- Incidente operacional durable.

### Fase C — API/BFF/UI

- GET exceptions/runbooks y POST actions.
- BFF con sesión server-side.
- UI exception-first y diálogo gobernado.
- Endurecer SSE tenant/global.

### Fase D — Verificación local/CI

- Tests dirigidos + integración PostgreSQL.
- Workspace verify, build/typecheck/lint y Spec Kit.
- Prisma audit/checksum.

### Fase E — Integración

- PR único reversible de implementación.
- CI/CodeQL/E2E terminales.
- Merge SHA y migración en Git.

### Fase F — Producción

- Deploy terminal API/Web/Worker/Vision.
- Confirmar migration, health y logs.
- Configurar flags default-off y allowlist `tenant_default`.
- Smoke OPS_ADMIN + pruebas sintéticas declaradas en spec.
- Medir receipts/errors/duplicates; activar canary o rollback.

## 8. Riesgos

| Riesgo | Prob. | Impacto | Mitigación | Rollback |
|---|---|---|---|---|
| Acción duplicada | media | crítico | key+hash+lease+adapter idempotente | flag off |
| Fuga SSE cross-tenant | media | crítico | no tenant→global + tests A/B | apagar F4/SSE |
| Receipt dice éxito sin efecto | media | alto | result del adapter + tests conflicto | pausar acción |
| Loop global afectado | baja | alto | IDs canónicos, dry-run, confirmación | resume + flag off |
| Migración incompatible | baja | alto | aditiva + fixture pre-F4 | forward-fix |
| UI degrada por una fuente | alta | medio | partial results + sourceErrors | UI previa |

## 9. Investigación externa

| Fuente primaria | Decisión |
|---|---|
| AWS Builders' Library: idempotent APIs | key explícita, misma intención y no doble efecto |
| Google SRE: incident management | cockpit único, estado vivo, roles y evidencia |
| OpenTelemetry Context | correlation cruza API, receipt y adapter |
| RFC 9457 | códigos de problema estables; adopción global fuera de scope |

## 10. Gates antes de tareas

- [x] Archivos y módulos propietarios identificados.
- [x] Migración/compatibilidad/rollback definidos.
- [x] Tests ordenados antes del código.
- [x] Flags y canary definidos.
- [x] Evidencia requerida por etapa separada.
- [x] Scope cabe en un PR de implementación reversible.
