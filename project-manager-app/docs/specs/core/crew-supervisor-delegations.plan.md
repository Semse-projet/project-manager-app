---
type: plan
feature: "crew-supervisor-delegations"
domain: "core"
spec: "docs/specs/core/crew-supervisor-delegations.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/sdd-crew-supervisor-delegations-20261022"
date: "2026-10-22"
---

# Plan técnico — autoridad del supervisor

> **DOCUMENTO, NO IMPLEMENTACIÓN.** Requiere spec APPROVED, cierre de
> OPEN-SUP-01…06 y gates SDD 2.0 antes de código.

## 1. Snapshot de verdad

- Fuente: repo `Semse-projet/project-manager-app` rama `main`
  consultada el 2026-10-22; registrar SHA exacto de `main` al comenzar
  cada slice técnico (no reutilizar SHA de este borrador documental).
- SHA desplegado API/Web: **NO_VERIFIED**; sin consulta en Railway.
- Migraciones de staging/prod: **NO_VERIFIED**.
- Flags existentes BO-01, BO-05, BO-07 y BO-10: los specs declaran
  `INACTIVE` / `NOT_DEPLOYED`; verificar siempre contra entorno real.
- Hallazgo 1: `Crew.supervisorUserId` es referencia singular, sin fecha ni grants.
- Hallazgo 2: `createCrew` valida WORKER ACTIVE; `listMine`,
  `rosterForSupervisor` y `TaskAllocationsService.requireCrewScope`
  prueban cualquier membership ACTIVE. Requiere tests de bypass.
- Hallazgo 3: `Org` no declara dueño canónico y `PRO` conserva
  `org:crews:manage` pero carece de `org:offers:manage`. No inferir
  facultades de representación sin contrato explícito.
- Hallazgo 4: `TaskAllocation` reutiliza `JobTask` correctamente;
  no duplicar tareas ni alterar `TimeEntry`.

## 2. Constitution check

- [ ] Spec APPROVED antes de programar.
- [x] Límites tenant, org, crew, actor y acción definidos como requisitos.
- [x] Payment/Evidence excluidos de autoridad implícita.
- [ ] Eventos auditables homologados en `EVENT_CATALOG.md`.
- [ ] Tests rojos antes de parches.
- [x] Sin servicios paralelos, secretos ni cambios Railway en este PR.
- [x] CI, merge, deploy y activation separados.

## 3. Arquitectura y autoridad

- Fuente de escritura propuesta: `CrewSupervisorDelegation` en Prisma,
  transacciones de servicio + policy server-side.
- Fuente de permisos: `Membership` WORKER ACTIVE + grant ACTIVE
  + fechas + recurso + permission; nunca JWT claims solos.
- Read model: `/v1/crews/:crewId/me/authority` contextual,
  sin compensación ni información de otras crews.
- Reutilizar `CrewsService` y `TaskAllocationsService` tras un guard
  centralizado; no inventar permisos por pathname ni UI.
- Owner empresarial: **bloqueado por OPEN-SUP-01**. Ninguna persona
  con CLIENT/PRO accede por defecto a `org:supervisors:delegate`.
- No firmar con Documenso ni clasificar empleo desde este servicio.
- ADR: reconciliar `ADR-040` y capacidad activa por contexto,
  sin switch persistente incompatible con el contrato universal.
- Contracts Zod/BFF compartidos y validación ES/EN.

## 4. Datos y migración

- Nueva tabla aditiva, reversible solo por forward-fix seguro.
- Esquema, índices e integridad de grants temporales a revisar con DB.
- Sin backfill genérico: el `supervisorUserId` legacy no prueba
  autoridad vigente ni consentimiento de contrato.
- Dual-read/guard: con flag OFF no cambiar BO-07/BO-10 existente;
  con flag ON solo grants explícitos validados.
- Predeploy: `prisma migrate deploy`, checksum de SQL versionado;
  `db push` prohibido en prod.
- Rollback de feature: flag OFF + restauración de conducta legítima
  previo análisis de seguridad, no una política más permisiva.
- Prueba de integridad del historial: asignaciones, horas y Evidence intactos.

## 5. Seguridad y policy

| Acción | Condición positiva | Rechazo obligatorio |
|---|---|---|
| designar supervisor | owner/representante autorizado, misma org y crew | PRO/CLIENT no verificados |
| consultar mi autoridad | actor = subject, WORKER ACTIVE, grant vigente | tenant/org/crew ajena |
| asignar tarea | supervisor grant con `crew:tasks:assign`, persona de crew, tarea propia de org | grant vencido, task otra org |
| liberar asignación | `crew:tasks:release`, motivo auditable | liberar de otra crew |
| revisar trabajo | reviewer distinto del autor y permiso específico | autor = reviewer |
| verificar horas | permiso específico futuro | aprobar nómina por supervisor |
| revocar grant | delegante autorizado + versión + motivo | revocación repetida con nuevo efecto |
| cambiar de org | recalcular contexto, no persistir rol activo global | reutilizar autoridad anterior |

