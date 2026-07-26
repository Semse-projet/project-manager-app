---
id: "core.account-center"
title: "Centro de cuenta y seguridad de usuario"
type: spec
feature: "account-center"
domain: "core"
version: "1.0"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
branch: "codex/semse-account-center"
date: "2026-07-25"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/modules/auth/auth.repository.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/web/app/(app)/admin/account/page.tsx
  - apps/web/app/(app)/client/account/page.tsx
  - apps/web/app/(app)/worker/account/page.tsx
  - apps/web/app/api/semse/auth/password-change/route.ts
  - apps/web/app/components/account/AccountCenter.tsx
  - apps/web/app/semse-api.ts
  - packages/schemas/src/api-input.schema.ts
related_tests:
  - apps/api/test/auth-password-change.service.test.ts
  - tests/unit/account-center-contract.test.ts
related_endpoints:
  - POST /v1/auth/password-change
  - POST /api/semse/auth/password-change
  - GET /v1/users/me
  - GET /v1/users/me/profile
  - PATCH /v1/users/me/profile
related_events:
  - user.password_changed
related_agents: []
last_verified: "2026-07-25"
---

# Spec: centro de cuenta y seguridad de usuario

## 1. Qué resuelve

**Para quién:** cualquier usuario autenticado de SEMSE (`CLIENT`, `PRO`,
`OPS_ADMIN`).

**Problema:** el usuario puede editar partes de su perfil y recuperar una
contraseña olvidada, pero no existe una superficie común donde consultar su
identidad, editar datos personales y cambiar su contraseña sin salir de la
sesión.

**Solución:** un centro de cuenta compartido, integrado en los tres portales,
que concentra identidad, perfil, preferencias y seguridad. El cambio de
contraseña exige la contraseña vigente y revoca las demás sesiones renovables.

## 2. Actores y permisos

| Actor | Puede hacer | No puede hacer |
|---|---|---|
| `CLIENT` | Ver y editar su perfil; cambiar su contraseña | Cambiar datos o credenciales de otra persona |
| `PRO` | Ver y editar su perfil; cambiar su contraseña | Cambiar datos o credenciales de otra persona |
| `OPS_ADMIN` | Ver y editar su propia cuenta; cambiar su contraseña | Cambiar una contraseña ajena desde esta superficie |
| `PLATFORM` | Validar identidad, persistir hash y auditar el cambio | Registrar o devolver contraseñas en claro |

La autorización es por identidad autenticada, no por rol administrativo. El
`userId` se toma exclusivamente del contexto firmado de la sesión.

## 3. Escenarios de usuario

### P1 — Cambiar la contraseña dentro de la sesión

```
DADO    un usuario autenticado con contraseña vigente
CUANDO  envía la contraseña vigente y una nueva contraseña válida
ENTONCES SEMSE verifica la credencial vigente, guarda un hash scrypt nuevo
  Y     revoca todas las sesiones renovables distintas de la actual
  Y     registra user.password_changed sin incluir secretos
```

Casos borde:

- La contraseña nueva debe ser distinta de la vigente.
- La contraseña nueva debe tener entre 15 y 128 caracteres.
- La confirmación se valida en la interfaz antes de llamar al API.
- El usuario permanece en la sesión web actual para recibir confirmación.
- Los access tokens ya emitidos de otras sesiones conservan como máximo su TTL;
  sus refresh tokens quedan revocados.

Errores esperados:

- `400` para forma inválida o contraseña nueva igual a la vigente.
- `401` si falta sesión o la contraseña vigente no coincide.
- `429` cuando se excede el límite de intentos.

### P1 — Gestionar identidad y perfil

```
DADO    un usuario autenticado de cualquier rol
CUANDO  abre su ruta de cuenta y guarda nombre, biografía o ubicación
ENTONCES SEMSE lee y actualiza exclusivamente su User/UserProfile
  Y     conserva el contrato de auditoría user.profile.update existente
```

### P2 — Consultar controles de sesión

```
DADO    un usuario dentro del centro de cuenta
CUANDO  revisa seguridad
ENTONCES ve el alcance del cambio de contraseña y puede cerrar la sesión actual
```

## 4. FSM

No se introduce una entidad con ciclo de vida nuevo. La contraseña es una
credencial de `User`; las sesiones secundarias pasan de `ACTIVE` a `REVOKED`
usando el estado existente de `AuthSession`.

## 5. Contrato de API

### `POST /v1/auth/password-change`

