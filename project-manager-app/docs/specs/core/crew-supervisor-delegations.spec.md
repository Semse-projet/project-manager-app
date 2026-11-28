---
id: "core.crew-supervisor-delegations"
title: "Designaciones temporales y autoridad verificable de supervisores de cuadrilla"
domain: "core"
sdd_version: "2.0"
version: "0.5"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: []
production_evidence: []
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-11-27"
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

En esta propuesta, el campo legacy `Crew.supervisorUserId` **no
concede autoridad por sí solo**, ni con el flag de delegación S1 OFF
ni con ON. La corrección de guardas S0 es una dependencia de seguridad
obligatoria, independiente del flag de S1: las rutas legacy BO-07/BO-10
deben revalidar WORKER ACTIVE, tenant, organización, cuadrilla y
revocación/suspensión en cada petición. Con OFF **no se restauran**
permisos legacy más amplios ni se revierten los guardas S0.
Las nuevas rutas/acciones S1 se deniegan con OFF; con ON requieren
además grant explícito, vigente y acotado por acción, org y crew.
La migración gradual debe conservar tareas, horas y evidencia, **no**
reconstruir autorizaciones antiguas implícitas.

Un grant S1 que figure `ACTIVE` en almacenamiento mientras el flag
está OFF **no concede ningún permiso efectivo**. Apagar S1 no borra
ni revoca por sí solo el registro histórico, pero cualquier reactivación
requiere verificar nuevamente elegibilidad, emisor, alcance, vigencia,
revocación y autorización explícita de reanudación; **no** se
reconocen grants anteriores automáticamente solo por volver a ON.
La política exacta de reemisión/invalidación se ratifica en
OPEN-SUP-06 antes de implementación. Nunca se hace rollback a un
binario que omita S0: se debe preferir forward-fix seguro.

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

### 3.1 Autoridad sobre horas — decisión OPEN-SUP-04 (horas), 2026-11-23

**Fuente:** decisión del responsable del producto comunicada en la sesión de trabajo del 2026-11-23. Resuelve la parte **«horas»** de OPEN-SUP-04. Las partes «materiales» y «reasignación fuera de crew» **siguen abiertas**. Es una decisión documentada: **no** implementa permisos, no habilita nada en producción, no ejecuta pagos y no cambia `code_status: NOT_STARTED`.

1. **Trabajador:** puede consultar sus registros y **proponer** correcciones a sus propias horas. Una propuesta **no cambia el registro oficial** hasta que la revise alguien con autoridad.
2. **Supervisor (con delegación vigente):** puede **corregir y enviar** registros dentro de los trabajos o del alcance que tiene asignados. Cada cambio deja constancia de quién lo hizo y cuándo. **No** da la aprobación final de horas.
3. **Dueño designado de la empresa:** es el único que da la **aprobación final de las horas** de su organización (K3, K4). Esa aprobación **no** deja las horas listas para pago, no crea un estado de pago y no ejecuta ni envía pagos; el paso a pago lo define Payments (K6, A-06). El dueño del trabajo (cliente del Job) no aprueba horas. Nadie aprueba horas propias ni un caso que capturó o propuso (K5, D4-04).
4. **Solo consulta:** permite ver registros dentro del alcance autorizado, sin proponer, editar ni aprobar.
5. **Alcance:** cada usuario se limita a los registros y trabajos que le corresponden; una delegación de supervisor **no concede autoridad fuera de su alcance asignado**.

**Respuestas del propietario a K1–K6 (2026-11-23, fecha UTC del entorno):** aclaran y limitan las reglas 1–3; no las amplían.

