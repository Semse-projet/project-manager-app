---
id: "platform.semse-mcp-delegated-consent"
title: "S1/D7 — Consentimiento OAuth delegado persistente y revocable para SEMSE MCP"
domain: "platform"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - packages/auth/src/rbac.ts
  - apps/api/src/modules/auth/auth.repository.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/common/auth.guard.ts
  - apps/api/src/common/rbac.guard.ts
  - docs/architecture/ADR-045-semse-mcp-inbound-authorization.md
  - docs/specs/platform/semse-mcp-project-read.spec.md
  - docs/specs/platform/semse-mcp-project-read.decisions.md
  - docs/specs/platform/semse-mcp-project-read.oauth-bridge.md
  - docs/specs/platform/semse-mcp-project-read.d2-evaluation.md
  - docs/reportes/2026-10-17_mcp-hydra-postgres-linked-poc.md
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "NOT_VERIFIED"
---

# Spec: S1/D7 — Consentimiento OAuth delegado persistente y revocable

> Spec hijo de [`platform.semse-mcp-project-read`](semse-mcp-project-read.spec.md)
> (S1, `REVIEW`). Contrato SDD 2.0 en **DRAFT**: no autoriza schema Prisma,
> migración, endpoint, flag, despliegue ni activación MCP. D7 está aprobado
> por el propietario **a nivel de solución** (2026-10-15, ver
> [`decisions`](semse-mcp-project-read.decisions.md)); **D2 (Authorization
> Server/issuer) sigue PENDING** y bloquea las fases C y D. Código, CI, merge,
> deploy y activación se registran por separado.
>
> Insumo de diseño: plan D7 del PR #978
> (`semse-mcp-project-read.d7-persistence-plan.md`, aún no fusionado) y la
> revisión técnica publicada en ese PR el 2026-10-26. Este spec incorpora el
> contrato de ese plan y fija las decisiones abiertas que la revisión detectó
> como **preguntas explícitas** (§13); no las da por resueltas.

## 1. Problema y resultado

**Para quién:** usuario SEMSE con Membership `ACTIVE` que autoriza a un cliente
MCP externo (host de IA) a leer el estado de sus proyectos; administrador de la
organización que necesita revocar ese acceso.

**Problema:** el laboratorio de PR #972 demostró introspección Hydra real ligada
a `AuthSession`/`Membership`/`Project` en PostgreSQL, pero el vínculo
`sub → org/cliente/sesión/consentimiento` es **sintético en memoria**. Sin un
registro durable no hay forma de: (a) saber qué cliente tiene acceso a qué
organización y con qué scopes, (b) revocar ese acceso sin esperar a que caduque
el token, ni (c) auditar quién concedió y quién revocó.

**Resultado esperado:** un grant persistido por `(tenant, org, user, sesión,
cliente, recurso, scopes)` con FSM `PENDING → ACTIVE → REVOKED | EXPIRED`, que
la cadena de autorización MCP consulta **en cada llamada** y cuya revocación
bloquea la **siguiente** `tools/call`, sin escribir nada en la vía de lectura.

## 2. Alcance

### Incluido

- Modelo de datos candidato del grant, índices, unicidad e invariantes (§7).
- FSM del grant y reglas de transición (§6).
- Contrato interno de aceptación, verificación por llamada y revocación (§5).
- Regla de intersección de permisos grant ∩ sesión ∩ Membership (§3).
- Matriz de pruebas test-first D7-01…D7-17 contra PostgreSQL efímero (§9).
- Fases A–D y sus gates (§8, §12).

### Fuera de alcance

- Elección del Authorization Server, client registration, metadata OAuth y
  vínculo token↔grant concreto (**D2**).
- Servidor MCP, transporte, `tools/list`/`tools/call` y guard de recurso
  (`@McpResourceAuth()` o equivalente): pertenecen a S1/D2.
- UI de consentimiento y de revocación para el usuario o administrador.
- Cualquier cambio a `AuthSession`, `Membership`, `AuthGuard`, `RbacGuard` o al
  JWT web.
