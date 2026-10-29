# F1B — Revisión preventiva de seguridad/compatibilidad del principal PERSONAL

**Fecha:** 2026-10-24 · **Estado:** lectura de código de `main`, propuesta documental, NO EXPLOIT TEST / NO IMPLEMENTACIÓN  
**Programa:** `labor.personal-continuity` / ADR-WPI-002 en PR #1037

## Alcance de evidencia

Código consultado sobre la rama predeterminada:
- `apps/api/src/app.module.ts` — global guards `ThrottlerGuard → AuthGuard → RbacGuard`.
- `apps/api/src/common/auth.guard.ts` — para endpoints no públicos asigna `req.authContext = authService.authenticateRequest(req)`.
- `apps/api/src/common/rbac.guard.ts` — si no hay `@RequirePermissions`, una ruta con `@AuthenticatedAccess` pasa la verificación de *permisos*; presume que `AuthGuard` ya autenticó.
- `apps/api/src/common/request-context.ts` — devuelve `req.authContext` si existe; el tipo actual supone `tenantId/orgId/roles`. Verificación de roles y tenant no debe inferirse solo por el nombre de la ruta.
- `apps/api/src/modules/auth/auth.service.ts` — `authenticateRequest` requiere sesión, tenant/org y Membership activa; login deniega si no hay ninguna ACTIVE; no emite un principal personal.
- `apps/api/src/modules/auth/auth.repository.ts` — `findActiveSessionAuthorization` evalúa Membership de `session.orgId`.
- `apps/web/lib/auth.ts` — cookie firmada de sesión web contiene `RequestIdentity` con roles.
- `apps/web/middleware.ts` — determina rutas y dashboards por `roleFromRoles(session.roles)`; sin tipo de principal PERSONAL reconocido.
- `apps/api/src/infrastructure/sse/sse.controller.ts` — canales SSE organizacionales derivan tenant del request autenticado; introducir un principal personal sin tenant obliga a rechazarlos expresamente.
- `packages/db/prisma/schema.prisma` — `AuthSession.tenantId/orgId` obligatorios; `TimeEntry/FreeProject` dependen de `Tenant` y su `onDelete: Cascade`.

El hecho de que se requiera un guard PERSONAL **no prueba** que el código actual acepte de forma insegura ese principal: **hoy no existe el token PERSONAL propuesto**. Se trata de *riesgos de regresión* para una implementación futura.

## Hallazgos de compatibilidad (bloqueos de F1B)

| ID | Fuente | Requisito antes de implementación |
|---|---|---|
| F1B-AUTH-01 | `auth.guard.ts` | Crear discriminante de sesión y comprobarlo en cada ruta; una autenticación PERSONAL no implica permisos empresariales |
| F1B-AUTH-02 | `rbac.guard.ts`, rama `AuthenticatedAccess` | Asegurar que rutas ORG con `AuthenticatedAccess` rechacen PERSONAL aunque tengan auth válida; las rutas PERSONALES requieren su propia marca/policy explícita |
| F1B-AUTH-03 | `request-context.ts`, `RequestContext` | Evitar asignar `tenantId/orgId` falsos/sintéticos a un principal PERSONAL; no romper actuales consumidores organizacionales |
| F1B-AUTH-04 | `AuthService.authorizedRoles`, `findActiveSessionAuthorization` | PERSONAL debe poder revalidar `User` y sesión sin Membership, preservando revocación/logout, **sin** modificar comportamiento ORG |
| F1B-AUTH-05 | `middleware.ts`, `lib/auth.ts` | Cookie PERSONAL no se debe clasificar como `worker/client/admin` por array vacío de roles; proteger prefijos `/worker|/client|/admin|/agents|/jobs|/workspace` |
| F1B-AUTH-06 | `sse.controller.ts` | PERSONAL jamás se suscribe a streams de otra Org/tenant; token en URL/cabeceras no sustituye ResourceScope |
| F1B-AUTH-07 | BFF/Worker/Prometeo | No aceptar un token PERSONAL firmado por SEMSE (formato propio, no JWT) como `OrgActor` ni transferir roles de Org previa vía cabeceras, caché o tools |
| F1B-AUTH-08 | `AuthSession`/DB | Migración de discriminante compatible; revisar versión de token, algoritmos de cookies y tokens, logout de sesiones antiguas; rollback sin sesión huérfana |
| F1B-AUTH-09 | `Tenant` cascade | Retención: una copia personal permitida no puede depender de FK con borrado en cascada del tenant de origen, con derechos de terceros respetados |
| F1B-AUTH-10 | Rate limit y step-up | Exportación masiva sólo con revalidación fuerte; no reabrir enumeración de archivos o usuarios al quedarse sin Org |

