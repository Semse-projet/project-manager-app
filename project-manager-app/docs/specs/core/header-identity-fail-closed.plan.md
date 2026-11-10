---
type: plan
feature: "Identidad por cabeceras sólo con opt-in explícito"
domain: "core"
spec: "docs/specs/core/header-identity-fail-closed.spec.md"
version: "2.0"
status: "APPROVED"
branch: "docs/core-header-identity-fail-closed"
date: "2026-11-04"
---

# Plan técnico: Identidad por cabeceras sólo con opt-in explícito

> Prerrequisito cumplido: spec `APPROVED` (opción A, owner, 2026-11-04). La
> aprobación cubre rama y PR en borrador, no merge, Railway ni deploy.

## 1. Snapshot de verdad

- `origin/main` SHA: `be748bb`
- SHA desplegado API/Web: no consultado. Este plan no toca Railway.
- Estado de servicios: no verificado en vivo.
- Estado de migraciones: no aplica (sin cambios de datos).
- Flags/allowlists: ninguno. Se añade la variable local
  `SEMSE_ALLOW_HEADER_IDENTITY`, que no se define en Railway.
- Drift o deuda previa:
  - `OperationalIntelligenceController` lee la identidad del objeto `req` (por
    código, 401 permanente).
  - Su test enmascara el problema.

## 2. Constitution check

- [x] Spec aprobado antes de código
- [x] Tenant/org/ownership y RBAC definidos: el tenant sale del contexto
  verificado (Art. VII)
- [x] Evidence/Payment Governance: no aplica
- [x] Audit/events: no hay cambio de estado de dominio, no hay evento nuevo
- [x] Tests preceden implementación (Fase A)
- [x] No se expone secreto ni se agrega backend paralelo
- [x] Código, CI, merge, deploy y activación se miden por separado

## 3. Arquitectura y autoridad

- **Fuente de verdad:** `apps/api/src/common/request-context.ts` exporta
  `headerIdentityAllowed(env = process.env): boolean`. Es la única función que
  decide.
- **Consumidores:**
  - `resolveRequestContext` (misma unidad).
  - `AuthService.authenticateRequest` (`auth.service.ts`).
- **Comportamiento sin `AUTH_SECRET`:** si `headerIdentityAllowed()` es falso,
  `ServiceUnavailableException("Authentication authority unavailable")`, igual
  que hoy en producción. Si es verdadero, `parseHeaderRequestContext(headers)`
  como hoy.
- **Operational Intelligence:** los 7 handlers pasan a
  `resolveRequestContext(req)`, que devuelve `req.authContext` fijado por
  `AuthGuard`.
- **Arranque:** `main.ts` registra `logger.warn("auth_header_identity_mode_enabled",
  { nodeEnv })` cuando `!AUTH_SECRET && headerIdentityAllowed()`. Sin
  identidades ni secretos.
- Contratos Zod / BFF / UI / Worker queues / agentes: sin cambios.
- ADR requerido: no. Extiende AC-12 de `core.business-access-foundation`.

## 4. Datos y migración

No aplica. No hay cambios en Prisma ni en SQL. El rollback es revertir el PR.

## 5. Seguridad y política

- Permisos: sin cambios (`@RequirePermissions` existentes).
- Tenant scope: OI pasa a usar el tenant verificado, lo que cierra el IDOR
  latente.
- Auditoría: log operativo de advertencia, no un evento.
- **Abuse cases cubiertos por tests:**
  - cabeceras `OPS_ADMIN` sin `AUTH_SECRET` en `staging`, `preview`,
    indefinido y `development` sin opt-in;
  - opt-in en `production`;
  - opt-in con valor inválido;
  - `NODE_ENV` con mayúsculas o espacios;
  - bearer válido del tenant A con `x-tenant-id` de B en OI.

## 6. Eventos, idempotencia y reconstrucción

No aplica.

## 7. Estrategia de implementación

### Fase A — Tests rojos

1. `apps/api/test/header-identity-policy.test.ts` (nuevo): matriz de
   `headerIdentityAllowed` más `resolveRequestContext` y `authenticateRequest`
   sin `AUTH_SECRET`.
2. `apps/api/test/operational-intelligence-http-tenant.test.ts` (nuevo): HTTP
   real con `AuthGuard` + `RbacGuard`, bearer del tenant A y cabecera de B. Se
   verifica el tenant que recibe el servicio en GET y PATCH.
3. `apps/api/test/operational-intelligence.controller.test.ts`: pasa a usar
   `req.authContext` y `req.headers`, no propiedades de primer nivel.
4. Guardia estática dentro de `header-identity-policy.test.ts`:
   `parseHeaderRequestContext` sólo aparece en `request-context.ts` y en
   `auth.service.ts`.
5. Ejecutar y confirmar que fallan contra `main` (demuestra el gap).

### Fase B — Dominio

- `headerIdentityAllowed` y su uso en `resolveRequestContext`.
- `authenticateRequest` usa la misma función.

### Fase C — API

- OI controller: 7 reemplazos y quitar el import de `parseHeaderRequestContext`.
- `main.ts`: log de arranque.

### Fase D — Verificación local/CI

- Tests dirigidos, suite unit de API e integración (con un Postgres
  desechable, como en #1091).
- Build de API y `pnpm typecheck` acotado a API.
- `pnpm spec:validate:strict` y `pnpm spec:index`.
- Mutación: quitar la condición de `NODE_ENV` o la de la variable hace fallar
  la matriz.

### Fase E — Integración

- Mismo PR #1092 (borrador). El owner decide el merge.

### Fase F — Producción

- Fuera de esta autorización. El smoke autenticado de OI requiere aprobación
  aparte.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Un dev local sin `AUTH_SECRET` deja de autenticar | Alta | Bajo | El mensaje y el log nombran `SEMSE_ALLOW_HEADER_IDENTITY`; `.env.example` y `docs/auth.md` actualizados | Quejas de dev; no afecta prod |
| Algún test dependía del modo por cabeceras sin `AUTH_SECRET` | Media | Bajo | Se corre la suite completa; se ajusta el test, no se relaja la regla | Suite roja |
| Producción sin `AUTH_SECRET` | Muy baja | Alto | Sin cambio: ya es 503 hoy (AC-12) | 503 masivos |
| OI empieza a responder 200 y expone datos | Baja | Medio | El tenant sale del contexto verificado; test HTTP cross-tenant | Señales de otro tenant en respuesta |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| Fail-closed ante mala configuración | OWASP ASVS v4.0.3 V1.4 | Aplicado: 503 por defecto |
| Misconfiguración que abre acceso | OWASP Top 10 2021 A05 | Opt-in doble (opción A) |
| Control de acceso en servidor | OWASP Top 10 2021 A01 | Tenant del contexto verificado en OI |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados
- [x] Migración y rollback definidos (no aplica / revertir PR)
- [x] Tests ordenados antes del código
- [x] Canary/feature flag: no aplica (sin cambio observable en prod con `AUTH_SECRET`)
- [x] Evidencia requerida por estado definida (§8 del spec)
- [x] Scope cabe en un PR reversible
