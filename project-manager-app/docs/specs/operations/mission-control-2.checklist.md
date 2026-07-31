---
type: checklist
feature: "Mission Control 2.0 F4"
spec: "docs/specs/operations/mission-control-2.spec.md"
version: "2.0"
date: "2026-07-31"
---

# Checklist: Mission Control 2.0 F4

## Gate de análisis spec ↔ plan ↔ tasks ↔ constitución

- [x] El problema se verificó en código y no depende de síntesis histórica.
- [x] El read model no absorbe autoridad de dominios.
- [x] Las acciones del roadmap tienen target, permiso, reason, runbook,
  idempotencia, receipt y rollback.
- [x] Migración, compatibilidad y forward-fix están definidos.
- [x] Tests preceden código y el canary está acotado.
- [x] No quedan contradicciones bloqueantes entre artefactos.

Hallazgos vinculantes del análisis:

1. La UI actual consulta cinco fuentes por separado y no incluye
   outbox/DLQ, AgentRun, approvals ni loops en una cola común.
2. `OperationalSignalsService.resolve/dismiss/acknowledge` sólo cambia estado;
   no registra actor, reason, runbook ni receipt.
3. retry/requeue y pause/resume carecen de reason/idempotency/receipt común.
4. replay de dominio ya tiene reason, terminal-state guard y AuditLog; se
   reutiliza, no se reimplementa.
5. el stream `mission-control` es público y mezcla canal global; un incidente
   tenant-scoped puede publicarse además al global. Debe corregirse antes del
   canary.
6. `apps/api/test/ops-mission-control.test.ts` copia `nextAction` en el test en
   vez de ejecutar el servicio real.
7. `OpsService.reportIncident` sólo audita y devuelve un ID generado; no
   persiste un incidente operacional consultable.
8. Los módulos existentes son suficientes; no se crea un backend paralelo.

## Requisitos y UX

- [x] Cada escenario P1 es verificable.
- [x] Scope y no-objetivos evitan mutaciones económicas.
- [x] API/UI/Prometeo no se contradicen.
- [x] Degraded state identifica la fuente fallida.
- [x] Resolve no se confunde con corrección real de la causa.

## Seguridad

- [x] Permisos backend y rol privilegiado definidos.
- [x] Tenant, scope global de loops y 404 cross-tenant definidos.
- [x] Confirmación, reason y runbook existen para toda mutación.
- [x] No hay shell/SQL/runbook arbitrario.
- [x] SSE tenant/global tiene test y gate explícito.
- [x] No hay secretos ni payloads completos en receipt/audit.

## Datos, idempotencia y eventos

- [x] Migración aditiva y compatible definida.
- [x] Rollback por flags y forward-fix definidos.
- [x] Key+hash+lease y estados de receipt definidos.
- [x] Adapters y no-op para estado convergido definidos.
- [x] SSE no es fuente de verdad; GET reconstruye.
- [x] No se inventa un evento nuevo sin atomicidad demostrable.

## Entrega pendiente

- [ ] Tests rojos confirman los gaps.
- [ ] Implementación y migración pasan PostgreSQL real.
- [ ] Build/typecheck/lint/workspace y Spec Kit pasan.
- [ ] CI, merge, deploy y activación tienen evidencia separada.
- [ ] Health no sustituye el smoke OPS_ADMIN.
- [ ] Canary/rollback y métricas se verifican en producción.
- [ ] `production_evidence` no contiene secretos.

## Documentación pendiente

- [x] Spec index regenerado con F4.
- [ ] API surface/matriz/roadmap/runbook actualizados en implementación.
- [x] Investigación externa y decisiones registradas.