- Railway, variables productivas, secretos reales o activación.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Usuario con Membership `ACTIVE` | rol con `projects:read` (`CLIENT`, `PRO`, `OPS_ADMIN` en `packages/auth/src/rbac.ts`) | su `tenantId` + **una** `orgId` = la de su `AuthSession` | conceder grant `projects:read` a un cliente registrado; revocar sus grants | conceder scopes que sus roles no tienen; conceder sobre otra org; reactivar un grant `REVOKED`/`EXPIRED` |
| Administrador de la org | **por decidir (D7b, Q5)** | su org | revocar grants de la org | conceder en nombre de otro usuario |
| Cliente MCP (host) | ninguno propio | solo el grant `ACTIVE` vinculado a su token | leer `projectId,status` vía S1 | elegir org/tenant/usuario por argumento; elevar scopes |
| `WORKER` | sin `projects:read` | — | — | obtener lectura de proyecto vía grant |

- **Tenant boundary:** `tenantId` del grant debe coincidir con el de la
  `AuthSession` y con `Org.tenantId`; nunca se deriva de input de la tool.
- **Ownership/resource policy:** tras autorizar el grant, la lectura sigue
  pasando por la política de `ProjectsService`/`ProjectsRepository` (tenant,
  org, Project/Job no borrado) del camino D4 sin aprovisionamiento.
- **Intersección de permisos (decisión propuesta, Q2):** la vía web calcula
  `activeRoles ∩ session.roles ∩ claims.roles` en `authorizedRoles`
  (`auth.service.ts`). En MCP no existe JWT SEMSE; se propone
  `permisos(activeRoles ∩ session.roles) ∩ grant.scopeSet`, traduciendo roles a
  permisos con `packages/auth/src/rbac.ts`. Debe **reutilizar** esa lógica
  (extraerla a una función compartida), nunca un segundo motor RBAC.
- **Step-up o aprobación humana:** la aceptación requiere consentimiento
  explícito del usuario en un flujo confiable (D2). La revocación no requiere
  step-up.
- **Datos `privacyCritical`:** no. El grant no contiene contenido de negocio;
  sí identificadores de usuario/org, por lo que el acceso al almacén es
  restringido y los logs solo llevan IDs opacos.
- **Auditoría:** aceptación, revocación y denegación se registran con IDs
  opacos, código de motivo y `correlationId`; nunca bearer, refresh, emails ni
  PII (D7-15). Evento de auditoría exacto: **pendiente** — no existe en
  `docs/foundation/EVENT_CATALOG.md` y no se inventa aquí (§6).

## 4. Escenarios y criterios de aceptación

### P1 — Conceder y usar un grant

```gherkin
DADO un usuario con AuthSession ACTIVE en Org A y Membership ACTIVE con rol PRO
Y un cliente MCP registrado con resourceUri canónica de SEMSE MCP
CUANDO el usuario concede projects:read en el flujo de consentimiento confiable
ENTONCES se persiste exactamente un grant ACTIVE con tenant/org/user/sesión/cliente/recurso exactos
Y la siguiente tools/call con el token vinculado a ese grant devuelve {projectId,status} de un Project de Org A
Y no se crea ni modifica ninguna fila de Tenant/Org/User/Membership/Project/Job/Grant en la lectura
```

### P2 — Revocar y bloquear la siguiente llamada

```gherkin
DADO un grant ACTIVE y un access token todavía activo en el AS
CUANDO el usuario revoca el grant
ENTONCES el grant pasa a REVOKED con revokedAt durable
Y la siguiente tools/call se deniega aunque el token siga válido criptográficamente
Y una segunda revocación es idempotente y no reabre el grant
```

### P3 — Revocación por la fuente de autoridad

```gherkin
DADO un grant ACTIVE
CUANDO se revoca la AuthSession, el User deja de estar active o se revoca la Membership que otorgaba projects:read
ENTONCES la siguiente tools/call se deniega aunque el grant siga ACTIVE en su tabla
```

