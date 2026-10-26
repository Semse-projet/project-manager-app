---
id: "platform.semse-mcp-delegated-consent"
title: "S1/D7 — Consentimiento OAuth delegado persistente y revocable para SEMSE MCP"
domain: "platform"
sdd_version: "2.0"
version: "0.2"
status: "REVIEW"
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
> (S1, `REVIEW`). Contrato SDD 2.0 en **REVIEW** (decisiones del propietario
> Q1–Q6 cerradas el 2026-10-26; falta revisión de seguridad independiente para
> `APPROVED`): no autoriza schema Prisma,
> migración, endpoint, flag, despliegue ni activación MCP. D7 está aprobado
> por el propietario **a nivel de solución** (2026-10-15, ver
> [`decisions`](semse-mcp-project-read.decisions.md)); **D2 (Authorization
> Server/issuer) sigue PENDING** y bloquea las fases C y D. Código, CI, merge,
> deploy y activación se registran por separado.
>
> Insumo de diseño: plan D7 del PR #978
> (`semse-mcp-project-read.d7-persistence-plan.md`, aún no fusionado) y la
> revisión técnica publicada en ese PR el 2026-10-26. Este spec incorpora el
> contrato de ese plan y las decisiones Q1–Q6 del propietario (2026-10-26, §13).

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
| Administrador de la org (**v1.1**, Q5) | `mcp:consents:revoke:org` (permiso y rol nuevos en v1.1; hoy no existe rol admin de org en `rbac.ts`) | grants con `orgId` de su org | revocar grants de su org, uno a uno o por cliente | conceder en nombre de otro usuario; revocar fuera de su org |
| `OPS_ADMIN` (**v1**, Q5) | `mcp:consents:revoke:tenant` (permiso nuevo en v1, asignado a `OPS_ADMIN`) | grants de su `tenantId` | **v1:** revocar grants del tenant **uno a uno**, con motivo obligatorio. **v1.1:** además revocación masiva por `oauthClientId` | en v1, revocar en bloque por cliente; conceder; leer contenido de negocio vía grant; actuar fuera de su tenant |
| Cliente MCP (host) | ninguno propio | solo el grant `ACTIVE` vinculado a su token | leer `projectId,status` vía S1 | elegir org/tenant/usuario por argumento; elevar scopes |
| `WORKER` | sin `projects:read` | — | — | obtener lectura de proyecto vía grant |

- **Tenant boundary:** `tenantId` del grant debe coincidir con el de la
  `AuthSession` y con `Org.tenantId`; nunca se deriva de input de la tool.
- **Ownership/resource policy:** tras autorizar el grant, la lectura sigue
  pasando por la política de `ProjectsService`/`ProjectsRepository` (tenant,
  org, Project/Job no borrado) del camino D4 sin aprovisionamiento.
- **Intersección de permisos (Q2, DECIDIDO 2026-10-26):** la vía web calcula
  `activeRoles ∩ session.roles ∩ claims.roles` en `authorizedRoles`
  (`auth.service.ts`). En MCP no existe JWT SEMSE; la regla es
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
  - AuthSession ACTIVE, revokedAt null y refreshExpiresAt > now()  # Q1; accessExpiresAt NO se exige
  - User active; activeRoles de Membership ACTIVE en grant.orgId y tenantId
  - permisos(activeRoles ∩ session.roles) ∩ grant.scopeSet contiene projects:read
  - entregar authContext server-trusted al camino D4 de Projects
writes: ninguno (ni lastUsedAt, ni cambio a EXPIRED)
deny: 401/403 no enumerativo; 503 si DB/introspección falla o supera el deadline
```

### Servicio interno — revocar

```yaml
auth:   # Q5, por niveles; todos usan la misma operación
  v1:
    - nivel 1: el propio usuario del grant (sin permiso extra)
    - nivel 3: OPS_ADMIN con mcp:consents:revoke:tenant, solo grants de su tenantId, motivo obligatorio
  v1.1:
    - nivel 2: admin de org con mcp:consents:revoke:org, solo grants de su orgId
    - nivel 4: revocación masiva por oauthClientId dentro del alcance del nivel 2 o 3, motivo obligatorio
  sistema:
    - borrado de User/Org: revoca todos sus grants con motivo subject_deleted antes de borrar (§7)
scope_filter: userId | orgId | tenantId | oauthClientId, siempre AND tenantId del actor
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

