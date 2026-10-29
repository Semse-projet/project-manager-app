---
id: "labor.free-project-archive-restore"
title: "Labor Engine S1 — historial y restauración segura de FreeProject"
domain: "labor"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/labor-engine/labor-engine.controller.ts
  - apps/api/src/modules/labor-engine/labor-engine.service.ts
  - apps/api/src/modules/labor-engine/labor-engine.repository.ts
  - apps/web/app/(app)/worker/tracker/sections/ProyectosTab.tsx
  - apps/web/app/(app)/worker/tracker/sections/RegistrosTab.tsx
  - apps/web/app/(app)/worker/tracker/sections/ResumenTab.tsx
  - apps/web/app/(app)/worker/tracker/sections/ReportesTab.tsx
  - apps/web/app/(app)/worker/tracker/sections/trackerUi.tsx
related_tests: []
related_endpoints:
  - GET /v1/labor/free-projects
  - GET /v1/labor/free-projects/:id
  - POST /v1/labor/free-projects/:id/restore
related_events: []
related_agents: []
last_verified: "NOT_VERIFIED"
---

# S1: FreeProjects archivados, restauración y nombres históricos

**DRAFT, NO AUTORIZA IMPLEMENTACIÓN.** EPIC #935; issue #933. S0 guard por createdBy ya implementado (#937 y #945), pero UAT autenticado completo S0 sigue pendiente. Fuente: inspección de main, NO verificación funcional de producción.

## 1. Problema y resultado

El listado actual en labor-engine.repository.ts excluye status archived. ProyectosTab permite archivar pero no listar archivos/restaurarlos. Registros, Resumen y Reportes usan resolveEntryProject y pierden etiqueta de FreeProject archivado al no recibirlo. TimeEntry conserva freeProjectId. Resultado: propietario abre Activos/Archivados/Todos, consulta detalle, restaura con auditoría y sigue viendo nombre histórico, sin alterar una sola hora.

## 2. Alcance

- GET /v1/labor/free-projects?status=active|archived|converted|all. Sin query, preservar listado actual que omite archivados. El status inválido devuelve 400. Siempre scope tenantId + createdBy.
- GET /v1/labor/free-projects/:id, incluido archivado, sólo owner; 404 para ajeno/inexistente.
- POST /v1/labor/free-projects/:id/restore, dueño únicamente con field-ops:write, guarda estado mediante CAS y AuditLog en la misma transacción. Sin PATCH de status, prohibido desde S0.
- Proyectos muestra filtros, ficha completa, detalle/historial y acción Restaurar; traducciones ES/EN. Archived no da acceso para editar/convertir/fichar.
- Registros/Resumen/Reportes/CSV muestran nombre/color de proyectos archivados visibles por propiedad, sin duplicar nombres en TimeEntry.

