---
type: checklist
feature: "crew-supervisor-delegations"
spec: "docs/specs/core/crew-supervisor-delegations.spec.md"
version: "2.0"
date: "2026-10-22"
---

# Checklist — designación y autoridad de supervisión

## Requisitos
- [x] Problema AS-IS y objetivo descritos sin inventar rol global.
- [x] Scopes org, tenant, crew y acción explicitados.
- [x] Separación identidad / relación comercial / cargo.
- [x] OPEN-SUP-01: solo propietario o representante verificado designa/revoca (aprobado 2026-10-22).
- [ ] Evidencia de titularidad/representación y guardas backend diseñados y probados.
- [ ] Elegibilidad, suplencia, capacidad y seguridad resueltas (OPEN-SUP-02…06).
- [ ] Contratos API/UI/agent ratificados; spec APPROVED.

## Seguridad y privacidad
- [ ] Política backend en toda ruta, incluidas list y roster.
- [ ] WORKER ACTIVE exigido aunque PRO siga ACTIVE.
- [ ] Revocación y expiración efectivas con token antiguo.
- [ ] Tests de mismo tenant/diferente owner, cross-org y cross-crew.
- [ ] Test supervisor sin membresía, crew/obra/Job archivados.
- [ ] Ratificar y ejecutar N01…N09 del contrato
      `docs/reportes/2026-10-25_s0a-supervisor-negative-test-contract.md`.
- [ ] Denegar aprobación propia y salarios privados.
- [ ] Prohibir cambio de ofertas, nómina y pagos sin autoridad externa.
- [ ] Registros auditables sin secretos, PII sensible ni geolocalización.
- [ ] OSHA competent person no se infiere por UI.

## Integridad S0b (nuevo contrato, aún no implementado)

- [x] Análisis estático S0b documentado en
  `docs/reportes/2026-10-26_s0b-allocation-atomicity-cross-crew-contract.md`.
- [ ] Ratificar D-S0B-01…05 en BO-10 y proteger origin `Crew`.
- [ ] Tests N10…N18, incluyendo error tardío, carrera P2002, cross-crew
  y audit transaccional, reproducibles en PostgreSQL.
- [x] Revisión documental de riesgo `AuditService/ActorContextService`:
  `docs/reportes/2026-10-26_s0b-audit-transaction-boundary-review.md`.
- [ ] Tests AUD-01…AUD-08 (sin creación de contextos sintéticos, tx audit,
  rollback, reintentos y compatibilidad de worker/bootstrap).
- [ ] Verificar que reintento y release nunca devuelven datos de otra crew.
- [ ] Conservar JobTask/TimeEntry/Evidence y no autorizar transferencias implícitas.

## Datos
- [ ] No romper Membership ni `Crew.supervisorUserId` legacy.
- [ ] Grant temporal y versión con constraints/concurrencia.
- [ ] Migración expand, checksum, backfill selectivo y rollback.
- [ ] Reintento/idempotencia no crea grants superpuestos.
- [ ] Revocación no borra historia de horas/evidencia.

## Eventos
- [ ] Estados y transiciones en `STATE_MACHINES.md`.
- [ ] Nombres/eventos añadidos primero al `EVENT_CATALOG.md`.
- [ ] Audit + outbox atómicos; consumers idempotentes.
- [ ] Replay no restaura privilegios revocados.

## Orden de ejecución confirmado (2026-10-22)

- [x] CI reservado para el **último gate de preparación** antes de merge,
  después de contratos, cambios, tests locales y revisión independiente.
- [x] Pendientes P-01…P-22 registrados en
  `docs/reportes/2026-10-22_supervisor-backlog-pending-and-ci-last.md`.
- [ ] Resolver pendientes críticos antes de solicitar CI final.
- [ ] CI terminal PASS requerido **antes de merge**; no suavizar gates.
- [ ] No cambiar producción ni asumir que despliegue = aceptación funcional.

## Operación y entrega
- [ ] ES/EN sin pérdida al cambiar idioma.
- [ ] UX loading/empty/ready/forbidden/degraded/revoked/error.
- [ ] Tests unitarios, API, integración, concurrentes y de regresión.
- [ ] Build, typecheck, lint, `pnpm spec:validate:strict`, índice y coverage.
- [ ] PR técnico security reviewed; CI terminal PASS.
- [ ] Merge autorizado, deploy y activación independientes.
- [ ] Canary sintético con 2 orgs/crews y un actor PRO+WORKER.
- [ ] Smoke autenticado y rollback ensayado antes de trabajadores reales.
- [ ] Evidencia de prod si y solo si se ha verificado.

## Revisión documental de esta rama
- [x] Nuevo spec y archivos plan/tasks/checklist se mantienen separados.
- [x] No cambia API, schema, roles, flags ni entorno productivo.
- [ ] Validación automática de specs y CI ejecutados sobre este PR.
- [x] Aprobación específica del principio OPEN-SUP-01 por el dueño del producto.
- [ ] Aprobación global de la spec y decisiones restantes OPEN-SUP-02…06.