- **FSM `McpDelegatedConsent`** (registrada como reservada, no implementada,
  en `docs/foundation/STATE_MACHINES.md`, 2026-10-26):

  ```text
  PENDING → ACTIVE → REVOKED
  PENDING → REVOKED
  PENDING → EXPIRED
  ACTIVE  → EXPIRED
  REVOKED, EXPIRED = terminales; reautorizar = nuevo id y versión
  ```

  Autorización por transición y condiciones: ver `STATE_MACHINES.md`.
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
  `idempotencyKeyDigest?`, `revokedByUserId?`, `revocationReasonCode?`,
  `anonymizedAt?` (Q6). `userId` y `sessionId` pasan a nulables **solo** para
  filas anonimizadas; la verificación deniega cualquier grant con `userId` nulo.
- **Expiración del grant (Q1, DECIDIDO 2026-10-26):** al aceptar,
  `expiresAt = min(AuthSession.refreshExpiresAt, authorizedAt + MCP_GRANT_MAX_TTL)`.
  En cada llamada se exige `grant.expiresAt > now()` **y**
  `AuthSession.refreshExpiresAt > now()`; `accessExpiresAt` (token web de 1 h)
  no interviene, de modo que MCP no depende del uso activo de la web. El valor
  de **`MCP_GRANT_MAX_TTL` = 30 días** (decisión del propietario 2026-10-26).
  Es un máximo, no un valor fijo: cada grant puede pedir menos según su
  riesgo (p. ej. 24 h o 7 días), nunca más. La renovación web
  (`rotateSessionRefreshToken`) puede ampliar `refreshExpiresAt` pero **nunca**
  amplía `grant.expiresAt`: un grant caducado exige nuevo consentimiento.
- **Índices:** `(tenantId, orgId, userId, status, expiresAt)`,
  `(tenantId, sessionId, status)`, `(tenantId, oauthClientId, status)`;
  únicos `(tenantId, grantBindingDigest)` y `(tenantId, idempotencyKeyDigest)`
  cuando no sea nulo.
- **Relaciones (Q3, DECIDIDO 2026-10-26):** **sin FK a `AuthSession`**.
  `AuthSession` no declara relaciones Prisma hoy (comentario en
  `auth.repository.ts`) y añadirle una relación toca un modelo central de Auth.
  La coherencia grant↔sesión↔org↔tenant se verifica en lectura, como ya hace
  `findActiveSessionAuthorization`. Tampoco hay FK a `Tenant`/`Org`/`User`
  (Q6-X1): el borrado de estos no se bloquea ni arrastra grants en cascada.
- **Conservación (Q6, DECIDIDO 2026-10-26), por capas:**
  - registros de auditoría de aceptación/revocación/denegación: `AuditEvent`,
    mínimo legal de la jurisdicción del tenant; nunca se purgan por debajo
    (matriz M-06 de `semseproject`);
  - grant `ACTIVE`: mientras esté vigente;
  - grant terminal: completo durante **90 días** contados desde su
    **momento terminal** `terminalAt = coalesce(revokedAt, expiresAt)`, para
    investigar incidentes. El reloj **no depende del estado**: un grant que
    sigue `ACTIVE` en la tabla pero con `expiresAt` vencido (porque el
    mantenimiento `ACTIVE → EXPIRED` no corrió) entra igual en retención desde
    su `expiresAt`. Así la anonimización nunca depende de ese mantenimiento
    opcional;
  - pasados 90 días desde `terminalAt`, el job de anonimización selecciona
    `anonymizedAt IS NULL AND coalesce(revokedAt, expiresAt) + plazo <= now()`,
    con independencia de `status`, y en la misma transacción: (a) si el grant
    sigue `ACTIVE`, lo pasa a `EXPIRED` (transición válida de la FSM; es un
    worker, no la vía de lectura); (b) pone a nulo `userId`, `sessionId`,
    `revokedByUserId`, `idempotencyKeyDigest` **y `grantBindingDigest`**;
    (c) trunca `createdAt`, `authorizedAt`, `expiresAt`, `revokedAt` y
    `updatedAt` al **día** (UTC); (d) fija `anonymizedAt`. Se conservan
    `tenantId`, `orgId`, `oauthClientId`, `resourceUri`, `scopeSet`, `status`,
    `revocationReasonCode` y las versiones de política, salvo legal hold;
  - agregados sin datos personales (conteos por cliente/org): sin límite.
  - Un tenant puede **alargar** los 90 días, nunca acortarlos.
  - Fila añadida a la matriz de retención M-06
    (`.claude/skills/semseproject/references/operations.md`, 2026-10-26).
  - Verificación de no reidentificación (D7-21): la fila anonimizada no debe
    poder vincularse a una persona combinando sus campos con otras tablas o con
    el AS. Por eso se elimina `grantBindingDigest` (el AS puede conservar el
    grant asociado al sujeto) y se truncan las fechas (un timestamp exacto
    permite cruzar con `AuthSession.createdAt`/`lastUsedAt` o con logs). La
    unicidad de `(tenantId, grantBindingDigest)` debe ser **parcial** (solo
    filas no nulas) para admitir varias filas anonimizadas.
  - **Riesgo residual declarado:** en una org con un solo miembro, `orgId` +
    `oauthClientId` + día siguen apuntando a una persona. La fase A decide con el
    DPO si en ese caso se elimina también `orgId` de la fila (dejando solo los
    agregados) o se acepta el riesgo con acceso restringido. D7-21 incluye ese
    caso para que la decisión quede probada. La correlación con el
    `AuditEvent`, que conserva identificadores por obligación legal, es
    esperada y queda protegida por el control de acceso a la auditoría, no por
    la anonimización.