Casos borde:

- [ ] Duplicado/reintento/concurrencia: aceptación idempotente; carrera
  revoke/authorize (D7-02, D7-03, D7-16).
- [ ] Fuente caída: introspección o PostgreSQL no disponible → fail-closed 503,
  sin fallback a claims (D7-10).
- [ ] Aislamiento cross-tenant/cross-org (D7-05, D7-06).
- [ ] Varias filas Membership por rol en la misma org (D7-17).

## 5. Contratos

Todos los contratos son **internos** (servicio de dominio en `apps/api`), sin
controller ni ruta expuesta hasta que D2 esté aceptado.

### Servicio interno — aceptar grant

```yaml
auth: sesión SEMSE verificada por flujo confiable (D2); nunca input de tool
permissions: ["projects:read"]  # el usuario debe tenerlo vía activeRoles ∩ session.roles
input_schema:
  sessionId: string            # de AuthSession verificada, no del cliente
  oauthIssuer: string          # issuer permitido (D2)
  oauthClientId: string        # cliente registrado exacto
  resourceUri: string          # URI canónica del recurso MCP, configurada en servidor
  scopeSet: ["projects:read"]  # v1: único scope admitido
  grantBindingDigest: string   # huella del grant del AS (mecanismo D2)
  idempotencyKey: string?      # opcional
  policyVersion: string
  consentVersion: string
output_schema:
  grantId: string
  status: "ACTIVE"
  expiresAt: datetime
errors:
  401: sesión inexistente, revocada o expirada
  403: usuario sin projects:read, scope no permitido, cliente/issuer/recurso no permitido
  409: idempotencyKey reutilizada con payload distinto
  503: autoridad de autenticación o DB no disponible
effects:
  audit_log: aceptación con IDs opacos (evento por definir, §6)
  domain_event: ninguno en v1
  sse: no
  payment_governance: no
```

### Servicio interno — verificar en cada llamada (solo lectura)

```yaml
input: token OAuth ya verificado/introspectado por la capa D2
steps:
  - iss, aud/resource, exp, client y scope exactos
  - resolver grant por grantBindingDigest (autoritativo, D2)
  - grant.status == ACTIVE AND grant.expiresAt > now()
  - AuthSession ACTIVE, revokedAt null y expiración elegida en Q1
  - User active; activeRoles de Membership ACTIVE en grant.orgId y tenantId
  - permisos(activeRoles ∩ session.roles) ∩ grant.scopeSet contiene projects:read
  - entregar authContext server-trusted al camino D4 de Projects
writes: ninguno (ni lastUsedAt, ni cambio a EXPIRED)
deny: 401/403 no enumerativo; 503 si DB/introspección falla o supera el deadline
```

### Servicio interno — revocar

```yaml
auth: el propio usuario del grant; administrador según Q5
transition: compare-and-set ACTIVE → REVOKED (también PENDING → REVOKED)
idempotent: true   # REVOKED → REVOKED devuelve el mismo estado sin cambios
effects:
  audit_log: revocación con revokedByUserId y revocationReasonCode
  as_propagation: revocación del grant/token en el AS con retry; fail-closed en SEMSE (D2)
```

### UI

```yaml
surfaces: []   # fuera de alcance en este spec
states: []
required_behavior: []
```

### Agente/Prometeo

```yaml
tools: []   # la tool semse.project.get_status.v1 pertenece a S1
input_schema:
output_schema:
source_citations_required: true
approval_policy: grant ACTIVE + sesión/Membership vigentes en cada llamada
forbidden_behavior:
  - derivar tenant/org/usuario/scopes de argumentos de la tool
  - cachear una autorización positiva más allá de la llamada
  - escribir en la base durante la verificación
```

## 6. FSM, eventos y reconstrucción