**Fuera de alcance:** exportación íntegra y paginación TimeEntry (PR #1036), helper CSV/inyección fórmulas y offline sync origin (PR #1039), continuidad fuera de tenant (PR #1037), mapa/geocoding (issue #931), permisos del patrón/crew (issue #934), fotos/Evidence/backups, finanzas, reatribución de horas.

## 3. Actores y permiso backend

| Actor | Leer propios | Restaurar propios | Proyectos ajenos |
| --- | --- | --- | --- |
| WORKER/PRO con field-ops:read y write según acción | Sí | Sí, con status válido | No, 404 |
| Otra persona de la misma Org y tenant | Sólo los propios | Sólo los propios | No, 404 |
| Otra Org/tenant | Sólo propios en ámbito autorizado | Sólo propios | No |
| OPS_ADMIN | Sin override de personal ajeno (S0 D5/D10) | No | No por defecto |
| Anónimo/rol sin permiso | 401/403 | 401/403 | No |

TenantId acota, createdBy autoriza. La asociación a un Job convertido es dato histórico, **nunca** un grant actual. Sin exposición de nombre/dirección/coordenadas en logs o AuditLog. Cambiar membership no permite lectura cross-tenant.

## 4. P1 y casos de aceptación

P1 Archivo legible: usuario propietario crea FreeProject F y TimeEntry E; archiva F; GET legado lo oculta, GET status archived y GET /F lo devuelven; E sigue exactamente igual, y Registros/Resumen/Reportes/CSV muestran nombre de F.

P1 Restauración: owner hace POST restore sobre F archived; estado según S1-D1, 200, audit en misma transacción, entrada E sin ninguna mutación.

P1 Aislamiento: B en el mismo tenant conoce ID de A; B no puede listar, GET detalle ni restaurar F de A; respuestas 404 y ninguna escritura. B de otro tenant idéntico.

| Caso | Resultado exigido |
| --- | --- |
| A1: listado legacy y filtered | Legacy compatible, archived/all sólo owner |
| A2: restored de antiguo active | 200 active, un AuditLog |
| A3: converted archived con convertedJobId J | S1-D1, nunca habilita acceso a J |
| A4: repetir restore | S1-D2, sin doble audit |
| A5: GET/restore recurso ajeno mismo tenant | 404 sin datos ni mutación |
| A6: otro tenant/anon/sin permiso | 404/401/403 según permiso |
| A7: dos restore concurrentes | Sólo un CAS y audit |
| A8: carrera archivar/convertir/restaurar | Estado legal y consistente |
| A9: comparar TimeEntry antes/después | Id, fechas, duración, owner, Job y descansos idénticos |
| A10: resolver nombre en 4 vistas y CSV | Igual etiqueta, sin fugas |
| A11: >500 TimeEntry | No afirmar total íntegro; coordinación F1A |
| A12: falla red/reintento/offline | No éxito falso ni doble escritura |

## 5. Contratos

GET /v1/labor/free-projects: auth required; permission field-ops:read; query status opt-in o legacy default; output FreeProjectView[] owner-only; errors 400/401/403; sin efectos de estado.

GET /v1/labor/free-projects/:id: auth required; permission field-ops:read; output FreeProjectView owner-only; errors 401/403/404; sin efectos.

POST /v1/labor/free-projects/:id/restore: auth required; permission field-ops:write; input cuerpo vacío; output FreeProjectView owner-only; errors 401/403/404/409; efecto CAS archived -> D1 status + AuditLog free_project.restored mismo Prisma transaction. El evento propuesto es audit-only y debe registrarse en EVENT_CATALOG antes del código. Sin SSE/outbox/pagos.

UI: loading/empty/ready/forbidden/error/unsynced. Cambiar idioma no pierde filtros ni navegación. Nunca eliminar/duplicar original TimeEntry, ni alterar Evidence. El asistente no puede restaurar por chat.

## 6. Estado, eventos y concurrencia

Estados existentes: active, archived, converted. S0: active/converted -> archived y active -> converted. S1: archived -> active/converted, sólo con ownership y regla D1. No crear cuarto estado. Retry idempotente decidido por D2. CAS de estado y escritura AuditLog transaccional: si falla auditoría, la restauración no se confirma. convertedJobId histórico no permite consultar Jobs caducados. No inventar dominio EventBus.

## 7. Datos y migración

Sin schema/migraciones previstos. Usar campos status y convertedJobId existentes; no backfill ni nuevos timestamps sin ADR. Rollback revierte sólo S1 y nunca el guard S0. Restauraciones legítimas ya realizadas no deben deshacerse. Listas masivas necesitan límites/paginación verificables; la paginación de TimeEntry corresponde F1A, no a S1.

## 8. Riesgos y privacidad

- Alto: BOLA por GET archived y restore; tests mismo tenant diferentes createdBy.
- Alto: archived convertido restaurado erróneamente a active; pérdida de semántica y posible fichaje indebido.
- Alto: historial >500 etiquetado como total; coordinar #1036.
- Alto: CAS sin audit; transacción indivisible.
- Medio: sync offline y client viejo; no afirmar restauración si backend no confirmó.
- Medio: ES/EN, web/móvil y cambios simultáneos; medir por plataforma realmente probada.

## 9. Dependencias

#937 guard de ownership, #933 requirement, #935 EPIC. #1036 export íntegro, #1039 CSV safe, #1037 identidad portable, #931 ubicación. No editar esos PR ajenos ni afirmar que están fusionados mientras sigan draft.

## 10. Decisiones pendientes (aprobación obligatoria)

| ID | Recomendación | Alternativa |
| --- | --- | --- |
| S1-D1 | Archivado con convertedJobId -> restaurar como converted; sin él -> active | Bloquear restore de convertido archivado |
| S1-D2 | Reintento restore 200 sin segunda escritura/auditoría | 409 |
| S1-D3 | En archived sólo detalle/Restaurar, sin editar/convertir/fichar | Permitir editar allí |
| S1-D4 | Resolvedor owner-only incluye archived; conservar TimeEntry intacto | Snapshot de nombre y migración (más alcance) |
| S1-D5 | Horas totales sólo si consulta completa; caso contrario advertir límite y coordinar F1A | Implementar agregado paralelo (solapa PR) |
| S1-D6 | API común, web primera entrega, móvil después con compatibilidad/tests | Web y móvil atómicos en mismo PR |

El owner debe aprobar S1-D1–D6 y la spec antes de pasar a APPROVED y comenzar tests rojos/código.

## 11. Gates

Spec/plan/tasks/checklist y aprobaciones SDD; tests negativos A1–A12 primero; integración PostgreSQL de CAS/audit; backend guard; UI ES/EN; regresiones S0; typecheck/lint/spec strict/index; CI al final; revisión independiente; merge autorizado; deploy/versiones compatibles; UAT sintética con 2 actores del mismo tenant, revocación y restore, evidencia de SHA. VERIFIED sólo con pruebas productivas autorizadas, no por CI.