- **Borrado de User/Org (Q6, DECIDIDO):** (1) revocar todos sus grants con
  motivo `subject_deleted`; (2) anonimizarlos de inmediato, sin esperar los 90
  días (derecho de supresión); (3) si la revocación previa falla, el borrado se
  detiene y avisa (salvaguarda); (4) cualquier llamada con un grant cuyo User
  ya no existe se deniega. Hoy **no existe** flujo de borrado de User ni Org en
  `apps/api/src`; esta regla obliga a cualquier flujo futuro de supresión,
  también a uno manual de operaciones.
- **Concurrencia aceptación ↔ borrado:** sin un orden fijo, un grant puede
  crearse entre el barrido de revocación y el borrado y quedar `ACTIVE` sin
  titular. Contrato:
  1. el flujo de borrado **primero cierra la puerta**: pone el User en estado
     no `active` (o, para una Org, revoca las Membership) y revoca sus
     `AuthSession`, en una transacción propia y confirmada;
  2. **después** barre y revoca + anonimiza los grants;
  3. **al final** borra User/Org;
  4. la aceptación, dentro de su transacción de inserción, relee con bloqueo
     compartido (`SELECT … FOR SHARE`) la `AuthSession` y el `User` y exige
     `AuthSession ACTIVE` y `User active`; como el paso 1 actualiza esas
     mismas filas, PostgreSQL serializa ambas operaciones: o la aceptación
     termina antes (y su grant cae en el barrido del paso 2) o ve la puerta
     cerrada y falla;
  5. un barrido final tras el paso 3 revoca cualquier grant de ese `userId`
     que siga `ACTIVE` (defensa en profundidad), y la verificación por llamada
     ya deniega grants sin User (punto 4 anterior).
  Prueba determinista con barrera: D7-23.
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
- **Feature flags/allowlists (Q4, DECIDIDO 2026-10-26):** el plan D7 citaba
  `MCP_SERVER_ENABLED=false`, que **no existe** en `apps/` ni `packages/`. El
  flag de apagado se llamará **`MCP_S1_SERVER_ENABLED`**, con default `false`
  (cualquier valor distinto de `"true"` = apagado), y se evalúa al registrar
  el módulo/rutas MCP: con el flag apagado no se monta ninguna ruta MCP (D7-14).
  Se crea en la fase B; `feature_flags` sigue `[]` hasta que exista en código.
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
| **D7-19** | v1: `OPS_ADMIN` revoca un grant de su tenant y otro de un tenant ajeno, e intenta la revocación masiva por `oauthClientId` | El primero queda `REVOKED`; el ajeno se rechaza sin revelar existencia; la masiva se rechaza en v1 (no existe la operación) |
| **D7-19b** | v1.1: revocación masiva por `oauthClientId` de admin de org y de `OPS_ADMIN` | Solo cambian grants de ese cliente dentro de la org / tenant del actor; idempotente |
| **D7-20** | Borrado de User con grants `ACTIVE` | Grants `REVOKED` con `subject_deleted` y anonimizados antes de que termine el borrado; auditoría intacta; si la revocación falla, el borrado se detiene |
| **D7-21** | Job de anonimización a los 90 días, con tenant que alarga el plazo, y org de un solo miembro | Se anonimiza solo lo vencido; `grantBindingDigest` nulo y fechas truncadas al día; ningún campo restante permite cruzar con `AuthSession`, `User` ni el AS; el caso de org unipersonal sigue la decisión de fase A; `AuditEvent` sin tocar; plazo del tenant respetado |
| **D7-23** | Aceptación y borrado del mismo User en paralelo, con barrera entre la relectura de la aceptación y el paso 1 del borrado, en ambos órdenes | Nunca queda un grant `ACTIVE` sin titular: o se crea y el barrido lo revoca + anonimiza, o la aceptación falla con 401 |
| **D7-24** | Grant con `expiresAt` vencido hace 91 días que sigue `ACTIVE` porque el mantenimiento no corrió | El job de anonimización lo pasa a `EXPIRED` y lo anonimiza en la misma transacción |
| **D7-22** | Aceptación pidiendo más de 30 días o con `refreshExpiresAt` menor | `expiresAt` = mínimo de los tres; nunca supera 30 días |
| **D7-18** | Expiración de sesión según Q1: (a) `accessExpiresAt` vencido con `refreshExpiresAt` y grant vigentes; (b) `refreshExpiresAt` vencido con grant vigente; (c) `grant.expiresAt` vencido con sesión vigente; (d) refresh web amplía `refreshExpiresAt` | (a) se autoriza; (b) y (c) se deniegan; (d) `grant.expiresAt` no cambia |

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
- `apps/worker/`: job de anonimización por `terminalAt` (**obligatorio**, §7)
  y job de mantenimiento `ACTIVE → EXPIRED` (opcional en v1; la lectura ya
  deniega por `expiresAt` y la anonimización no depende de él).

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

