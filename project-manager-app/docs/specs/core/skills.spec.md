---
id: "core.skills"
title: "Experiencia confirmada y atestaciones portables (BO-12)"
domain: "core"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "MERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "SEMSE_SKILLS_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/professional-skills/skills.service.ts"
  - "apps/api/src/infrastructure/audit/audit.service.ts"
  - "apps/api/src/modules/professional-skills/skills.controller.ts"
  - "apps/api/src/modules/professional-skills/skills.calc.ts"
  - "packages/db/prisma/schema.prisma"
  - "packages/db/prisma/migrations/20261019180000_skill_experience/migration.sql"
related_tests:
  - "apps/api/test/skills.test.ts"
related_endpoints: []
related_events:
  - "skill_experience.confirmed"
  - "skill_experience.rejected"
  - "skill_attestation.created"
  - "skill_attestation.revoked"
  - "skill_attestation.redeemed"
related_agents: []
last_verified: "2026-10-18"
---
# BO-12 — Experiencia confirmada y atestaciones portables

Fuente: plan Astra `03_producto/09_PERFIL_SKILLS_INSIGNIAS.md`. Depende de BO-10 (asignaciones). Cambiar de patrón no borra la experiencia legítima de la persona.

## Decisiones del propietario (2026-10-18)
| ID | Decisión | Efecto |
|---|---|---|
| OPEN-12 | Una tarea suma al terminarse **con revisión** de un responsable. | Solo una asignación `SUBMITTED` revisada y **confirmada** cuenta; sin revisión no cuenta. |
| OPEN-13 | Se comparte un **resumen verificable**, sin fotos ni clientes, con consentimiento. | La atestación es un resumen redactado por oficio, que la persona emite, puede revocar y que vence. |

## Lo que este slice NO hace (a propósito)
El plan prohíbe **fijar umbrales numéricos de insignia sin investigación de oficio y aprobación de producto**, y advierte contra equiparar un conteo con competencia. Por eso **no hay niveles, insignias ni "badges"**: solo hechos (cuántas tareas confirmó un responsable, por oficio, y en qué meses). Las insignias, las licencias y las certificaciones quedan para un slice posterior tras esa decisión de producto.

## Alcance
- Modelos aditivos `SkillExperience` (una decisión por asignación, índice único) y `SkillAttestation` (resumen JSON, hash de contenido, solo el hash del token).
- API tras `SEMSE_SKILLS_ENABLED` (apagado → 404):
  - `POST /v1/task-allocations/:id/skill-review` — el supervisor de la cuadrilla (o gestor de cuadrillas de la Org), distinto de la persona, confirma (con el oficio) o rechaza una asignación enviada.
  - `GET /v1/me/skills` — mis hechos por oficio.
  - `POST/GET /v1/me/skills/attestations`, `POST .../:id/revoke` — emitir (exige `consent:true`), listar y revocar.
  - `POST /v1/organizations/:orgId/skill-attestations/redeem` — un gestor de otra Org canjea el token que la persona le dio.

## Reglas
1. Solo cuenta lo que un responsable **confirma**; rechazar no acredita nada. Una decisión por asignación (409 si se repite).
2. Nadie revisa su propio trabajo. La membresía del revisor se revalida en cada llamada. La cuadrilla debe estar `ACTIVE`; una cuadrilla archivada rechaza la confirmación aunque el revisor tenga membresía activa.
3. El resumen portable lleva oficio, cantidad, mes de inicio y de fin, y el nivel de evidencia `supervisor_reviewed`. **No** lleva empresa, cuadrilla, tarea, usuario, fotos ni coordenadas, y siempre incluye el aviso de que no es licencia ni certificación.
4. La persona elige qué oficios comparte; el token se muestra una sola vez y solo se guarda su hash; vence (30 días por defecto, máximo 90) y se puede revocar.
5. Canjear exige ser gestor vigente (`org:offers:manage`: CLIENT y OPS_ADMIN) y se audita; un token inválido, vencido o revocado da 404 neutro.
6. Invariante BO-12: confirmar/rechazar experiencia, emitir una atestación o revocarla y escribir su `AuditLog` forman una misma transacción de PostgreSQL. Si falla la auditoría, la mutación se revierte y no se emite el token. Se verifican las cuatro rutas con inyección de falla; no se permite registrar una revisión o atestación sin evidencia de auditoría.

## Criterios de aceptación
AC-01 flag apagado → 404 · AC-02 solo supervisor/gestor, no el propio trabajo, otro tenant 404 · AC-03 solo lo enviado y revisado; confirmar exige oficio · AC-04 una decisión por asignación; rechazar no acredita · AC-05 sin experiencia no hay atestación · AC-06 resumen redactado y solo el hash del token · AC-07 solo los oficios elegidos · AC-08 canje por gestor de otra empresa, PRO 403, token falso 404, auditado · AC-09 revocar o vencer invalida · AC-10 cuadrilla archivada impide revisión · AC-11 fallo simulado al escribir `AuditLog` revierte confirmación, rechazo, emisión y revocación.

## Fuera de alcance
Insignias y niveles (pendiente de decisión de producto), licencias y certificaciones (autoridad externa), skills finos versionados, disputa de una revisión, pantallas web, y que Prometeo recomiende capacitación (BO-13).

## Riesgos
Que un conteo se lea como competencia: por eso no hay niveles y el aviso viaja con el resumen. Que se comparta de más: el resumen está redactado por construcción y se prueba que no incluye identificadores.

## Evidencia y estado de baseline (2026-10-19)
El modelo/migración y el código base BO-12 ya están incorporados en `main` (verificado en el commit `655e7fc0`); **esto no demuestra que la migración esté aplicada en Railway**. La corrección de auditoría atómica permanece en el PR BO-12 dedicado, sin fusionar. El contrato sigue **DRAFT**, flag `SEMSE_SKILLS_ENABLED` apagado por defecto y migración **PENDING** para activación; requiere aprobación de producto/seguridad y pruebas de aceptación antes del despliegue.
