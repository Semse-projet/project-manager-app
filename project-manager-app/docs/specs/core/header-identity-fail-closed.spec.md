---
id: "core.header-identity-fail-closed"
title: "Identidad por cabeceras sólo con opt-in explícito (fail-closed fuera de producción)"
domain: "core"
sdd_version: "2.0"
version: "0.2"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/auth/auth.service.ts"
  - "apps/api/src/common/request-context.ts"
  - "apps/api/src/modules/operational-intelligence/operational-intelligence.controller.ts"
  - "apps/api/src/main.ts"
  - "apps/api/scripts/run-tests.mjs"
  - "apps/worker/src/main.mjs"
  - "apps/web/app/api/semse/_server.ts"
  - "docs/auth.md"
related_tests:
  - "apps/api/test/header-identity-policy.test.ts"
  - "apps/api/test/operational-intelligence-http-tenant.test.ts"
  - "apps/api/test/operational-intelligence.controller.test.ts"
  - "apps/api/test/observer-history-http-auth.test.ts"
  - "apps/api/test/business-access-foundation.test.ts"
related_endpoints:
  - "GET /v1/ops/observer/history"
  - "GET /v1/operational-intelligence/signals"
  - "PATCH /v1/operational-intelligence/signals/:id/acknowledge"
  - "PATCH /v1/operational-intelligence/signals/:id/resolve"
  - "PATCH /v1/operational-intelligence/signals/:id/dismiss"
  - "GET /v1/operational-intelligence/runs"
  - "POST /v1/operational-intelligence/seed-test"
  - "GET /v1/operational-intelligence/brief"
related_events: []
related_agents: []
last_verified: "2026-11-04"
---

# Spec: Identidad por cabeceras sólo con opt-in explícito

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado.

**Autorización del owner (2026-11-04):** `@Samuelcastella` eligió la opción A
de §13 y autorizó implementar. La aprobación cubre una rama de trabajo y un
PR en borrador. **No autoriza merge, cambios de configuración en Railway ni
deploy**; esos pasos requieren su aprobación por separado.

**Origen:** revisión independiente de los tests de #1083 (O.HI4/O.HI5) y PR
#1091. Hallazgos verificados leyendo código en `main` `be748bb`; nada de este
documento se verificó en vivo contra Railway.

