---
id: "core.crew-supervisor-delegations"
title: "Designaciones temporales y autoridad verificable de supervisores de cuadrilla"
domain: "core"
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
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: ""
---

# SDD 2.0 — Autoridad verificable de supervisores de cuadrilla

> **BORRADOR DOCUMENTAL; NO AUTORIZA CÓDIGO, MERGE NI ACTIVACIÓN.**
> La distinción CLIENT/PRO/WORKER y la capacidad efectiva por org/proyecto se conservan.
> No es contrato de empleo, credencial ocupacional, nombramiento OSHA de persona competente
> ni autorización financiera.

## 1. Problema y resultado

**Para quién:** dueño/representante de una organización constructora, encargado de
obra, supervisor designado y personal que puede trabajar para varias empresas
sin perder su perfil independiente en SEMSE.

**Problema:** `Crew.supervisorUserId` identifica a alguien pero no registra
mandato temporal, alcance de sus atribuciones, revocación ni evidencia de
quién lo autorizó. Las verificaciones actuales de
`CrewsService.listMine/rosterForSupervisor` y
`TaskAllocationsService.requireCrewScope` aceptan al usuario designado
si tiene *cualquier* membresía ACTIVE en esa org, mientras
`CrewsService.createCrew` exige WORKER ACTIVE inicialmente. Esta
asimetría permite que la identidad de supervisor sobreviva a la pérdida
del rol WORKER mientras quede otro rol ACTIVE. Las capacidades de gerente
derivadas de un rol genérico también pueden ser demasiado amplias.

**Resultado esperado:** toda operación de supervisor se autoriza en backend
mediante una **delegación explícita, vigente y auditable** acotada a
tenant + org + crew (+ worksite/Job autorizado cuando aplique) + persona
+ acción. Revocar, suspender, vencer o perder la membresía requerida
impide nuevos accesos inmediatamente sin borrar historial ni otras
membresías. El perfil PRO independiente permanece intacto.

**Prerequisitos:** especificaciones
`core.universal-identity-multi-role`,
`core.org-membership-status`,
`core.org-invitations`, `core.business-offers`,
`core.crews-worksites` (BO-07) y `core.task-allocations` (BO-10).
No duplicar `JobTask`, `TaskAllocation`, `TimeEntry` ni Evidence.

## 2. Alcance

### Incluido en el incremento de designación (propuesto)

- Delegación temporal para la función `CREW_SUPERVISOR` sin crear rol RBAC
  global ni modificar CLIENT/PRO/WORKER.
- Autoridad granular: `crew:roster:read`, `crew:tasks:assign`,
  `crew:tasks:release`, `crew:work:review` (esta última solo al integrar
  la política de revisión correspondiente). Catálogo final pendiente de aprobación.
- Origen de la designación: actor, motivo, org, crew, vigencia, conjunto
  explícito de permisos y registro de revocación.
- Evaluación de permisos para cada operación que use la delegación,
  comprobando membresía WORKER ACTIVE en la org, pertenencia/alcance a
  cuadrilla y recurso vigente, estado/fechas y aislamiento tenant.
- Proyección de lectura `mi autoridad` que explique por qué una acción
  está permitida o bloqueada, sin incluir salarios ni datos sensibles.
- UI ES/EN para designar, consultar, suspender/revocar y visualizar
  deberes operativos; al cambiar de org/proyecto no persistir permisos
  de un contexto anterior.

### Fuera de alcance

- Convertir al usuario en empleado automáticamente, inferir W-2/1099,
  firmar contratos (Documenso sigue OFF), cambiar términos de ofertas.
- Crear un nuevo modelo de tareas, reloj, nómina, sistema de ubicaciones
  GPS, inventario o motor de inspecciones.
- Liberar pagos, aprobar milestones, gestionar escrow, aprobar nómina
  ni exponer compensación por la mera designación.
- Designación OSHA de `competent person` o certificaciones ocupacionales.
  El responsable legal debe verificar formación y autoridad exigibles.
- Jerarquía de supervisor general/de obra: futura extensión separada,
  nunca implica acceso automático a otras cuadrillas.
- Activación global sin aprobaciones, smoke autenticado y canary.

### Compatibilidad