- **FSM `McpDelegatedConsent` (propuesta, no registrada aún en
  `docs/foundation/STATE_MACHINES.md`):**

  ```text
  PENDING → ACTIVE → REVOKED
  PENDING → REVOKED
  PENDING → EXPIRED
  ACTIVE  → EXPIRED
  REVOKED, EXPIRED = terminales; reautorizar = nuevo id y versión
  ```

  Registrar la FSM en `STATE_MACHINES.md` es tarea de la fase A.
- **Invariantes** (`docs/foundation/DOMAIN_INVARIANTS.md` + propias):
  - un grant pertenece a una sola org y a la org de su `AuthSession`;
  - un grant nunca otorga permisos que el usuario no tiene en el momento de la
    llamada;
  - la vía de verificación no escribe;
  - `expiresAt <= now()` se deniega aunque el estado siga `ACTIVE`; el paso a
    `EXPIRED` lo hace un mantenimiento asíncrono, nunca la lectura.
- **Eventos declarados:** ninguno existe para este dominio en
  `EVENT_CATALOG.md`. Si la fase A decide emitir eventos de dominio
  (`mcp_consent.granted.v1`/`revoked.v1` u otros), deben añadirse primero al
  catálogo con productor y outbox; este spec **no** los da por existentes.
- **Productor + outbox atómico / consumidores / replay / DLQ:** no aplica en
  v1 (solo auditoría).

## 7. Datos y migración

- **Modelo Prisma (candidato, no agregado):** `McpDelegatedConsent` con los
  campos del plan D7: `id`, `tenantId`, `orgId`, `userId`, `sessionId`,
  `oauthIssuer`, `oauthClientId`, `resourceUri`, `scopeSet`,
  `grantBindingDigest`, `status`, `createdAt`, `authorizedAt`, `expiresAt`,
  `revokedAt`, `updatedAt`, `policyVersion`, `consentVersion`,
  `idempotencyKeyDigest?`, `revokedByUserId?`, `revocationReasonCode?`.
- **Índices:** `(tenantId, orgId, userId, status, expiresAt)`,
  `(tenantId, sessionId, status)`, `(tenantId, oauthClientId, status)`;
  únicos `(tenantId, grantBindingDigest)` y `(tenantId, idempotencyKeyDigest)`
  cuando no sea nulo.
- **Relaciones (decisión propuesta, Q3):** **sin FK a `AuthSession`**.
  `AuthSession` no declara relaciones Prisma hoy (comentario en
  `auth.repository.ts`) y añadirle una relación toca un modelo central de Auth.
  La coherencia grant↔sesión↔org↔tenant se verifica en lectura, como ya hace
  `findActiveSessionAuthorization`. FKs a `Tenant`/`Org`/`User`: a decidir en
  fase A junto con `ON DELETE` y retención (no borrar evidencia auditable en
  cascada).
- **Migración:** aditiva (nueva tabla), sin tocar tablas existentes.
  `migration_status` pasa a `PENDING` solo cuando este spec esté `APPROVED` y
  el propietario autorice la migración.
- **Estrategia expand/contract:** solo expand en v1.
- **Backfill:** ninguno (no hay grants previos; los del laboratorio son
  sintéticos y no se migran).
- **Compatibilidad hacia atrás:** sin cambios para la API web ni el JWT.
- **Verificación de drift:** `prisma migrate diff` en CI contra la migración
  versionada.
- **Rollback de código:** flag OFF (Q4) deja la tabla sin uso.
- **Rollback/forward-fix de datos:** la tabla puede permanecer vacía; prohibido
  downgrade destructivo sin backup y plan aprobado.

> Nunca usar `prisma db push` para producción. Una migración aplicada no se
> edita: se restaura el archivo exacto o se reconcilia con el flujo oficial.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** latencia p95/p99 de la verificación completa (introspección
  + grant + sesión/Membership) frente al deadline de 1000 ms del auth actual;
  conteo de denegaciones por código de motivo.