| ID | Estado | Dirección del propietario |
|---|---|---|
| K1 | **Decidido** | El supervisor **no** cambia el `TimeEntry` oficial al enviar una corrección. Se **mantienen** la decisión de Plan 3 del 17-11 y C3-04: el supervisor verifica y recomienda; el responsable decide. La corrección enviada queda **pendiente de decisión**. No se enmiendan esas reglas ni se cambia el comportamiento del registro oficial sin una aprobación explícita posterior. |
| K2 | **Decidido** | Ante una propuesta del trabajador, el supervisor puede **revisar y recomendar**; el **responsable decide**. El supervisor no tiene aprobación final por defecto. |
| K5 | **Decidido** | Nadie revisa ni decide su propia corrección. Si un supervisor corrige sus propias horas, sólo puede presentar una **propuesta como trabajador**; otra persona autorizada la revisa y el responsable la decide. |
| K3 | **Decidido** (26-11-2026, 14:29 America/New_York, 19:29 UTC) | Cada empresa designa a una persona dueña; `org:labor:manage` no basta; OPS_ADMIN solo interviene con auditoría. Fuente canónica: grant de autoridad por empresa (D-01, 27-11). Sigue bloqueado técnicamente por OPEN-SUP-01 hasta que exista esa fuente. |
| K4 | **Decidido** (26-11-2026, 14:46 America/New_York, 19:46 UTC) | Una sola firma, la del dueño designado de la empresa. El dueño del trabajo no aprueba. C3-17 **no** resuelve quién aprueba las horas. |
| K6 | **Decidido** (26-11-2026, 14:50 America/New_York, 19:50 UTC) | No hay estado «aprobado para pago»; la aprobación de horas no es aprobación de pago; Payments define ese paso (A-06). No se ejecutan ni envían pagos. |

**Quién es «el responsable»:** es el responsable del proyecto que designa el patrón o administrador (Plan 3, decisión del 17-11). Identificar al responsable real del piloto y verificar sus capacidades efectivas sigue pendiente («Aplicación pendiente» de esa decisión). Hoy, la decisión de correcciones BO-08 exige `org:labor:manage`, que es más amplio que «responsable» o «dueño» (K3).

| Actor | Consultar | Proponer corrección | Corregir y enviar | Aprobación final de horas | Límite |
|---|---|---|---|---|---|
| Trabajador | sus registros | sí, sólo sus horas; no cambia el registro oficial; el supervisor revisa y recomienda, el responsable decide (K2) | no | no | sus propios registros |
| Supervisor con delegación vigente | dentro del alcance asignado | sólo sobre **sus propias** horas, como trabajador; no la revisa ni la decide él (K5) | sí, dentro del alcance asignado y **nunca sobre sus propias horas**, con autor e instante; queda **pendiente de decisión** y **no cambia** `TimeEntry` (K1) | **no** | la delegación no amplía el alcance |
| Responsable designado (Plan 3, 17-11) | su proyecto | no fijado | no fijado | **decide** correcciones y propuestas, salvo las suyas (K5). Decidir **no** es aprobación para pago (K6) | identidad y capacidades efectivas pendientes de verificar (K3) |
| Dueño designado de la empresa | su organización | no fijado por la decisión | no fijado por la decisión | **sí**, salvo horas propias o casos en que capturó o propuso (K5); **bloqueado técnicamente hasta OPEN-SUP-01**; nunca ejecuta ni envía pago | su organización |
| Solo consulta | dentro del alcance autorizado | no | no | no | alcance autorizado |

**Estados que no se confunden** (propuesta, corrección enviada y aprobación final siguen separados; la decisión del responsable es una etapa distinta de las tres):

| Estado | Quién | Efecto |
|---|---|---|
| **Propuesta** | trabajador, sobre sus horas | no cambia el registro oficial |
| **Corrección enviada** | supervisor, dentro de su alcance y no sobre sus propias horas | queda registrada con autor e instante y **pendiente de decisión** del responsable; **no cambia** el `TimeEntry` oficial (K1) |
| **Decisión del responsable** | responsable designado, distinto de quien propuso o corrigió (K5) | concluye la corrección o la propuesta; **no** equivale a aprobación para pago ni la crea (K6). Su efecto sobre `TimeEntry` sigue el flujo canónico de horas (BO-08), sin cambios en esta decisión |
| **Aprobación final de horas** | solo el dueño designado de la empresa | no es aprobación de pago ni la crea (K6); **bloqueada técnicamente hasta OPEN-SUP-01**. Nunca ejecuta ni envía pagos |

**Aprobador único y conflicto de interés:** no hay autoaprobación ni intervención de OPS_ADMIN para resolverlo. Decisiones de producto del 26–27-11-2026 (spec `labor.weekly-reconciliation` §10.17.16): las horas del dueño que también trabaja quedan «sin aprobación de terceros» (D-03); en una empresa unipersonal, el titular firma una declaración, nunca una aprobación, y si el trabajo se cobra por horas el cliente puede confirmar las de ese trabajo (D-04); una corrección que propuso o capturó el dueño solo se aplica si el trabajador la acepta (D-09). Estas decisiones no crean capabilities ni estados por sí mismas.