En esta propuesta, el campo legacy `Crew.supervisorUserId` **no puede
conceder por sí solo** permisos nuevos de delegación tras activar la
función. El plan exige migración gradual y proyección temporal para
evitar pérdida repentina de permisos legítimos. Con flag OFF se preserva
comportamiento existente, pero las vulnerabilidades conocidas de guard
deben evaluarse en un parche independiente antes de cualquier activación
de BO-07/BO-10. **No se propone abrir acceso permisivo como fallback.**

## 3. Actores, permisos y límites

**Decisión aprobada por el propietario el 2026-10-22 (OPEN-SUP-01, regla funcional):**
solo el **propietario o representante autorizado y verificado de la empresa**
puede designar, sustituir o revocar a un supervisor. La sola condición
CLIENT, PRO, WORKER, Membership ACTIVE o tener `org:crews:manage` no acredita
titularidad ni faculta para nombramientos. El backend debe verificar en cada
mutación una constancia activa y revocable de propietario/representación,
vinculada a `tenantId+orgId+userId`, su origen y vigencia. Si esa constancia
no existe o no está verificada, el nombramiento se deniega.

**Pendiente técnico, no nueva aprobación del principio:** definir, revisar y
probar la fuente canónica de verificación y su flujo de emisión/revocación.
`Org` carece de `ownerUserId` directo; no se debe inventar un owner desde
la primera Membership, el rol PRO/CLIENT ni la cuenta creadora por
inferencia. Proteger el último propietario verificado y evitar que un
representante se autodesigne como propietario. OPS_ADMIN no obtiene
facultad automática de nombrar por el solo hecho de ser operador de SEMSE.


| Actor | Autorización candidata | Scope | Permitido | Prohibido |
|---|---|---|---|---|
| Propietario o representante verificado de Org | `org:supervisors:delegate` | org propia + crew | emitir/revocar delegación | crear autoridad en org ajena |
| OPS_ADMIN | política de intervención explícita auditada | org/tenant justificado | intervención autorizada | superusuario silencioso |
| WORKER con delegación ACTIVE | permisos `crew:*` específicos | solo crew/obra designada | roster/tareas dentro de alcance | otras crews, salarios, ofertas |
| WORKER sin delegación | permisos propios | asignaciones propias | avanzar sus tareas | reasignar a colegas |
| PRO independiente | sus permisos existentes | su org/contexto | mantener actividad propia | heredar permisos del trabajo ajeno |
| CLIENT dueño de Job | ownership específico de Job | su proyecto | avance/evidencia autorizada | ver nómina privada de cuadrillas |

- **Tenant:** tenantId necesario pero insuficiente; toda autorización requiere
  orgId y recurso válido. Cruces entre orgs/tenants devuelven 404 neutro.
- **Ownership:** `Org` actual carece de `ownerUserId`. No se puede
  derivar autoridad de contratación de `CLIENT` o `PRO` en abstracto.
  La autoridad de dueño/representante necesita política propia antes del primer grant.
- **Delegado:** debe mantener Membership ACTIVE con `WORKER` en la misma
  org. Sin membresía → 404; membresía presente sin permiso → 403.
- **Deberes:** la ficha de supervisor incluye planificación, seguridad,
  coordinación, calidad, materiales, evidencia, asistencia y cierre;
  son responsabilidades visibles y no un grant financiero.
- **Separación de funciones:** nadie aprueba su propio trabajo/evidencia
  cuando la revisión requiere independencia; el mismo individuo puede
  trabajar técnicamente y supervisar sin contabilizar dos turnos.
- **Privacidad:** compensación, ubicación precisa y documentación
  laboral quedan fuera del roster y del grant; no registrar secretos.
- **Auditoría:** cambios con actor, before/after, solicitud/correlation,
  motivo, org, crew, fecha y resultado. Todo evento de dominio nuevo
  debe incorporarse al `EVENT_CATALOG.md` *antes* de emitirlo.

## 4. Escenarios P1 y criterios de aceptación

### P1 — PRO independiente y supervisor en otra empresa
```gherkin
DADO un usuario PRO en org A y WORKER ACTIVE en org B
Y una delegación vigente a la cuadrilla C de org B
CUANDO abre C y asigna una JobTask propia de org B
ENTONCES la operación es permitida únicamente para C
Y su acceso PRO en org A permanece sin cambios
```