**Relación con specs existentes:** extiende `core.business-access-foundation`
AC-12 ("No AUTH_SECRET in production does not enable header-derived
identity"), que ya está cumplido para `NODE_ENV=production`. Este spec cubre el
hueco que AC-12 deja fuera: **cualquier otro valor de `NODE_ENV`, incluido
ninguno**. No modifica el modelo de sesión, tokens ni RBAC de ese spec.

## 1. Problema y resultado

**Para quién:** operadores de SEMSE y cualquier tenant cuyos datos estén en un
entorno que no sea estrictamente `production` (staging, preview, QA
compartido, una réplica levantada a mano).

**Problema:**

1. **Fail-open por omisión.** `AuthService.authenticateRequest`
   (`auth.service.ts:157-162`) y `resolveRequestContext`
   (`request-context.ts`, rama final) aceptan las cabeceras
   `x-user-id`, `x-tenant-id`, `x-org-id` y `x-roles` (`SEMSE_IDENTITY_HEADER_NAMES`)
   como identidad cuando falta `AUTH_SECRET` y `NODE_ENV !== "production"`.
   Cualquiera que alcance la API puede declararse `OPS_ADMIN` de cualquier
   tenant. La condición se dispara sola con un error de configuración: basta
   con olvidar `AUTH_SECRET` en un entorno cuyo `NODE_ENV` sea `staging`,
   `preview`, `test`, o no esté definido.
2. **Identidad leída del objeto equivocado.** `OperationalIntelligenceController`
   llama a `parseHeaderRequestContext(req)` en sus 7 handlers, pasando el
   request completo en lugar de sus cabeceras y sin pasar por el contexto
   verificado (`req.authContext`). Por código, en HTTP real
   `req["x-tenant-id"]` es `undefined`, así que esos endpoints responden
   401 siempre. Hoy eso es un fallo funcional, no una fuga. Pero el arreglo
   "obvio" (`parseHeaderRequestContext(req.headers)`) convertiría el endpoint en
   un IDOR: tomaría el tenant de una cabecera controlada por el cliente aunque
   el bearer sea válido. `apps/api/test/operational-intelligence.controller.test.ts`
   enmascara el problema, porque construye el request con las cabeceras como
   propiedades de primer nivel (lo dice su propio comentario, líneas 9-10).

**Severidad actual (estimada, no verificada en vivo):** las imágenes de
Railway fijan `ENV NODE_ENV=production` (`Dockerfile.api:42`,
`Dockerfile.worker:44`) y `infra/railway/RAILWAY_ENV_VARS.md` lo exige, así
que la producción actual queda cubierta por AC-12. El riesgo está en
entornos no productivos con datos reales o compartidos, y en cualquier
despliegue que no use esas imágenes. Riesgo `high`, no `critical`.

**Resultado esperado:**

- Sin `AUTH_SECRET`, la API **nunca** acepta identidad por cabeceras salvo
  opt-in local explícito (§13). El resto de los casos responde `503
  Authentication authority unavailable`, igual que producción hoy.
- La decisión sale de una sola función compartida, sin lógica duplicada entre
  `authenticateRequest` y `resolveRequestContext`.
- Ningún controlador deriva identidad de cabeceras: todos usan el contexto
  verificado.
- El desarrollo local que hoy funciona sin `AUTH_SECRET` (Worker, BFF) sigue
  funcionando con el opt-in documentado.

## 2. Alcance

### Incluido

- Regla única `headerIdentityAllowed(env)` en `apps/api/src/common/`,
  consumida por `authenticateRequest` y `resolveRequestContext`.
- Fail-closed (503) cuando falta `AUTH_SECRET` y no hay opt-in.
- Log estructurado de advertencia al arranque y en la primera petición
  cuando el modo por cabeceras está activo (sin datos de identidad).
- `OperationalIntelligenceController`: reemplazar los 7 usos de
  `parseHeaderRequestContext(req)` por `resolveRequestContext(req)`.
- Corregir `operational-intelligence.controller.test.ts` para que ejercite el
  camino real (contexto verificado), más un test HTTP de aislamiento por tenant.
- Actualizar `docs/auth.md` (sección modo dev del Worker) y
  `apps/api/.env.example` / `.env.example` con el opt-in.

### Fuera de alcance

- Cambios al formato de token, a la sesión (`AuthSession`) o a RBAC.
- Validación de `AUTH_SECRET` al arranque del proceso (hoy es lazy, por
  request; ver `AUDIT_REMEDIATION_PLAN.md` §bootstrap). Puede ser un spec aparte.
- `SEMSE_BOOTSTRAP_TOKEN` (ya tratado en `AUDIT_REMEDIATION_PLAN.md`).
- El borrado de cabeceras `x-semse-*` en el middleware web (ya corregido y
  verificado en vivo, `AUDIT_REMEDIATION_PLAN.md`).
- La frontera SSE `@Public()` / cabeceras de cliente (riesgo P0 aparte,
  ADR-040).
- Cambios de variables en Railway. Este spec **no** toca configuración de
  producción.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Cliente HTTP anónimo | ninguno | ninguno | recibir 401/503 | autenticarse con cabeceras de identidad (`x-tenant-id`, `x-roles`…) sin opt-in |
| Usuario con bearer válido | según sesión | tenant/org del token **y** de la sesión | operar en su tenant | cambiar de tenant con `x-tenant-id` / `x-semse-tenant-id` |
| `OPS_ADMIN` | `ops:dashboard:read/write` | tenant de su contexto verificado | leer/gestionar señales de su tenant | leer señales de otro tenant |
| Desarrollador local | n/a | máquina local | usar identidad por cabeceras con opt-in | activar el opt-in en `production` (el opt-in se ignora ahí) |
| Worker (local sin `AUTH_SECRET`) | identidad de servicio | según cabeceras, sólo con opt-in | operar en dev | operar sin opt-in: recibe 503 y debe fallar visible |

- **Tenant boundary:** el tenant sale siempre de `req.authContext` (token
  verificado + sesión), nunca de una cabecera, salvo opt-in local.
- **Ownership/resource policy:** sin cambios. Los servicios de OI ya filtran
  por `tenantId`; este spec garantiza que ese `tenantId` sea el verificado.
- **Step-up o aprobación humana:** no aplica.
- **Datos `privacyCritical`:** identidad y roles. Los logs nunca incluyen
  valores de cabeceras, tokens ni `AUTH_SECRET`; sólo el hecho de que el modo
  está activo y el valor de `NODE_ENV`.
- **Requisitos de auditoría:** no hay cambio de estado de dominio, así que no
  se emite evento ni se crea un nombre nuevo fuera de `EVENT_CATALOG.md`. La
  advertencia es un log operativo.

## 4. Escenarios y criterios de aceptación

### P1 — Sin `AUTH_SECRET` y sin opt-in, la API falla cerrada

```gherkin
DADO que AUTH_SECRET no está definido
Y NODE_ENV es "staging" (o "preview", "test", "development" o no está definido)
Y no hay opt-in de identidad por cabeceras
CUANDO un cliente llama a cualquier endpoint protegido con x-tenant-id y x-roles: OPS_ADMIN
ENTONCES la respuesta es 503 "Authentication authority unavailable"
Y no se ejecuta el handler
```

- **AC-HI-01:** lo anterior se cumple en `authenticateRequest` (AuthGuard) y en
  `resolveRequestContext` (uso directo desde controladores).
- **AC-HI-02:** `NODE_ENV` indefinido se trata igual que un entorno no local:
  falla cerrado.
- **AC-HI-03:** `NODE_ENV=production` sigue respondiendo 503 sin `AUTH_SECRET`,
  **aunque** el opt-in esté presente. Esto preserva AC-12 de
  `core.business-access-foundation`.

### P1 — Opt-in local explícito conserva el desarrollo actual

```gherkin
DADO que AUTH_SECRET no está definido
Y el opt-in local está activo según la regla decidida en §13
CUANDO el Worker o el BFF local llaman con cabeceras de identidad (x-user-id, x-tenant-id, x-org-id, x-roles)
ENTONCES la API construye el contexto desde las cabeceras como hoy
Y al arrancar se registra una advertencia "header identity mode enabled" con NODE_ENV, sin identidades
```

- **AC-HI-04:** el flujo local documentado en `docs/auth.md` sigue funcionando
  con el opt-in y sin `AUTH_SECRET`.
- **AC-HI-05:** con `AUTH_SECRET` definido, el opt-in no tiene efecto: siempre
  se exige bearer y sesión.

### P1 — Operational Intelligence usa el contexto verificado

```gherkin
DADO un OPS_ADMIN con bearer válido del tenant A
CUANDO llama a GET /v1/operational-intelligence/signals con x-tenant-id: tenant-B
ENTONCES la respuesta es 200 con señales sólo del tenant A
Y el servicio recibe tenantId = tenant A
```

- **AC-HI-06:** los 7 handlers de `OperationalIntelligenceController` obtienen
  el contexto con `resolveRequestContext(req)` y ninguno llama a
  `parseHeaderRequestContext`.
- **AC-HI-07:** `GET /signals` y `GET /runs` responden 200 con bearer válido,
  lo que corrige el 401 permanente que se ve por código.
- **AC-HI-08:** `PATCH .../acknowledge|resolve|dismiss` sobre una señal de otro
  tenant no la modifica: el servicio recibe el tenant verificado y el
  resultado es el mismo que hoy para una señal inexistente.
- **AC-HI-09:** `POST /seed-test` sigue bloqueado en producción (403) y fuera de
  producción escribe con el tenant verificado.

### P2 — Regla única y sin regresión

- **AC-HI-10:** existe una sola función que decide si se permite identidad por
  cabeceras, y ambos caminos (guard y `resolveRequestContext`) la usan.
- **AC-HI-11:** `parseHeaderRequestContext` sólo se invoca desde esa rama
  local. Un test o lint lo verifica en `apps/api/src`.

Casos borde:

- [ ] `NODE_ENV` con mayúsculas o espacios (`"Production"`, `" production "`):
  se normaliza antes de comparar; ante la duda, falla cerrado.
- [ ] Opt-in con valor inválido (`"yes"`, `"1 "`): sólo se acepta el valor
  exacto definido en §13; cualquier otro equivale a desactivado.
- [ ] Cabeceras de identidad (`x-tenant-id`) y de proxy web (`x-semse-tenant-id`): ninguna
  sobreescribe el contexto verificado.
- [ ] Aislamiento cross-tenant en los 7 endpoints de OI (lectura y escritura).

## 5. Contratos

### API — endpoints protegidos (todos), sin `AUTH_SECRET`

```yaml
auth: required
permissions: según endpoint (sin cambios)
input_schema: sin cambios
output_schema: sin cambios
errors:
  401: sin bearer o bearer inválido (con AUTH_SECRET)
  403: permiso insuficiente (sin cambios)
  503: AUTH_SECRET ausente y modo por cabeceras no permitido (NUEVO fuera de production)
effects:
  audit_log: no
  domain_event: no
  sse: no
  payment_governance: no
```

### API — `/v1/operational-intelligence/*`

```yaml
auth: required
permissions: [ops:dashboard:read | ops:dashboard:write] (sin cambios)
tenant_source: req.authContext (antes: propiedades del objeto req)
errors:
  401: sin contexto verificado
  403: sin permiso o seed-test en producción
effects:
  audit_log: no
  domain_event: no
```

### Configuración

```yaml
AUTH_SECRET: sin cambios (requerido en production)
opt_in_variable: SEMSE_ALLOW_HEADER_IDENTITY="true" + NODE_ENV in {development, test} (§13)
default: desactivado (fail-closed)
ignored_when: NODE_ENV=production o AUTH_SECRET presente
```

### UI / Agente

No aplica. El BFF web no cambia en producción (ya usa bearer).

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` ("`tenantId` sólo acota el
  espacio; no autoriza por sí solo") y Constitución Art. VII (filtros de
  tenant en backend). Este spec los refuerza.
- Eventos declarados: ninguno nuevo.
- Productor/consumidores/replay/DLQ: no aplica.

## 7. Datos y migración

- Modelos Prisma: ninguno.
- Migración: no aplica.
- Compatibilidad hacia atrás: **rompe a propósito** el arranque local sin
  `AUTH_SECRET` y sin opt-in. Mitigación: el mensaje 503 y el log de arranque
  nombran la variable de opt-in; `docs/auth.md` y los `.env.example` se
  actualizan en el mismo PR.
- Rollback de código: revertir el PR. No hay datos que restaurar.

## 8. Observabilidad, despliegue y activación

- **Logs:** advertencia única al arranque y en la primera petición con modo por
  cabeceras activo (`NODE_ENV`, sin identidades). El 503 por configuración se
  registra con `requestId`.
- **Métrica sugerida:** contador de respuestas 503 por "authority
  unavailable". Hoy no hay SLO.
- **Feature flags:** ninguno (el opt-in es configuración local, no flag de
  producto).
- **Canary:** no aplica. En producción no cambia nada observable si
  `AUTH_SECRET` está definido, como hoy.
- **Evidencia de producción requerida:** smoke autenticado de
  `GET /v1/operational-intelligence/signals` con bearer real de `OPS_ADMIN`,
  devolviendo 200 sólo con señales del tenant. Requiere autorización del
  owner; este spec no la concede.
- **Señal de rollback:** aumento de 503 o 401 en producción tras el deploy.
- **Owner operativo:** `@Samuelcastella`.

## 9. Tests requeridos

- [ ] Unit: `headerIdentityAllowed` con la matriz completa de `NODE_ENV`
  (`production`, `staging`, `preview`, `test`, `development`, indefinido,
  variantes de mayúsculas y espacios) × opt-in (ausente, válido, inválido) ×
  `AUTH_SECRET` (presente, ausente).
- [ ] HTTP (`observer-history-http-auth.test.ts`): sin `AUTH_SECRET` y
  `NODE_ENV=staging`, petición sólo con cabeceras → 503. Sustituye el hueco
  documentado en #1091.
- [ ] HTTP: con opt-in local, petición con cabeceras → 200 (contrato de dev).
- [ ] HTTP `operational-intelligence`: bearer del tenant A con
  `x-tenant-id: tenant-B` → sólo señales de A; PATCH sobre señal de B no
  la modifica.
- [ ] `operational-intelligence.controller.test.ts` reescrito para usar
  `req.authContext` y cabeceras reales, no propiedades de primer nivel.
- [ ] Guardia estática: `parseHeaderRequestContext` no se usa fuera de
  `request-context.ts` / `auth.service.ts`.
- [ ] Mutación: quitar la regla única hace fallar los tests de 503.
- [ ] Smoke autenticado en producción (sólo con autorización del owner).

## 10. Mapa de implementación

### API

- `apps/api/src/common/request-context.ts`: `headerIdentityAllowed(env)` y uso en
  `resolveRequestContext`.
- `apps/api/src/modules/auth/auth.service.ts`: usar la misma regla en
  `authenticateRequest`.
- `apps/api/src/modules/operational-intelligence/operational-intelligence.controller.ts`:
  `resolveRequestContext(req)` en los 7 handlers.
- `apps/api/src/main.ts` (o el bootstrap equivalente): log de advertencia al
  arranque.

### Worker/Web/Docs

- `apps/worker/src/main.mjs`: sin cambio de lógica. Revisar el mensaje "API
  calls use identity headers only" para que nombre el opt-in.
- `docs/auth.md`, `apps/api/.env.example`, `.env.example`: documentar el opt-in.

### Tests

- `apps/api/test/header-identity-policy.test.ts` (nuevo).
- `apps/api/test/observer-history-http-auth.test.ts` (ampliar).
- `apps/api/test/operational-intelligence.controller.test.ts` (corregir).
- `apps/api/test/operational-intelligence-http-tenant.test.ts` (nuevo, HTTP real
  con AuthGuard + RbacGuard como O.HI4).

### Notas de implementación (2026-11-04)

- **Runner unitario:** 30 tests unitarios de 10 archivos (`ai-models.controller`,
  `chat-actions-service`, `chat-evidence-*`, `escrow-release-service-replay`,
  `jev-agent-router`, `knowledge.controller`, `reservations.contract`,
  `semse-observer`, `signed-file-access`) ejercitaban controladores por el
  contrato local de cabeceras sin declararlo. Su `NODE_ENV` estaba sin
  definir. `apps/api/scripts/run-tests.mjs` declara ahora, sólo en modo unit y
  sólo como valor por defecto, `NODE_ENV=test` y
  `SEMSE_ALLOW_HEADER_IDENTITY=true`. Un valor explícito en el entorno siempre
  gana, y los tests de política fijan su propio entorno, así que la mutación
  de cada condición sigue haciéndolos fallar.
- **Integración:** 4 suites de Agro (`agro-evidence-upload`, `agro-jobtask-mirror`,
  `agro-membership-operations`, `agro-workforce-incidents`) autentican por
  cabeceras a propósito. Declaran el opt-in en su propio `buildApp()`. El
  runner no lo hace en modo integración.
- **Worker:** sólo cambió el texto de un log de advertencia; no hay cambio de
  lógica.
- **`GET /v1/operational-intelligence/brief`:** es el séptimo handler, que no
  estaba en la versión 0.1 del spec. También usa el contexto verificado.

## 11. Investigación externa

- OWASP ASVS v4.0.3 V1.4 / V4.1: decisiones de control de acceso aplicadas en
  servidor y fallando cerradas ante error de configuración.
- OWASP Top 10 2021 A01 (Broken Access Control) y A05 (Security
  Misconfiguration): el modo por cabeceras activado por omisión es el patrón
  de A05.
- **Aplicado ahora:** fail-closed por defecto con opt-in explícito.
- **Backlog:** validación de secretos al arranque (fuera de alcance).
- **Descartado:** eliminar del todo el modo por cabeceras, porque rompería el
  flujo local del Worker sin un reemplazo aprobado (AC-09 de
  `business-access-foundation`).

## 12. Gates de cierre

- [x] Decisión §13 cerrada por el owner y `status: APPROVED`
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Plan, tasks, analyze y checklist coherentes con este spec
- [ ] Tests de §9 escritos antes del código y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deploy `DEPLOYED` y smoke autenticado de OI verificado por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`

## 13. Decisión (clarify) — cerrada

**Resolución (owner, 2026-11-04): opción A.** El modo por cabeceras se permite
sólo si se cumplen las tres condiciones:

1. `AUTH_SECRET` no está definido (o está vacío).
2. `SEMSE_ALLOW_HEADER_IDENTITY` vale exactamente `"true"`, tras quitar
   espacios. Cualquier otro valor equivale a desactivado.
3. `NODE_ENV`, normalizado (`trim` + minúsculas), es `development` o `test`.

Con `NODE_ENV=production` el modo nunca se permite. Si las tres condiciones no
se cumplen y falta `AUTH_SECRET`, la respuesta es 503.

**Opciones evaluadas** (se conserva el registro):

| Opción | Regla | A favor | En contra |
|---|---|---|---|
| **A (recomendada)** | Variable explícita `SEMSE_ALLOW_HEADER_IDENTITY=true` **y** `NODE_ENV` ∈ {`development`, `test`} | Doble condición: un error de una sola variable no abre el modo. Opt-in visible en `.env`. | Hay que añadir una línea al `.env` local y al de tests que dependan del modo. |
| B | Sólo `NODE_ENV` ∈ {`development`, `test`}, sin variable nueva | Cero fricción para dev actual. | Sigue abierto si alguien despliega con `NODE_ENV=development` o `test` (por ejemplo, un preview mal configurado). |
| C | Sólo la variable explícita, sin mirar `NODE_ENV` (salvo `production`) | Simple de explicar. | `staging` con la variable puesta por error vuelve a abrir el hueco. |

El owner eligió A por la doble condición: un error en una sola variable no
abre el modo.