- **Logs/traces/correlation:** `correlationId` en aceptación, revocación y
  denegación; sin tokens ni PII.
- **Health/readiness:** no aplica en fase B (sin rutas).
- **Feature flags/allowlists:** el plan D7 cita `MCP_SERVER_ENABLED=false`,
  pero **ese flag no existe** en `apps/` ni `packages/`. Nombre, default OFF y
  punto de evaluación se fijan en Q4 antes de la fase B; hasta entonces
  `feature_flags: []`.
- **Plan de canary:** fase D, con fixtures autenticadas de 2 tenants y 2 orgs
  del mismo tenant y evidencia de denegación cross-org.
- **Evidencia de producción requerida:** fase D.
- **Señal de rollback:** cualquier autorización indebida, latencia fuera del
  deadline o error de verificación no fail-closed.
- **Owner operativo:** `semse-core` (por confirmar en fase A).

## 9. Tests requeridos

Integración contra **PostgreSQL efímero real**, con dos tenants y dos orgs en
el mismo tenant, además de unitarios. Los casos con host MCP real solo tras D2.

| Caso | Escenario | Resultado exigible |
|---|---|---|
| D7-01 | Aceptación válida con sesión, scope y cliente del recurso | Un solo grant `ACTIVE` con actor/org/recurso exactos |
| D7-02 | Dos aceptaciones paralelas con misma idempotencyKey y payload | Un único grant, sin emisión doble |
| D7-03 | Misma idempotencyKey con otro scope/org/cliente | 409 sin modificar el grant |
| D7-04 | Token de usuario/cliente/scope idénticos vinculado a **otra sesión** | Rechazo antes de consultar Project |
| D7-05 | Grant de Org A pidiendo Project de Org B, mismo tenant | Rechazo no enumerativo |
| D7-06 | Org o Project de otro tenant | Rechazo y cero fuga |
| D7-07 | Revocar grant con bearer aún `active` en el AS | Siguiente llamada rechazada |
| D7-08 | Revocar AuthSession o Membership con grant aún `ACTIVE` | Siguiente llamada rechazada |
| D7-09 | `expiresAt <= now` o `policyVersion` incompatible | Rechazo sin escribir en la lectura |
| D7-10 | Introspección o PostgreSQL caídos / timeout | 503 fail-closed, sin fallback a claims |
| D7-11 | Sin grant, cliente/scope/audience distinto, replay de grant revocado | Rechazo sin lookups indebidos |
| D7-12 | `tools/list` y revocación antes de `tools/call` | `tools/call` rechazada |
| D7-13 | Lectura instrumentada | Conteos Tenant/Org/User/Membership/Project/Job/Grant idénticos; no-SELECT bloqueadas |
| D7-14 | Flag OFF con token y grant válidos | Sin ruta MCP accesible |
| D7-15 | Auditoría de aceptación/revocación/denegación | Solo IDs opacos, códigos y correlationId |
| D7-16 | Carrera revoke/authorize con barrera determinista | Ninguna verificación posterior a la revocación autoriza |
| **D7-17** | Usuario con filas Membership `PRO` y `WORKER` en la misma org; se revoca la fila `PRO` | Siguiente llamada rechazada: `WORKER` no tiene `projects:read` |
| **D7-18** | Expiración de sesión según Q1 (access vencido / refresh vigente) | Comportamiento exactamente igual al elegido en Q1 |

Checklist de plantilla:

- [ ] Unitarios del dominio (FSM, intersección de permisos, idempotencia)
- [ ] Contrato del servicio interno
- [ ] Permiso denegado y aislamiento tenant/org
- [ ] Validación y conflicto de estado
- [ ] Idempotencia/reintento/concurrencia
- [ ] Migración y compatibilidad
- [ ] UI: no aplica
- [ ] Canary o smoke autenticado: fase D

## 10. Mapa de implementación (fase B, tras APPROVED)

### API

- `apps/api/src/modules/mcp-consent/` (nombre provisional): repository y
  servicio internos, **sin controller**.