- [x] Q1–Q4 decididas por el propietario (2026-10-26, §13)
- [x] Q5, Q6 y valor de `MCP_GRANT_MAX_TTL` decididos (2026-10-26, §13)
- [x] Fila del grant añadida a la matriz de retención M-06 (`.claude/skills/semseproject/references/operations.md`)
- [x] FSM registrada en `STATE_MACHINES.md` como reservada
- [ ] Revisión de seguridad por persona **independiente del autor** con estado
  `APPROVED` sobre este spec (regla S1)
- [ ] Eventos en `EVENT_CATALOG.md` si
  se adoptan
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests D7-01…D7-24 derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED` (fase D, aprobación separada)
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`

## 13. Decisiones del propietario

**Registro de decisión (2026-10-26):** el propietario aceptó en conversación
de trabajo las recomendaciones de Q1–Q4 y, después, el diseño integrado de
Q5–Q6 con tres valores: conservación completa **90 días**, `MCP_GRANT_MAX_TTL`
**30 días** y revocación por administrador de org en **v1.1**. Esto fija el
diseño de este spec y lo pasa a `REVIEW`; no autoriza migración, código, flag
productivo, despliegue ni cambia D2, S1 o ADR-045. `APPROVED` sigue exigiendo
revisión de seguridad independiente del autor (§12).

| # | Pregunta | Estado | Decisión |
|---|---|---|---|
| **Q1** | ¿Qué expiración de `AuthSession` gobierna el grant? (`ACCESS_TOKEN_TTL_SECONDS = 1h`, `REFRESH_TOKEN_TTL_SECONDS = 30d`) | **DECIDIDO** | `refreshExpiresAt` + tope `MCP_GRANT_MAX_TTL` = **30 días**, máximo y no valor fijo (§7). |
| **Q2** | ¿Qué sustituye a `claims.roles` en la intersección? | **DECIDIDO** | `permisos(activeRoles ∩ session.roles) ∩ grant.scopeSet`, reutilizando `authorizedRoles` (§3). |
| **Q3** | ¿FK de `sessionId` a `AuthSession`? | **DECIDIDO** | Sin FK; verificación en lectura (§7). |
| **Q4** | Flag de apagado | **DECIDIDO** | `MCP_S1_SERVER_ENABLED`, default `false`, evaluado al registrar el módulo/rutas MCP (§8). |
| **Q5** | ¿Quién puede revocar grants de otros usuarios de la org? | **DECIDIDO** | Niveles integrados: v1 = usuario + `OPS_ADMIN` del tenant; v1.1 = admin de org + revocación masiva por cliente (§3, §5). Opciones evaluadas en §13.1. |
| **Q6** | Retención de grants terminales y `ON DELETE` de User/Org | **DECIDIDO** | Capas: auditoría al mínimo legal; grant terminal completo 90 días y luego anonimizado (R2+R3+R4); sin FK y revocar + anonimizar al borrar (X1+X4, X3 como salvaguarda) (§7). Opciones evaluadas en §13.2. |

