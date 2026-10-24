# F1B G0 — Contrato de compatibilidad de sesiones, matriz TDD y decisión por responsables

- **Fecha:** 2026-10-24
- **Estado:** Proposed / DRAFT / documentación únicamente
- **Referencias:** ADR-WPI-002; `labor.personal-continuity`; PR #1037 (hijo de #1035 programa y #1036 F1A)
- **Objetivo:** permitir sesión personal restringida sin degradar permisos y sesiones empresariales; preservar historia personal **permitida** sin crear un segundo motor de horas
- **CI:** NOT_RUN · **Tests F1B:** NOT_WRITTEN / NOT_RUN · **Código:** NOT_STARTED

## 1. Corrección del contrato real de autenticación

La fuente de verdad `apps/api/src/common/auth-token.ts` declara expresamente que **el bearer actual NO es JWT estándar**. Tiene **dos segmentos**: `base64url(JSON claims).base64url(HMAC-SHA256(encodedPayload, AUTH_SECRET))`. El tipo `TokenClaims` actual exige `userId, tenantId, orgId, roles, jti, iat, exp`, admite `sid` y `typ: "access"`. `verifyToken` valida firma, formato, campos básicos, `typ` y expiración; NO implementa `principalKind`, `audience` ni un token personal sin tenant/org.

La cookie web `apps/web/lib/auth.ts` también tiene dos segmentos y HMAC, pero usa `SEMSE_WEB_SESSION_SECRET` (o fallback `AUTH_SECRET`) y tipo `SessionPayload = RequestIdentity + exp`. No equivale automáticamente al bearer API ni a autorización durable de `AuthSession`; `decodeSession` valida firma, vencimiento y restricciones de demo. Una sesión web *personal* no podrá considerarse suficiente para descargar históricos sin validación de sesión/autenticación backend.

`AuthSession` de Prisma exige `tenantId` y `orgId`; `findActiveSessionAuthorization` verifica Membership ACTIVE de esa Org; `AuthService.authorizedRoles` rechaza si roles efectivos vacíos. `AuthService.loginWithPassword` no autentica sesión sin Membership. El registro actual crea Org propia para `CLIENT`/`PRO`, lo que permite trabajar sin patrón inscrito, pero no garantiza funcionar sin ninguna Org.

**Cuidado con nombre y tipo:** `typ: "access"` existente distingue tipo de token, NO clase de principal `ORG/PERSONAL`. Cualquier `principalKind`/`audience` será contrato NUEVO sujeto a validación explícita, versión de sesión y rechazo de valores desconocidos. No llamar JWT a las credenciales actuales en specs o tests.

## 2. Contrato de autoridad recomendado — NO APROBADO

```ts
// Tipos conceptuales, NO interfaz aprobada ni código listo para copiar.
type OrgPrincipal = {
  kind: "ORG";
  userId: string;
  sessionId: string;
  tenantId: string;
  orgId: string;
  effectiveRoles: string[]; // calculados desde Membership ACTIVE verificada
};
type PersonalPrincipal = {
  kind: "PERSONAL";
  userId: string;
  sessionId: string;
  authStrength: "normal" | "step_up"; // política pendiente
  // deliberadamente sin tenantId/orgId/roles empresariales
};
type VerifiedPrincipal = OrgPrincipal | PersonalPrincipal;
```

**Regla R1:** toda ruta existente de API/Workers/SSE/BFF es **ORG-only por defecto** cuando se introduzca PERSONAL, aun cuando use `@AuthenticatedAccess("reason")`; excepciones PERSONAL solo tras enumerarlas y revisarlas una por una. `@Public` conserva su propia revisión y no se usa para export.

**Regla R2:** `AuthGuard` valida la credencial HMAC, `sid` duradero, User activo, expiración y `kind` firmado/reconciliado con sesión persistida. `RbacGuard` deniega clase incorrecta antes de analizar `@AuthenticatedAccess` o `@RequirePermissions`. Falta de clase en token antiguo puede mapearse a `ORG` **solo si** la sesión se verifica contra Membership ACTIVE; `PERSONAL` sin discriminante se rechaza. Campo desconocido => 401 (no fallback).

**Regla R3:** no modelar sesión PERSONAL con `roles: []`, `tenantId` de nueva empresa o `orgId` ficticio para satisfacer `RequestIdentity`. `packages/auth/src/rbac.ts` hace que `appRoleFromRoles([])` devuelva `client`; `apps/web/middleware.ts` convierte ese valor en rutas; deberá comprobar `kind` antes de usar `appRoleFromRoles`. Los headers `x-semse-*` de BFF no son autoridad personal ni permiten crear OrgActor.