## Matriz mínima de pruebas negativas — staging sintético

| Caso | Principal | Endpoint | Esperado |
|---|---|---|---|
| Sin Membership ACTIVE, User activo | PERSONAL | `/me/personal-records` (futuro) | Sólo propios según policy aprobada |
| Sin Membership ACTIVE, User activo | PERSONAL | `/v1/labor/entries` existente | Denegado, no lectura cross-tenant |
| Personal de A | PERSONAL | ruta `@AuthenticatedAccess` organizacional | Denegado, no acceso sólo por autenticación |
| Personal de A | PERSONAL | `/v1/sse/*`, `/v1/jobs`, `/v1/payments`, `/v1/evidence` | Denegado antes de resolver tenant |
| Personal de A | PERSONAL | cookie web /admin, /worker, /client, /agents | Sin redirect privilegiado ni rol inventado |
| A en Org X activo | ORG X | recurso X autorizado | Sin regresión, scope de X |
| A en Org X revocado | ORG X | recurso X | 401/403 según contrato vigente |
| A luego miembro en Org Y | ORG Y | archivo A custodiado fuera de X | Acceso sólo mediante policy PERSONAL, no herencia de Y |
| B en mismo tenant que A | PERSONAL B | archivo A | 404/403 neutro |
| User global suspendido | PERSONAL | archivo propio | Sesión revocada/fail closed |
| Sesión PERSONAL robada | PERSONAL | exportación masiva | Requiere step-up/recovery y limita alcance |
| Origin tenant eliminado en test | PERSONAL | recibo previamente confirmado | Persistencia permitida + `source_unavailable`; original no supuestamente recuperable |

## Decisiones requeridas

1. Distinguir anotación `@AuthenticatedPersonalAccess` (o mecanismo equivalente) de `@AuthenticatedAccess` de Org. **Nombre/contrato propuestos, no código aprobado**.
2. Definir esquema de sesión personal compatible con sesiones org sin volver opcionales `tenantId/orgId` globalmente de manera peligrosa.
3. Definir política de custodia por clasificación legal y datos permitidos, incluyendo auditores y derechos de borrado.
4. Diseñar pruebas negativas primero y validar en ambiente sintético con cookies reales, bearer tokens reales, SSE, BFF, Worker y Prometeo.
5. Registrar revisión independiente antes de comenzar código, **CI al final** y despliegue/activación por autorización separada.

**NO se han explotado fallas, no hay cambio de auth ni datos productivos en este informe.**

## Revisión cruzada detallada G0 — hallazgos concretos y contrato propuesto

**Hallazgos corroborados en `main` (no equivalen a incidentes explotados):**

| ID | Severidad de un cambio mal implementado | Evidencia exacta | Decisión de implementación requerida |
|---|---|---|---|
| SEC-G0-01 | **P0** | `apps/api/src/common/rbac.guard.ts`: rama `AUTHENTICATED_ACCESS_KEY` devuelve `true` tras autenticación, sin comprobar clase de principal | Mantener `@AuthenticatedAccess` existente como **ORG-only por defecto**, salvo auditoría endpoint a endpoint; añadir política PERSONAL explícita y fail-closed para todos los demás |
| SEC-G0-02 | **P0** | `packages/auth/src/rbac.ts`: `appRoleFromRoles([])` devuelve `client`; `apps/web/middleware.ts` clasifica por `roleFromRoles(session.roles)` | Un token/cookie PERSONAL nunca debe interpretarse como CLIENT ni entrar al dashboard/menú organizacional; comprobar clase de sesión ANTES de resolver rol |
| SEC-G0-03 | **P0** | `apps/api/src/common/request-context.ts`: `RequestContext = RequestIdentity`, con `tenantId/orgId/roles` obligatorios; `resolveRequestContext` usa `req.authContext` o verifica bearer/header en dev | Separar API de extracción: `requireOrgActor(request)` y `requirePersonalPrincipal(request)` o equivalentes; no usar IDs de tenant ficticios, valores null no tipados o fallback por headers para crear autoridad |
| SEC-G0-04 | **P0** | `apps/api/src/modules/auth/auth.service.ts`: `authorizedRoles` exige membresía actual; `AuthSession` tiene tenant/org obligatorios; `apps/api/src/modules/auth/auth.repository.ts` busca sólo membresía ACTIVE | Sesión PERSONAL necesita ciclo de vida, refresh, logout y revocación propios, verificando User activo y sesión durable sin depender de Membership; token `ORG` antiguo sin discriminante se trata como ORG solamente |
| SEC-G0-05 | **P1** | `apps/web/lib/semse-api-auth.ts`: `sanitizeSemseIdentityHeaders` reenvía `userId/tenantId/orgId/roles`; la API debe revalidar el token HMAC de acceso propio de SEMSE y su sesión durable, nunca confiar solo en cabeceras | Bloquear construcción de headers organizacionales desde sesión PERSONAL; revisar BFF, middleware, páginas y descargas por ruta, y no atribuir autoridad al header reenviado |
| SEC-G0-06 | **P0** | `apps/api/src/infrastructure/sse/sse.controller.ts` resuelve tenant verificado para planes/delegaciones y no admite contexto sin tenant | Rechazar PERSONAL en todos los SSE/WS de Org, incluidos canales abiertos previamente; pruebas de suscripción, revocación y notificaciones |
| SEC-G0-07 | **P0** | `apps/api/src/modules/labor-engine/labor-engine.controller.ts`: `GET /entries` tiene `@RequirePermissions("field-ops:read")` y filtra por tenant + creador | Sesión PERSONAL **no** reutiliza ese endpoint para leer retrospectivamente todos los tenants; solo consulta archivo derivado elegible con `ownerUserId` y policy |
| SEC-G0-08 | **P0 condicionado** | Prisma `TimeEntry.tenantId` y `FreeProject.tenantId` referencian `Tenant` con `onDelete: Cascade` | Ensayar borrado de tenant sólo en base sintética autorizada; confirmar retención y copia permitida antes del borrado real. NO se ha observado borrado productivo |