### 13.1 Q5 — Quién revoca

Revocar siempre es seguro (solo quita acceso), así que el riesgo de abrirlo es
bajo; el de no abrirlo es que nadie pueda cortar un cliente comprometido de un
usuario ausente.

| Opción | Quién revoca | Implica | A favor | En contra |
|---|---|---|---|---|
| **A** | Solo el propio usuario | Nada nuevo en `rbac.ts` | Mínimo; nadie toca grants ajenos | Si el usuario no está o su cuenta está comprometida, la org no puede cortar el acceso salvo revocando su Membership/sesión entera |
| **B** | Usuario + rol administrador de la org | Permiso nuevo (p. ej. `mcp:consents:revoke`) asignado a un rol admin de org; revocación acotada a `grant.orgId` | Respuesta a incidentes sin dejar al usuario sin web | Hay que definir qué rol admin de org existe hoy en `rbac.ts` (no hay uno dedicado) y su test cross-org |
| **C** | Usuario + admin de org + `OPS_ADMIN` de plataforma | B + `OPS_ADMIN` con revocación en cualquier org de su tenant, auditada con motivo obligatorio | Cubre incidentes globales (cliente MCP malicioso) | Poder amplio; requiere motivo y auditoría estricta |
| **D** | B + revocación masiva por cliente | Operación "revocar todos los grants del `oauthClientId` X" en la org (o en la plataforma con C) | Cortar un cliente comprometido de una vez | Operación de mayor alcance; necesita su propia prueba de idempotencia y de límites tenant |

Cualquier opción mantiene: compare-and-set `ACTIVE → REVOKED`, idempotencia,
`revokedByUserId` + `revocationReasonCode` y bloqueo de la siguiente llamada.

### 13.2 Q6 — Retención y borrado

Dos preguntas distintas: cuánto se conserva un grant terminal, y qué pasa
cuando se borra el User o la Org.

**Retención de grants `REVOKED`/`EXPIRED`:**

| Opción | Política | A favor | En contra |
|---|---|---|---|
| **R1** | Conservar indefinidamente | Auditoría completa | Crece sin límite; conserva IDs de usuario más de lo necesario (minimización GDPR/CCPA) |
| **R2** | Conservar N días tras el estado terminal y luego borrar | Simple, minimiza datos | Se pierde el rastro después de N días |
| **R3** | Conservar N días; luego anonimizar (`userId`/`sessionId` → nulos o hash) y conservar el resto | Mantiene estadística/auditoría de cliente y org sin datos personales | Más complejo; requiere job de mantenimiento |
| **R4** | Tratar el grant como `AuditEvent` (mínimo legal de la jurisdicción del tenant) | Máxima defensa ante auditoría | Conserva datos personales más tiempo que R2/R3 |

**Restricción ya escrita:** la matriz de retención de
`.claude/skills/semseproject/references/operations.md` (M-06) exige que todo
dato nuevo tenga **su fila antes de almacenarse** y, si no encaja, se trate
como la fila más restrictiva. El grant no tiene fila hoy, así que la fase A
debe añadirla. Además, los **registros de auditoría** de aceptación/revocación
son `AuditEvent` y no son purgables por debajo del mínimo legal, aunque el
grant en sí se borre o anonimice: R2/R3 aplican a la fila del grant, no a su
auditoría.

**Borrado de User/Org (`ON DELETE`):**

| Opción | Efecto | A favor | En contra |
|---|---|---|---|
| **X1** | Sin FK a User/Org (como Q3) y borrado por job | No bloquea borrados; coherente con Q3 | Puede quedar algún grant huérfano hasta que corra el job |
| **X2** | FK con `Cascade` | Limpieza automática | Borra evidencia auditable en cascada (el plan D7 lo desaconseja) |
| **X3** | FK con `Restrict` | Nada se borra por accidente | Bloquea el borrado de User/Org hasta tratar los grants; afecta flujos existentes |
| **X4** | FK con `SetNull` en `userId` + anonimización | Conserva el grant anonimizado | Columnas nullable; la verificación debe denegar grants sin `userId` |

**Adoptado (2026-10-26):** R2+R3 sobre la fila del grant, R4 sobre su
auditoría, X1+X4 con X3 como salvaguarda; N = 90 días fijado por el
propietario. Antes de borrar un User/Org, todos sus grants deben estar
`REVOKED` (borrar un usuario implica revocar). Anonimizar el grant no borra su
auditoría legal. Detalle normativo en §7.