**Regla R4:** la sesión ORG mantiene compatibilidad, revocación inmediata por Membership y scope por recurso. PERSONAL sólo abre rutas `me/personal-*` nuevas, con `ownerUserId`, clasificación de dato, revocación y retención validables. No reutilizar `GET /v1/labor/entries` para consulta libre cross-tenant.

**Regla R5:** `TimeEntry` sigue siendo el registro canónico; un `PersonalRecordReceipt` es una proyección de lectura permitida, no otra hora oficial ni certificado. Elegibilidad de datos de empleado/cliente, conservación, consentimiento y destrucción de tenant requieren aprobación Legal/Privacy. No almacenar fotos/GPS/salarios de otros por default.

## 3. Secuencia de compatibilidad, sin inventar nuevos permisos

1. **G0 Identity+Security:** decidir si sesión personal comparte `AuthSession` mediante extensión aditiva/versionada o almacén autónomo con revocación equivalente. Evaluar compatibilidad real de cookies y validadores antes de elegir. Prohibido volver nulos `tenantId/orgId` en todo el dominio sin auditoría de consumidores.
2. **G1 Contrato + pruebas rojas:** tests de regresión para clases de principal, tokens SEMSE de dos partes, cookie web, guardas y BFF; primero sin ruta de lectura personal funcional. No habilitar tokens PERSONAL hasta que todos los endpoints corporativos rechacen su clase.
3. **G2 Auth personal restringido:** introducir clase y validación durable en un slice pequeño reversible y behind-flag OFF. Rutas personales con política nueva, sin alterar rol/capacidades de Org.
4. **G3 Custodia personal y API:** aplicar `recordClass` y `retentionClass`, cifrado, versionado, backfill autorizado, outbox idempotente, auditoría/retención. Integrar con F1A sin exportadores duplicados.
5. **G4 QA sintético:** A/B mismo tenant, C externo, sin Membership, revocado, User suspendido, cambio Org, cookie falsificada, token firmado con claim desconocido, TLS/cookie/headers, carreras de refresh, archivo derivado, data deletion.
6. **G5 Revisión Security/Privacy/Legal independiente y rollback:** resultados con responsable, SHA, evidencias, sin datos privados.
7. **G6 CI último:** validación SDD generada, tests dirigidos y regresión, typecheck/build/lint; merge, deploy y activación sólo por autorización posterior.

## 4. Matriz TDD concreta (a escribir en el PR funcional después de APPROVED)

| Caso | Archivo base existente | Entrada/fixture | Resultado esperado | Estado |
|---|---|---|---|---|
| T01 login sin Membership | `apps/api/test/auth-login-membership-status.service.test.ts` | User activo, memberships=[] | Tras F1B devuelve **solo sesión PERSONAL**; nunca ORG | pendiente (baseline actual: Unauthorized) |
| T02 Membership revocada y User activo | mismo | X REVOKED, Y ausente | ORG X denegada; PERSONAL limitada a su archivo | pendiente |
| T03 User suspendido | `apps/api/test/business-access-foundation.test.ts` | User status!=active | PERSONAL y ORG rechazadas | pendiente |
| T04 Token legado de dos partes | `apps/api/test/business-access-foundation.test.ts` | token HMAC antiguo con sid/Org, Membership vigente | Continúa funcionando exclusivamente como ORG | pendiente |
| T05 Claim desconocido/reemplazado | nuevo test `personal-principal-auth.test.ts` | kind desconocido, vacío o adulterado | 401, sin fallback por roles | pendiente |
| T06 Token PERSONAL sin org | mismo | `kind=PERSONAL`, sid durable propio | autenticación personal sin IDs sintéticos | pendiente |
| T07 Token PERSONAL frente a ruta `@AuthenticatedAccess` ORG | `apps/api/test/rbac-explicit-boundary.test.ts` | token PERSONAL válido | 403, no entra al handler | pendiente |
| T08 Personal con permiso declarado de Org | mismo | sesión PERSONAL + `@RequirePermissions('jobs:read')` | 403 aunque UI le atribuya roles | pendiente |
| T09 Metadata ausente | mismo | PERSONAL/ORG sin decorador | 403 deny_by_default | pendiente |
| T10 Cookie PERSONAL con roles=[] | `tests/unit/web-session.test.ts` + middleware test | cookie HMAC personal válida | nunca redirige a /client/dashboard ni abre /client | pendiente |
| T11 Cookie ORGANIZACIONAL legacy | mismo | sesión existente CLIENT/PRO/WORKER | sigue rutas actuales con scope/revalidación API | pendiente |
| T12 Cookie tampered/expirada | mismo | firma falsa, exp pasado | denegada sin privilegios ni cabeceras sensibles | pendiente |
| T13 BFF headers forjados | nuevo test BFF/middleware | `x-semse-roles:OPS_ADMIN`, PERSONAL | headers organizacionales descartados, backend revalida | pendiente |
| T14 SSE cross-tenant | `apps/api/test/sse-tenant-context.test.ts` | PERSONAL en plans/delegations/finance | rechazar acceso a canal, sin suscripción o datos | pendiente |
| T15 Reutilización de refresh | `apps/api/test/business-access-foundation.test.ts` | refresh en paralelo y logout | CAS/rotación falla cerrado, independiente de Org | pendiente |
| T16 DB de auth inalcanzable | mismo | timeout/error de repository | 503 fail closed, sin claims cache como fallback | pendiente |
| T17 TimeEntry empresarial original | nuevo test `personal-record-scope.test.ts` | A en Y, registro de X | PERSONAL NO consulta TimeEntry X; usa sólo recibo permitido | pendiente |
| T18 Archivo de B mismo tenant | mismo | A y B en mismo tenant | 403/404 neutro, ninguna fila B | pendiente |
| T19 Archivo con fotos o GPS | mismo | dataset con PII obra | campos prohibidos excluidos antes de cifrar/proyectar | pendiente |
| T20 Destrucción sintética tenant | integración PostgreSQL aislada | X con FK cascade + recibo permitido confirmado | recibo persiste según política; fuente marcada unavailable | pendiente |
| T21 Corrección + replay | test del proyector propuesto | source revision incrementa, evento duplicado | versión nueva/idempotencia, sin reemplazo oculto | pendiente |
| T22 Exportación completa | PR #1036 / S1 #933 | 1201 entradas, fechas empatadas, DST | ninguna pérdida/truncamiento; CSV seguro, estado offline explícito | pendiente |