**Propuesta de contrato de autenticación (a aprobar por Identity/Security, NO código):**

1. `principalKind = ORG | PERSONAL` en sesión durable y en el token firmado, unido a un `audience` adecuado. Falta de discriminante en sesión legada se interpreta como `ORG` *únicamente* cuando su sesión de Org y Membership continúan verificándose. Valores desconocidos: 401, sin fallback.
2. `AuthGuard` valida criptografía, expiración, `sid`, clase y persistencia de sesión. El siguiente guard exige política por clase: por defecto sólo ORG en rutas existentes; PERSONAL exclusivamente en rutas marcadas expresamente para acceso individual.
3. El decorador `@AuthenticatedAccess` sigue restringido a ORG, salvo migración individual revisada y probada. Crear una policy de acceso personal `@AuthenticatedPersonalAccess` (nombre provisional) con `User.id` confirmado y `ownerUserId` *server-side*; nunca delegar esta distinción a `roles: []`.
4. `resolveRequestContext` debe mantener contratos para controladores ORG; el principal PERSONAL no se convierte a `RequestIdentity` con un tenant u Org sintéticos. Ningún header `x-semse-*` recibido de usuario crea un principal de mayor alcance.
5. Renovación/revocación tienen el mismo estándar o superior al de sesiones de Org; sin modo test/legacy capaz de producir principal PERSONAL en producción.
6. Cualquier exportación self exige policy de datos, corte y campo elegible. **La autoría `createdBy` no implica automáticamente derecho de conservar datos de obra o salarios**, ni permiso para consultar recursos corporativos tras revocación.

**Matriz de aceptación adicional (todas pendientes de prueba):**

- PERSONAL con `roles=[]` + cookie HMAC válida → UI de cuenta personal, **NO** dashboard `client`; rutas admin/worker/client/jobs/agentes denegadas.
- PERSONAL con token HMAC válido y sesión durable → `@AuthenticatedAccess` de Users/Auth empresariales no abre datos organizacionales; `@RequirePermissions` no reconoce permisos.
- ORG con sesión vieja sin `principalKind` y Membership ACTIVE → compatibilidad en rutas ORG; ORG revocada → denegación.
- PERSONAL con `tenantId` o `orgId` forjado en cookie, header, query o bearer → ignorar/rechazar; sin cruzar tenancy.
- ORG X activo y ORG Y suspendido para mismo User → los roles no se suman y ninguna request Y cruza a X.
- Sesión PERSONAL comprometida → export masivo con reautenticación fuerte y controles de revocación/uso; nunca abrir `personal_private` desde cuentas de terceros.
- Inicio de sesión sin Membership → sólo acceso personal, no se usa un rol ficticio CLIENT/PRO/WORKER.
- En fallo de DB/Auth → fail-closed sin reusar claims/cache ni degradación silenciosa.

**Alcance de esta revisión:** estática, preventiva, sin acceso a cuentas productivas ni ejecutar scripts de seguridad, tests o CI. Se exige revisión independiente antes de promover ADR/SDD a APPROVED.