- PII y compensación fuera de respuestas, logs y reporte de autoridad.
- Sin API de mutación de Prometeo; consulta read-only, revalidada.
- Test de carrera entre revocación y creación de tarea:
  respuesta de task no puede dar éxito si su autorización ya fue revocada.
- La designación de OSHA competent person sigue proceso y formación legal separados.

## 6. Eventos, idempotencia y auditoría

- No inventar nombres: primero actualizar el catálogo de eventos y
  esquemas, después implementar `AuditLog` y outbox.
- Estado de delegación + audit + evento atómicos; version CAS.
- Idempotency key por solicitud; bloqueo ante grants superpuestos.
- Consumidores sin permiso de escribir grants.
- Rebuild/caché: no puede restaurar permisos revocados.
- Revocación confirmada debe reflejarse en la siguiente petición.

## 7. Estrategia por slices reversibles

### S0 — Contrato de guards existentes (seguridad, PR independiente)
1. Tests negativos: WORKER SUSPENDED pero PRO ACTIVE, sesión antigua,
   supervisor de crew archivada, cross-tenant, cross-org y cross-crew.
2. Determinar corrección mínima en `CrewsService` y `TaskAllocationsService`
   **solo** tras spec/permiso APPROVED; mantener flags BO apagados.
3. Pruebas de no-regresión del supervisor legítimo y del gestor autorizado.

### S1 — Política del propietario/representante (dependencia)
1. Cerrar OPEN-SUP-01/02/04 con contrato empresarial.
2. Control de delegar y revocar; no inferir permisos desde CLIENT/PRO.
3. Tests de empresario PRO legítimo, profesional ajeno, OPS_ADMIN
   y miembro de otra organización.

### S2 — Modelo de delegación y endpoints
1. Tests antes de migración/código; tabla, índices, vigencia y version.
2. Endpoints de crear/listar/revocar/mi autoridad, 401/403/404/409/422.
3. Auditoría + outbox; idempotencia; tests transaccionales y migración.

### S3 — UI y operación de cuadrilla
1. Integrar `/client/team`, `/worker/crew` y BuildOps reutilizando sus hooks.
2. Estado ES/EN; cambios de idioma sin perder datos; móvil y offline degradado.
3. Checklist del supervisor como información/contexto, no autorización.
4. Time Tracker y Evidence siguen siendo sus propias fuentes de verdad.

### S4 — Validación y entrega
1. Typecheck, lint, tests y `pnpm spec:validate:strict`.
2. Review independiente security/funcional, CI terminal y migración.
3. Merge solo aprobado; deploy y activación por separado.
4. Canary con 2 tenants, 2 orgs, 2 crews y usuarios sintéticos multi-rol;
   smoke autenticado + rollback ensayado.

## 8. Riesgos

| Riesgo | Impacto | Mitigación | Rollback |
|---|---|---|---|
| Acceso cross-crew | Alto | guard central y 404 neutro | flag OFF + investigar |
| OWNER no canónico | Crítico | bloquear delegación hasta contrato | no activar |
| Carrera revoke/task | Alto | transacción/CAS y tests | desactivar |
| Sobreasignar permisos financieros | Crítico | denegar explícitamente | no desplegar |
| Cortar trabajo legítimo | Medio | canary controlado y migración validada | pausar |
| Filtrar salarios/ubicación | Alto | proyección mínima y redacción | pausar |

## 9. Investigación externa

- OWASP Authorization Cheat Sheet (https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): revalidar cada petición, menor privilegio y deny-by-default.
- NIST RBAC (https://csrc.nist.gov/Projects/Role-Based-Access-Control/faqs): autorizado para rol y transacción; separación de funciones.
- OSHA Competent Person (https://www.osha.gov/competent-person): formación y autoridad específicas; el cargo digital no certifica.
- Aplicar: policy contextual y verificación en servidor.
- Backlog: supervisor de obra/general, gestión de materiales.
- Descartar: ROLE_SUPERVISOR global, aprobación de pagos por supervisar.

## 10. Gates para comenzar implementación

- [ ] Resolver OPEN-SUP-01…06 y dejar spec APPROVED.
- [ ] Obtener firma de revisión de seguridad del diseño.
- [ ] Indexar y validar documentación con comandos reales.
- [ ] Capturar SHA de main, CI y snapshots operativos con datos verificables.
- [ ] Dividir PRs S0-S4, priorizar S0 y no tocar producción sin autorización.