**Permisos candidatos (nombres pendientes del catálogo; ninguno existe en el código):** `crew:time:read` (consulta de horas del alcance), `crew:time:correct` (enviar una corrección **pendiente de decisión** dentro del alcance; no escribe `TimeEntry`, K1). La propuesta del trabajador reutilizaría el flujo de solicitud propia de BO-08. **No** se define ninguna capability de aprobación para pago (K6). La capability de aprobación final de horas espera al catálogo y a OPEN-SUP-01. El nombre definitivo se aprueba con el catálogo de §2 («Catálogo final pendiente de aprobación»).

**Coherencia con esta spec:** coincide con «Fuera de alcance: aprobar nómina» (§2), con el actor «WORKER con delegación ACTIVE — solo crew/obra designada» (§3) y con «nadie aprueba su propio trabajo» (§3, P4). **Sustituye**, para horas, la propuesta no ratificada del reporte `2026-10-22_p02-p06-supervisor-decision-proposals.md` («Corregir/aprobar horas ajenas: solicitud, no aprobación implícita»).

**Conflictos registrados el 2026-11-23 (texto original; su estado actual está en «Respuestas del propietario a K1–K6»):**

| ID | Conflicto o vacío | Fuente en conflicto | Decisión concreta que falta | Owner |
|---|---|---|---|---|
| K1 | **Efecto de la «corrección enviada» del supervisor sobre el registro oficial.** La regla 2 le permite corregir; Plan 3 (decisión del 17-11-2026) dice «el supervisor verifica y recomienda; el responsable designado decide las correcciones», y C3-04 dice que el supervisor delegado «sólo revisa y recomienda» (alineado con Plan 4 D4). | Plan 3 §«Decisiones de producto aprobadas el 17 de noviembre», C3-04; SDD conciliación §«Modalidad del trabajo» | ¿La corrección enviada por el supervisor modifica `TimeEntry` al enviarla (y la aprobación del dueño sólo habilita el pago), o queda pendiente hasta que el responsable/dueño la apruebe? Si es lo primero, hay que enmendar expresamente la decisión del 17-11 y C3-04. | Dueño del producto (+ Plan 4) |
| K2 | **Quién es «alguien con autoridad» para revisar la propuesta del trabajador.** Depende de K1: el supervisor dentro de su alcance, sólo el responsable/dueño, o ambos. | regla 1; BO-08 (`org:labor:manage`) | Qué rol revisa y acepta las propuestas del trabajador. | Dueño del producto |
| K3 | **El modelo de permisos actual es más amplio que la regla 3.** En `rbac.ts` (blob `d344c29b…`), `org:labor:manage` —que hoy aprueba correcciones BO-08— lo tiene **cualquier** miembro CLIENT y OPS_ADMIN, no «el dueño». No existe fuente canónica de dueño (`Org` sin `ownerUserId`; OPEN-SUP-01, subtarea técnica pendiente). OPS_ADMIN no aparece en la regla. | `packages/auth/src/rbac.ts`; spec `core.labor-policy` (BO-08); OPEN-SUP-01 | Cómo se identifica al dueño de la empresa y al dueño del trabajo; si `org:labor:manage` debe restringirse a esa fuente; qué papel tiene OPS_ADMIN (ninguno, intervención auditada, u otro). | Plan 4 + dueño del producto |
| K4 | **Ámbitos de «dueño de la empresa» y «dueño del trabajo».** La regla 3 admite a ambos, pero no define qué horas corresponden a cada ámbito (horas de los trabajadores de la empresa frente a horas imputadas al Job), ni si hace falta una aprobación, cualquiera de las dos o las dos. Tampoco cómo se relaciona con la base de facturación por vencimiento de C3-17. | regla 3; SDD conciliación R-C317-09/17 | Definición de cada ámbito, regla de concurrencia de aprobaciones y relación con la base de facturación C3-17. | Dueño del producto |
| K5 | **Supervisor sobre sus propias horas.** La regla 1 limita a proponer las propias horas, pero la regla 2 permite corregir dentro del alcance, que puede incluir al propio supervisor. La spec (§3 «Separación de funciones», P4) y BO-08 prohíben revisarse a uno mismo. | reglas 1 y 2; spec §3/P4; BO-08 | Confirmar que, para sus propias horas, el supervisor actúa como trabajador (sólo propuesta). | Dueño del producto |
| K6 | **Aprobación para pago y Payment Governance.** Que las horas «avancen al proceso de pago» puede caer en el Art. IV; la determinación del owner de Payments (A-06) sigue pendiente. No existe un estado «aprobado para pago» en el modelo: `TimeEntry.status` menciona `approved` sólo en un comentario de esquema, sin uso en el código. | constitución Art. IV; A-06 | Determinación de Payment Governance y estado o modelo de la aprobación final. | Owner de Payments + Labor |

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
output: { id, status, version, orgId, crewId, subjectUserId, startsAt, endsAt, permissions }
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
list_output: "[{ id, status, version, subjectUserId, startsAt, endsAt, permissions }]"
revoke_output: { id, status: "REVOKED", version, revokedAt }
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
- Compatibilidad (propuesta S0/S1, pendiente OPEN-SUP-06): flag OFF
  deshabilita solo las rutas/delegaciones NUEVAS S1; las rutas y la UI
  legacy permanecen disponibles únicamente bajo los guardas S0
  endurecidos, con WORKER ACTIVE, tenant/org/crew y revocación
  revalidados por solicitud. `Crew.supervisorUserId` aislado nunca
  autoriza. Con ON se suman grants S1 explícitos, granulares y vigentes;
  sin fallback por el campo legacy. Un grant persistido como ACTIVE no
  concede autoridad con OFF ni se reanuda automáticamente al volver a ON.
  Abortar canary ante accesos indebidos, pérdida de audit o cambios
  inesperados en denegaciones; preservar historial de tareas y horas.