### P2 — Revocación inmediata incluso con sesión antigua
```gherkin
DADO un supervisor con sesión iniciada y delegación ACTIVE
CUANDO el responsable autorizado revoca esa delegación
ENTONCES no puede listar roster ni asignar tareas de esa crew
Y una petición posterior con token anterior es denegada por backend
Y el historial de tareas/horas permanece íntegro
```

### P3 — Membresía WORKER revocada, otra membresía aún ACTIVE
```gherkin
DADO una persona designada supervisor y con roles WORKER y PRO en la misma org
CUANDO la Membership WORKER es SUSPENDED o REVOKED
Y permanece PRO ACTIVE
ENTONCES no puede operar como supervisor hasta nueva autorización válida
Y conserva exclusivamente los accesos PRO que correspondan
```

### P4 — Separación de funciones y privacidad
```gherkin
DADO un supervisor que también ejecuta una tarea
CUANDO intenta revisar su propia entrega o consultar salario de otra persona
ENTONCES SEMSE deniega esas acciones
Y no altera Evidence, TimeEntry, ledger ni Payment Governance
```

### P5 — Carrera concurrente y límites temporales
```gherkin
DADO un grant ACTIVE para una crew
CUANDO llegan simultáneamente revocación y asignación
ENTONCES ninguna asignación posterior a la revocación confirmada es aceptada
Y la segunda revocación no produce efectos duplicados
```

Casos borde obligatorios: usuario sin WORKER; WORKER otra org; otra crew;
worksite archivado; Job inaccesible/eliminado; crew archivada; vigencia futura,
vencida o con límites iguales; revocación repetida; cambio de dueño de Job;
reintento de petición; doble designación concurrente; conexión degradada;
rol WORKER y PRO simultáneos; supervisor no miembro de la crew; GPS sin
consentimiento; cambio de idioma sin perder formulario.

## 5. Contratos propuestos, no implementados

### API — crear designación
```yaml
method: POST
path: /v1/organizations/:orgId/crews/:crewId/supervisor-delegations
auth: required
permission: org:supervisors:delegate
input:
  subjectUserId: string
  startsAt: ISO8601
  endsAt: ISO8601|null
  permissions: [approved-crew-permissions]
  reason: string
  idempotencyKey: string
output: { id, status, orgId, crewId, subjectUserId, startsAt, endsAt, permissions }
errors:
  400: "input/fechas inválidos"
  401: "no autenticado"
  403: "actor sin autorización"
  404: "org/crew no accesible"
  409: "conflicto o designación superpuesta"
  422: "WORKER/crew/Job no elegible"
effects:
  audit_log: "audit con before/after y motivo; nombre por aprobar"
  domain_event: "PENDIENTE registrar en EVENT_CATALOG antes de emitir"
  sse: "no requerido para primer slice"
  payment_governance: "sin efectos"
```

### API — consulta y revocación
```yaml
routes:
  - GET /v1/organizations/:orgId/crews/:crewId/supervisor-delegations
  - POST /v1/organizations/:orgId/crews/:crewId/supervisor-delegations/:id/revoke
  - GET /v1/crews/:crewId/me/authority
revoke_input: { reason: string, expectedVersion: integer }
revoke_output: { id, status: "REVOKED", revokedAt }
errors: { 401: unauthenticated, 403: forbidden, 404: not_found, 409: stale_version }
effects: "revalidar en backend cada lectura/escritura; auditar cambios"
```

### UI
```yaml
surfaces:
  - "/client/team: delegaciones por organización y cuadrilla"
  - "/worker/crew: autoridad vigente, cuadrilla, deberes y tareas"
  - "BuildOps: estado de supervisión contextual"
states: [loading, empty, ready, forbidden, degraded, expired, revoked, error]
required_behavior:
  - "ES/EN sin pérdida de datos al cambiar idioma"
  - "Nunca mostrar controles de contratación por ser supervisor"
  - "Siempre indicar organización, crew y vigencia"
  - "No marcar success hasta respuesta confirmada del servidor"
```