**Lectura honesta del estado:** solo existe el conjunto de tests ORG legacy mencionado, sin ejecución en esta revisión. Los T01–T22 NO son tests creados, aprobados ni ejecutados. No afirmar PASS hasta verificar salida de test, SHA y entorno.

## 5. Decisiones que debe tomar cada autoridad

| Decisión | Recomendación acotada | Bloquea | Aprueba |
|---|---|---|---|
| D-AUTH-01 | Principal `PERSONAL/ORG` discriminado y sesiones persistidas verificables. Conservar formato HMAC de dos partes hasta ADR de cambio de autenticación | Todas las rutas personales | Identity/Auth + Security |
| D-AUTH-02 | `@AuthenticatedAccess` sólo ORG por defecto al introducir PERSONAL; rutas self explícitas y mínimo privilegio | Merge de cambios a AuthGuard/RbacGuard | Security + API owner |
| D-WEB-03 | Middleware y BFF reconocen `kind` antes de roles; descargas requieren verificación backend actual | Vista de historial personal | Web/Auth |
| D-RECORD-04 | Elegibilidad restringida/retención legal; no copiar empresa, multimedia, localización ni salarios automáticamente | Captura de recibos o backfill | Legal/Privacy + Records |
| D-DB-05 | Proyección fuera de cascada Tenant y cifrado bajo política, no otro motor TimeEntry | Migración/retention | Database/Architecture |
| D-RELEASE-06 | Flags OFF, canary sintético y rollback antes de exponer datos reales | Deploy/activación | Owner + Security + Ops |

## 6. Dependencias y reconciliación documental

- #1035 F0 define programa, **DRAFT**.
- #1036 F1A define exportación propia en tenant permitido, **DRAFT**.
- #1037 F1B define continuidad personal sin Membership, **DRAFT**.
- #933 contiene archivados, etiquetas históricas y paginación; #935 dueño de Time Tracker. Reutilizar su sistema, no duplicarlo.
- Las tres ramas parten de `main` y modifican `docs/SPEC_INDEX.md`: actualizar/reindexar secuencialmente cuando el owner autorice merge documental. Evitar resolver conflitos haciendo merge de código F1B.
- **Este informe no es un sign-off de revisión independiente**. La inspección del código es manual, y queda pendiente su verificación por responsables con pruebas y despliegue aislado.

## 7. Gate de aceptación G0

**NO-GO actualmente**, hasta que D-AUTH-01/D-AUTH-02/D-WEB-03/D-RECORD-04/D-DB-05 obtengan aprobación documentada y el plan de compatibilidad legacy no contradiga ADR-040 ni Business Access Foundation. No hay autorización para migraciones, pruebas contra datos reales, pagos, firmas, CI de implementación, merge o deploy.