- Pre-deploy: `prisma migrate deploy`, nunca `db push` en producción.
- Rollback: poner S1 OFF manteniendo S0 y todas sus denegaciones.
  Solo retornar a un binario anterior que **también** implemente S0;
  si el binario anterior permitiría accesos legacy indebidos,
  **no desplegar ese rollback**: aislar nuevas mutaciones y aplicar un
  forward-fix seguro. Conservar grants, datos y auditoría sin borrar
  el esquema de forma destructiva. Reactivar S1 únicamente después de
  revalidación/reauthorización explícita y canary documentado.

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
- [ ] **OPEN-SUP-04 (horas):** trabajador propone sobre sus horas y el registro oficial no cambia; trabajador sobre horas ajenas → denegado.
- [ ] **OPEN-SUP-04 (horas):** supervisor corrige y envía dentro de su alcance → registro con autor e instante, estado **pendiente de decisión** y `TimeEntry` oficial **sin cambios** (K1); fuera del alcance (otra crew, Job u org) → denegado; con delegación vencida o revocada → denegado.
- [ ] **OPEN-SUP-04 (horas):** supervisor intenta decidir una corrección o una propuesta → denegado; sólo puede recomendar (K1, K2).
- [ ] **OPEN-SUP-04 (horas):** responsable decide una corrección o una propuesta ajena → registro de la decisión; **no** crea aprobación para pago (K6). Responsable sobre su propia corrección → denegado (K5).
- [ ] **OPEN-SUP-04 (horas):** supervisor sobre sus propias horas → sólo propuesta como trabajador; corregir y enviar, revisar o decidir la suya → denegado (K5).
- [ ] **OPEN-SUP-04 (horas):** solo consulta → lectura permitida en el alcance; proponer, editar o aprobar → denegado.
- [ ] **OPEN-SUP-04 (horas):** aprobación final de horas solo por el dueño designado de la empresa (K3, K4); cualquier otro actor → denegado; tras aprobar no se crea estado ni evento de pago (K6). Bloqueada hasta que exista la fuente de dueño (OPEN-SUP-01).

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
  **[2026-11-23] Parcialmente resuelto:** la parte **horas** está decidida por el responsable del producto (§3.1),
  con los conflictos K1–K6 pendientes de decisión concreta. **Materiales** y **reasignación fuera de crew**
  siguen abiertos. Nada de esto está implementado.
  **[2026-11-23, respuestas del propietario]** K1, K2 y K5 decididos (el supervisor recomienda; el responsable decide;
  nadie decide lo suyo; la corrección enviada no cambia `TimeEntry`). **K3, K4 y K6 siguen abiertos**
  (identidad y alcance del dueño, regla de aprobación, aprobación para pago y A-06). OPEN-SUP-04 sigue
  **parcialmente resuelto**.
