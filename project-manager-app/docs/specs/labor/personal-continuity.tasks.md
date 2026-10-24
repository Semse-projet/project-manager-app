---
type: tasks
feature: "personal-continuity"
domain: "labor"
plan: "docs/specs/labor/personal-continuity.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/personal-continuity-f1b-20261024"
date: "2026-10-24"
---

# Backlog F1B — Continuidad y custodia personal (sin implementar)

## F0 — Investigación / arquitectura

- [x] [F1B-001] Verificar en `main` que login exige Membership ACTIVE, registra Org propia y sesión contiene tenant/org obligatorios.
- [x] [F1B-002] Verificar `TimeEntry`, `FreeProject` y `Tenant` con FK `onDelete: Cascade`.
- [x] [F1B-003] Revisar ADR-029, ADR-040, Identity multirol y Business Access Foundation para evitar bypass.
- [x] [F1B-004] Redactar ADR-WPI-002 Proposed y spec F1B DRAFT.
- [ ] [F1B-005] Validar versión real del auth pipeline, guards, BFF, SSE, mobile y agentes con responsables.
- [ ] [F1B-006] Resolver categorías elegibles, datos de empresa, conservación, borrado y legal hold (Legal/Privacy).
- [ ] [F1B-007] Confirmar decisión humana de principal PERSONAL y custodia derivada; aprobar ADR y spec.
- [ ] [F1B-008] Coordinar con #1035 programa, #1036 F1A y #933 S1; una sola paginación/export.
- [ ] [F1B-009] Registrar SHA actual, estado de migración, flags reales y métricas de auth antes de código.

## F1B-A — Auth personal separada (tras aprobación)

- [ ] [F1B-101] Tests rojos login sin Membership, revocación de Org y suspensión User.
- [ ] [F1B-102] Tests de token PERSONAL rechazado por todas las rutas ORG, Admin, Jobs, Evidence, Pago, SSE, agents y Worker.
- [ ] [F1B-103] Definir discriminación de principal, sesiones, refresh/logout/step-up, sin degradar autenticación actual.
- [ ] [F1B-104] Implementar micro-slice auth personal compatible, sin cambio global de roles.
- [ ] [F1B-105] Verificar latencia/fail-closed de sesión y no aceptar claims libres.

## F1B-B — Archivo derivado, no motor de horas

- [ ] [F1B-201] Definir `recordClass` y `retentionClass` por Legal/Privacy.
- [ ] [F1B-202] Tests negativos de over-sharing (GPS, fotos, notas empresa, salarios y Job).
- [ ] [F1B-203] Modelo cifrado derivado owner `User.id` + hash/provenance + estado.
- [ ] [F1B-204] Outbox transaccional de fuente elegible, idempotencia/consumer/replay y DLQ.
- [ ] [F1B-205] Revisión/corrección produce versión trazable, nunca muta TimeEntry por copiar.
- [ ] [F1B-206] Protocolo de backfill con autorización y política legal, sin `createdBy` global cross-tenant.

## F1B-C — Acceso, exportación, móvil

- [ ] [F1B-301] API `/me/personal-records` a validar con API_SURFACE y seguridad, sin escoger tenant cliente.
- [ ] [F1B-302] Tests A/B mismo tenant, C externo, sesión sin Org, Job de X revocado.
- [ ] [F1B-303] Cuotas, corte consistente, redacción, autenticación de descargas y auditoría.
- [ ] [F1B-304] UI ES/EN y móvil con distinción source/derived/pending, sin pérdidas offline.
- [ ] [F1B-305] Compartición opt-in en contrato propio, nunca automática por Membership.

## F1B-D — Retención, restauración y entrega

- [ ] [F1B-401] Simular eliminación de Tenant X tras recibo confirmado (jamás tenant productivo).
- [ ] [F1B-402] Fallo de proyección y source_deleted antes del receipt: no prometer copia inexistente.
- [ ] [F1B-403] Backup/restore, llaves, periodos legales, supresión y legal hold.
- [ ] [F1B-404] Revisión independiente de seguridad, privacidad y modelo DB.
- [ ] [F1B-405] Smoke sintético autenticado, A/B/C, sin Org, User suspendido, ES/EN.
- [ ] [F1B-406] Rollback y forward-fix en ensayo aislado.
- [ ] [F1B-407] **CI al final**: index + validate strict + tests + typecheck/build/lint y evidencia terminal.
- [ ] [F1B-408] Solicitar merge/deploy/activación sólo con autorizaciones separadas y evidencias completas.

**Estado:** diseño documental, no implementación ni pruebas ejecutadas.

## G0 — Hallazgos adicionales de autorización (PRE-CODE)

- [x] [F1B-010] Leer `AuthGuard`, `RbacGuard`, `RequestContext`, `appRoleFromRoles`, middleware/cookie, `sanitizeSemseIdentityHeaders` y SSE en main.
- [x] [F1B-011] Documentar el riesgo futuro de `@AuthenticatedAccess` sin clase de principal y de `appRoleFromRoles([])=client` — no afirmar explotación actual.
- [ ] [F1B-012] Diseñar discriminante en token SEMSE HMAC de dos partes + sesión durable `principalKind` y `audience`, política de tokens legacy y revocación.
- [ ] [F1B-013] Definir policy `@AuthenticatedPersonalAccess` (nombre provisional), autorización de archivo self y denegación ORG-only por defecto.
- [ ] [F1B-014] Añadir casos negativos de `@AuthenticatedAccess` organizacional, rutas del middleware, BFF headers, SSE/Worker/Prometeo y tokens desconocidos.
- [ ] [F1B-015] Revisar latencia/carga de Auth bajo clase PERSONAL, timeout fail-closed y la fuente durable de permisos antes de implementation.