### Agente / Prometeo
```yaml
tools:
  - "supervisor.authority.read (propuesta; solo lectura)"
input_schema: "{ crewId: string }"
output_schema: "{ effectivePermissions: string[], scope: object, status: string }"
approval_policy: "no puede conceder/revocar permisos ni contratar personas"
forbidden_behavior:
  - "inferir autoridad desde chat o el título del cargo"
  - "autorizar pagos por checklist, evidencia o salida de IA"
```

## 6. FSM, auditoría y reconstrucción

- Entidad propuesta `CrewSupervisorDelegation`:
  `PENDING -> ACTIVE -> SUSPENDED -> ACTIVE`; `ACTIVE|SUSPENDED -> REVOKED`
  (terminal); `PENDING -> REVOKED`. `EXPIRED` es estado efectivo derivado
  de `endsAt` en lectura, nunca reapertura automática.
- Transiciones deben validar autoría, vigencia, version CAS y autorización.
- Antes de implementación actualizar `STATE_MACHINES.md` y
  `EVENT_CATALOG.md` para definir eventos reales (ninguno inventado aquí).
- Escribir estado + AuditLog + outbox de evento de dominio en la misma
  transacción según infraestructura autorizada. Consumidores idempotentes;
  permitir reconciliación sin restablecer permisos revocados.
- Si event backbone no soporta atomicidad de este agregado, **bloquear
  activación**, documentar alternativa explícita y cubrir con tests.

## 7. Datos y migración

- Modelo propuesto (pendiente de aprobación):
  `CrewSupervisorDelegation(id, tenantId, orgId, crewId, subjectUserId,
  grantedByUserId, startsAt, endsAt?, permissions[], status, version,
  grantedReason, revokedByUserId?, revokedAt?, revokedReason?,
  createdAt, updatedAt)`.
- Índices: acceso por `tenantId,orgId,crewId,status`, por
  `subjectUserId,status`, unicidad lógica de grant activo por crew/persona
  con protección de concurrencia transaccional.
- Esquema: aditivo (expand); nunca reemplazar Membership ni JobTask.
- Migración y checksum: PENDING; ninguna migración creada con esta spec.
- Backfill: **no atribuir grants retroactivos automáticamente** a todos
  los `Crew.supervisorUserId`; migrar solo designaciones validadas por
  autoridad real en canary.
- Compatibilidad: flag OFF mantiene UI/servicio existente; flag ON exige
  grant, sin fallback por campo legacy; abortar canary ante negaciones
  inesperadas o aumento de acceso.
- Pre-deploy: `prisma migrate deploy`, nunca `db push` en producción.
- Rollback: desactivar flag y volver al código anterior tras analizar
  riesgo de fallos de autorización; conservar datos/auditoría. Forward-fix
  migratorio, no borrado destructivo.

## 8. Observabilidad y activación

- Métricas: 403/404 de scope, intentos cross-crew, revocaciones efectivas,
  accesos indebidos (= cero), errores por grants vencidos, latencia auth.
- Logs: correlationId, actorId, tenantId, orgId, crewId, action y decisión,
  sin nombre/salario/coordenadas personales ni token de invitación.
- Feature flag **propuesto** `SEMSE_CREW_SUPERVISOR_DELEGATIONS_ENABLED`
  (no existe como feature activo); OFF por defecto.
- Canary: empresa y usuarios sintéticos con 2 orgs, 2 crews y persona
  simultáneamente PRO/WORKER; probar revocación inmediata.
- Gates: CI, staging, migración, smoke autenticado ES/EN/móvil, UAT y
  rollback practicado antes de activar; Railway HEALTH no equivale a UAT.
- Owner operativo: semse-core + security reviewer independiente.

## 9. Tests requeridos

- [ ] Unit: política de permiso por actor, org, crew, acción y vigencia.
- [ ] API: 401/403/404/409/422, incluyendo PRO+WORKER simultáneos.
- [ ] Integration: org/tenant cruzados, revocación con sesión antigua,
      membership WORKER suspendida aunque PRO continúe ACTIVE.
- [ ] Concurrencia: grant duplicado, revoke simultáneo con task assign.
- [ ] Integridad: mismo JobTask; no duplicar TimeEntry ni pago.
- [ ] Segregación: autoaprobación de trabajo, compensación y escrow denegados.
- [ ] Web: ES/EN, loading/empty/forbidden/revoked/error, pantalla móvil.
- [ ] Migración: expand + rollback ensayado y checksums.
- [ ] Smoke autenticado canary con trabajadores sintéticos.