- **EF-SUP-01 — incorporación formal de §3.1 (aprobada el 2026-11-27, ver «Aprobación de v0.3–v0.5»):** §3.1 se añadió en v0.3–v0.4,
  después de la aprobación del 2026-11-20. v0.5 la alinea con K3, K4 y K6. El propietario aprobó la
  incorporación de §3.1 y las versiones v0.3–v0.5 el 27-11-2026 (registro abajo), así que §3.1 es parte
  aprobada de este contrato. Esa aprobación no autoriza merge, código ni activación.
- **OPEN-SUP-05 — seguridad:** definir responsables y límites para
  revisar/cerrar incidentes; detener una situación peligrosa no depende
  de una autorización informática previa.
- **OPEN-SUP-06 — activación:** secuencia de migración sin abrir accesos
  legacy y con separación de seguridad BO-07/BO-10.

El contrato complementario S0b de integridad/atomicidad y aislamiento
por cuadrilla también continúa **propuesto**, sin decisión de negocio
ni implementación: `docs/reportes/2026-10-26_s0b-allocation-atomicity-cross-crew-contract.md`.
Incluye D-S0B-01…05 y escenarios N10…N18, pendientes de reconciliar
con BO-10. No atribuir permisos o cierres por crear este documento.

Las investigaciones y opciones de cierre están documentadas, pero no
ratificadas, en:

- `docs/reportes/2026-10-22_p01-canonical-org-owner-authority-design.md`
  para la fuente canónica de propietario/representante.
- `docs/reportes/2026-10-22_p02-p06-supervisor-decision-proposals.md`
  para elegibilidad, suplencia, autonomía, seguridad y migración.

Estos documentos no sustituyen la aprobación de OPEN-SUP-02…06 ni autorizan
modelos, migraciones, endpoints, flags, personas reales o producción.

Gates:
- [x] OPEN-SUP-01: principio de delegante propietario/representante verificado ratificado (2026-10-22).
- [ ] Fuente verificable de representación y demás decisiones OPEN-SUP-02…06 resueltas. **Gate de implementación:**
  la aprobación de la spec (abajo) no las decide.
- [x] Spec APPROVED por el propietario el 2026-11-20. Aprobó «con cambios», pero sin especificar ninguno, así que se
  registra tal como está. Plan, tasks y checklist existen; falta el análisis.
- [ ] `STATE_MACHINES.md` y `EVENT_CATALOG.md` aprobados/actualizados.
- [ ] Tests rojos y luego PASS, CI terminal verde.
- [ ] PR técnico revisado por seguridad; merge SHA registrado.
- [ ] Migración, deploy y canary autenticado verificados por separado.
- [ ] Solo con evidencia, `activation_status` y `status: VERIFIED`.

## Aprobación (propietario, 2026-11-20)

La spec pasa a **APPROVED** como contrato de dirección. Siguen **abiertas** OPEN-SUP-02…06 (elegibilidad, suplencia,
nivel de acción, seguridad y activación) y la fuente verificable de propietario o representante (OPEN-SUP-01,
subtarea técnica). Son gates de implementación: no se escribe código de designaciones hasta resolverlas
(`code_status: NOT_STARTED`). Nada de esto autoriza modelos, migraciones, endpoints, flags ni producción. Las
decisiones S0b D-S0B-01…05 quedaron ratificadas en `core.task-allocations` (BO-10).

## Aprobación de v0.3–v0.5 (propietario, 2026-11-27)

El propietario aprueba el contenido añadido en v0.3–v0.5: §3.1 (autoridad sobre horas, OPEN-SUP-04 parte «horas»), las respuestas K1–K6 y la enmienda v0.5 que limita la aprobación final de horas al dueño designado de la empresa y la separa de la aprobación de pago. Aprobación dada por mensaje del propietario en la sesión de trabajo, 27-11-2026, 12:47 America/New_York (17:47 UTC).

Alcance: aprueba el texto como contrato de dirección. **No** autoriza fusionar, ni código, modelos, migraciones, capabilities, endpoints, flags ni producción. Siguen abiertas OPEN-SUP-01 (fuente canónica del dueño) y OPEN-SUP-02…06; `code_status` sigue `NOT_STARTED`.