```yaml
método: POST
ruta: /v1/auth/password-change
descripción: Cambia la contraseña del usuario autenticado.
auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
privacyCritical: true
input:
  schema: authPasswordChangeSchema
  campos:
    - nombre: currentPassword
      tipo: string
      requerido: true
      validación: 1..128 caracteres
    - nombre: newPassword
      tipo: string
      requerido: true
      validación: 15..128 caracteres
output:
  schema: inline
  campos:
    - nombre: status
      tipo: enum(updated)
    - nombre: userId
      tipo: string
    - nombre: revokedOtherSessions
      tipo: number
errores:
  400: contraseña nueva igual a la vigente o body inválido
  401: sesión ausente/inválida o contraseña vigente incorrecta
  429: demasiados intentos
efectos:
  auditLog: true
  evento: user.password_changed
  sse: false
  notificacion: ninguna en v1
  fsmTransicion: AuthSession ACTIVE -> REVOKED para sesiones secundarias
  paymentGovernance: false
```

### `POST /api/semse/auth/password-change`

BFF privado por defecto. Reenvía el body al endpoint canónico usando identidad
obtenida de la cookie firmada y nunca acepta encabezados de identidad del
navegador como autoridad.

## 6. Política de contraseña

- Longitud de 15 a 128 caracteres para credenciales nuevas.
- Sin reglas de composición obligatorias; se permiten frases y espacios.
- La contraseña se almacena con el helper scrypt versionado existente.
- No hay cambio periódico forzado.
- No se incluyen valores, longitud, prefijos ni derivados de las contraseñas en
  logs, eventos o respuestas.
- El formulario admite pegado y autocompletado de gestores de contraseñas.

## 7. Criterios de éxito

| Métrica | Objetivo |
|---|---|
| Roles con acceso al centro | 3/3 |
| Escenarios P1 cubiertos | 100% |
| Secretos en logs/audit/respuesta | 0 |
| Sesiones secundarias renovables revocadas | 100% |
| API y web build | pass |

## 8. Tests requeridos antes de implementar

- [x] Contraseña vigente correcta actualiza el hash.
- [x] Contraseña vigente incorrecta devuelve `UnauthorizedException`.
- [x] Contraseña nueva igual a la vigente devuelve `BadRequestException`.
- [x] Se preserva la sesión actual y se revocan las demás.
- [x] Audit usa `user.password_changed` y no contiene secretos.
- [x] El schema exige 15..128 caracteres para contraseñas nuevas.
- [x] El BFF de cambio de contraseña es privado y reenvía a la ruta canónica.
- [x] Los tres portales exponen el centro de cuenta compartido.

## 9. Impacto en otros dominios

| Dominio | Impacto | Acción |
|---|---|---|
| SEMSE Core/Auth | Sí | Endpoint, persistencia y audit |
| Web BFF | Sí | Proxy autenticado privado |
| User Profile | Reutiliza | Mantener contratos existentes |
| Payments/Escrow | No | Ninguna |
| Prometeo/RAG | No | Nunca enviar contraseñas a modelos |
| SSE/Comms | No | Fuera de alcance v1 |

## 10. Supuestos, dependencias y límites

- `User.passwordHash` y `AuthSession` son la fuente canónica existente.
- El BFF ya aplica política privada por defecto a `/api/semse/*`.
- El cambio de correo y MFA quedan fuera de v1: ambos requieren verificación y
  recuperación específicas.
- La revocación inmediata de access tokens ajenos requiere que
  `authenticateRequest` vuelva a consultar o cachee el estado de sesión. En v1
  se revocan refresh tokens y el riesgo residual queda acotado al TTL del access
  token emitido.

## 11. Referencias de seguridad

- NIST SP 800-63B: longitud mínima de 15 para contraseña de un solo factor,
  máximo permitido de al menos 64 y sin reglas de composición.
- OWASP Authentication/Session Management: reautenticar para cambios sensibles
  e invalidar sesiones tras eventos de riesgo.
- Next.js 15 Data Security: validar toda entrada y tratar Route Handlers como
  endpoints públicos sujetos a autorización.

## Checklist de aprobación

- [x] Escenarios P1 tienen criterio Given/When/Then.
- [x] Endpoint tiene input, output, errores y efectos.
- [x] No se viola una FSM ni una invariante de pagos.
- [x] Tests previos a implementación están enumerados.
- [x] Riesgo residual de access token está documentado.
- [x] Status `VERIFIED`.