## 10. Mapa de implementación, si se aprueba

- API: `apps/api/src/modules/organizations/crews.service.ts`,
  `task-allocations.service.ts` y servicio de política nuevo.
- Auth: `packages/auth/src/rbac.ts`, **sin** otorgar nuevos permisos
  globales a PRO/CLIENT por defecto.
- DB: `packages/db/prisma/schema.prisma` y migración aditiva.
- Web: `apps/web/app/(app)/client/team/page.tsx`,
  `apps/web/app/(app)/worker/crew`, BFF y contratos tipados.
- Time Tracker: consumir grants sin rehacer fichaje, tiempos o Evidence.
- Prometeo: lectura contextual bajo policy; no mutaciones autónomas.
- Tests: `apps/api/test`, `tests/unit` y smoke autenticado.

## 11. Investigación externa (fuentes primarias)

1. OWASP Authorization Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
   (least privilege, deny by default, autorización por petición/recurso).
2. NIST RBAC — https://csrc.nist.gov/Projects/Role-Based-Access-Control/faqs
   (rol autorizado y autorización de la transacción, separación de funciones).
3. OSHA Competent Person — https://www.osha.gov/competent-person
   (el cargo de supervisor no acredita por sí solo el nombramiento de persona competente).

- Aplicado al diseño: control por contexto y revalidación; no autoaprobación;
  responsabilidades de seguridad sin atribuir certificaciones.
- Backlog: supervisor de obra/general, revisión de horas y materiales
  mediante permisos específicos, formación especializada y checklists inteligentes.
- Descartado: cuarto rol RBAC universal `SUPERVISOR`, aprobación automática
  de pagos, traslado de propiedad de Job y doble cronómetro.

## 12. Decisiones abiertas y gates

- **OPEN-SUP-01 — decisión funcional RATIFICADA (2026-10-22):**
  únicamente propietario o representante autorizado y **verificado de la
  organización** puede nombrar o revocar supervisores. PRO/CLIENT/WORKER
  por sí solos no confieren esta autoridad; no se concede a OPS_ADMIN un
  bypass silencioso. **Subtarea técnica pendiente:** diseñar y validar
  la fuente canónica de titularidad/representación en Org, comprobación
  server-side por tenant/org/actor, vigencia, revocación y protección
  del último propietario. La ratificación NO aprueba todavía la spec global.
- **OPEN-SUP-02 — elegibilidad:** para designar supervisor, ¿exigir
  `BusinessEngagement ACTIVE` además de WORKER ACTIVE, o permitir una
  delegación con fuente de autorización alternativa validada? La invitación
  sola nunca equivale a contratación.
- **OPEN-SUP-03 — suplencia:** ¿permitir supervisor principal + suplente
  con alcance limitado, o solo uno en el primer slice?
- **OPEN-SUP-04 — nivel de acción:** confirmar cuáles capacidades de
  supervisor ejecutan directamente y cuáles solicitan aprobación (horas,
  materiales, reasignación fuera de crew).
- **OPEN-SUP-05 — seguridad:** definir responsables y límites para
  revisar/cerrar incidentes; detener una situación peligrosa no depende
  de una autorización informática previa.
- **OPEN-SUP-06 — activación:** secuencia de migración sin abrir accesos
  legacy y con separación de seguridad BO-07/BO-10.

Gates:
- [x] OPEN-SUP-01: principio de delegante propietario/representante verificado ratificado (2026-10-22).
- [ ] Fuente verificable de representación y demás decisiones OPEN-SUP-02…06 resueltas; aprobación global aún pendiente.
- [ ] Spec APPROVED; plan/tasks/checklist y análisis completos.
- [ ] `STATE_MACHINES.md` y `EVENT_CATALOG.md` aprobados/actualizados.
- [ ] Tests rojos y luego PASS, CI terminal verde.
- [ ] PR técnico revisado por seguridad; merge SHA registrado.
- [ ] Migración, deploy y canary autenticado verificados por separado.
- [ ] Solo con evidencia, `activation_status` y `status: VERIFIED`.