- Extraer la intersección de roles de `auth.service.ts` (`authorizedRoles`) a
  una función compartida reutilizable por la vía MCP.

### Web

- Ninguno.

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma`: modelo `McpDelegatedConsent` +
  migración aditiva.
- `packages/schemas/src/`: tipos Zod del grant.
- `apps/worker/`: job de mantenimiento `ACTIVE → EXPIRED` (opcional en v1; la
  lectura ya deniega por `expiresAt`).

### Tests

- `apps/api/test/mcp-delegated-consent*.test.ts` (unit + integración
  PostgreSQL), reutilizando el patrón del laboratorio
  `scripts/mcp-s1-hydra-semse-postgres-proof.mjs`.

## 11. Investigación externa

- MCP authorization 2026-07-28:
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- RFC 8707 (resource indicators) y RFC 9207 (issuer identification):
  https://www.rfc-editor.org/rfc/rfc8707 , https://www.rfc-editor.org/rfc/rfc9207
- Evaluación de AS: [`semse-mcp-project-read.d2-evaluation.md`](semse-mcp-project-read.d2-evaluation.md).
- **Aplicado ahora:** audience por recurso, revocación independiente de la
  expiración del token, sin token passthrough.
- **Backlog:** token exchange / binding criptográfico token↔grant (D2).
- **Descartado:** reutilizar `AdminIntegrationsService.CONFIGURED_UNVERIFIED`
  como consentimiento (ver decisions D7).

## 12. Gates de cierre

- [ ] Preguntas Q1–Q6 de §13 respondidas por el propietario y registradas
- [ ] Revisión de seguridad por persona **independiente del autor** con estado
  `APPROVED` sobre este spec (regla S1)
- [ ] FSM registrada en `STATE_MACHINES.md`; eventos en `EVENT_CATALOG.md` si
  se adoptan
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests D7-01…D7-18 derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED` (fase D, aprobación separada)
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`

## 13. Preguntas abiertas para el propietario (bloquean `REVIEW`)

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| **Q1** | ¿Qué expiración de `AuthSession` gobierna el grant? Hoy `ACCESS_TOKEN_TTL_SECONDS = 1h` y `REFRESH_TOKEN_TTL_SECONDS = 30d` (`auth.service.ts`). | (a) `accessExpiresAt`: el grant deja de servir ~1 h después del último refresh web. (b) `refreshExpiresAt`: MCP opera hasta 30 días sobre una sesión web inactiva. (c) `refreshExpiresAt` + tope propio de `grant.expiresAt` (p. ej. horas/días definidos por política). | **(c)**: no ata MCP al uso activo de la web, pero acota la exposición con un plazo propio que el propietario fija. |
| **Q2** | ¿Cómo sustituye la vía MCP a `claims.roles` en la intersección? | (a) `permisos(activeRoles ∩ session.roles) ∩ grant.scopeSet`. (b) Ignorar `session.roles` y usar solo `activeRoles`. | **(a)**, reutilizando la lógica de `authorizedRoles`. |
| **Q3** | ¿FK de `sessionId` a `AuthSession`? | (a) Sin FK, verificación en lectura. (b) FK con relación nueva en `AuthSession`. | **(a)**: no toca el modelo central de Auth. |
| **Q4** | Nombre y punto de evaluación del flag de apagado. | Nombre propuesto `MCP_S1_SERVER_ENABLED`, default `false`, evaluado al registrar el módulo/rutas MCP. | Fijar antes de la fase B. |
| **Q5** | ¿Quién puede revocar grants de otros usuarios de la org? | (a) Solo el propio usuario. (b) También un rol administrador de la org (definir permiso en `rbac.ts`). | Decisión de negocio; (b) requiere permiso nuevo y su propio test. |
| **Q6** | Retención de grants `REVOKED`/`EXPIRED` y `ON DELETE` de User/Org. | Plazo y política de borrado. | Decisión de negocio/legal; no inventar días. |
