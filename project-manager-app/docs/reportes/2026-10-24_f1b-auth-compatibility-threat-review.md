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
| F1B-AUTH-07 | BFF/Worker/Prometeo | No aceptar un JWT PERSONAL como `OrgActor` ni transferir roles de Org previa vía cabeceras, caché o tools |
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
