---
id: "api.auth-account-session-remediation"
title: "Auth, sesiones y recuperación de cuenta — remediación"
domain: "auth"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/web/app/api/semse/auth/login/route.ts
  - apps/web/app/api/semse/auth/forgot-password/route.ts
  - apps/web/app/api/semse/auth/reset-password/route.ts
related_tests:
  - apps/api/test/auth-token.test.ts
  - apps/api/test/auth-password.test.ts
related_endpoints:
  - v1/auth
related_events: []
related_agents: []
last_verified: "2026-07-23"
---

# Spec: Auth, sesiones y recuperación de cuenta

## 1. Alcance del plan

Este contrato gobierna `0.1`, `0.2`, `0.3` y `0.32` de
`docs/AUDIT_REMEDIATION_PLAN.md`.

No redefine el modelo de roles ni el contrato general del BFF; complementa
`api.bff-auth-boundary` con el lifecycle de credenciales y sesiones.

## 2. Invariantes

- Un request público nunca puede convertir headers `x-semse-*` enviados por el
  cliente en identidad autenticada.
- En producción, bootstrap falla cerrado si `SEMSE_BOOTSTRAP_TOKEN` no existe.
- Logout revoca la sesión o familia de refresh tokens utilizada.
- Cambiar el rol activo invalida el access token anterior; un token emitido
  para otro rol no conserva privilegios.
- Un reset de contraseña revoca sesiones anteriores del usuario.
- Un token de recuperación nunca se devuelve en el body ni se expone en logs
  productivos.
- Solicitar recuperación solo informa un resultado genérico para no enumerar
  cuentas.

## 3. Actores y permisos

| Actor | Puede | No puede |
|---|---|---|
| Público | login y solicitar recuperación | aportar identidad mediante headers |
| Usuario autenticado | logout y refrescar su sesión | cambiar a un rol que no posee |
| `OPS_ADMIN` | usar bootstrap cuando la configuración lo autoriza | omitir el token productivo |

## 4. Escenarios P1

### P1 — Revocación efectiva

```text
DADO un access/refresh token válido
CUANDO el usuario hace logout, cambia su rol activo o confirma un reset
ENTONCES la sesión anterior queda revocada
  Y el token anterior no autoriza requests posteriores
  Y la operación no amplía roles ni tenant
```

### P1 — Recuperación entregable y no enumerable

```text
DADO un email registrado o inexistente
CUANDO se solicita recuperar contraseña
ENTONCES ambos casos reciben una respuesta pública equivalente
  Y para la cuenta registrada se genera un token de un solo uso con expiración
  Y el token se entrega mediante el proveedor de comunicaciones configurado
  Y nunca se incluye un preview productivo en la respuesta
```

## 5. Contratos API

### `POST /v1/auth/logout`

- Auth requerida.
- Revoca la sesión/familia presentada.
- Idempotente: repetir logout no reactiva ni falla por una sesión ya revocada.
- `auditLog`: sí, sin copiar tokens.

### `POST /v1/auth/password-reset/request`

- Auth pública.
- Input: email normalizado.
- Output: aceptación genérica.
- Rate limit obligatorio.
- `privacyCritical`: true.

### `POST /v1/auth/password-reset/confirm`

- Auth pública mediante token de recuperación de un solo uso.
- Input: token + contraseña que cumple la policy.
- Revoca sesiones anteriores al confirmar.
- Replays y tokens expirados se rechazan.
- `privacyCritical`: true.

## 6. Tests requeridos

- Headers `x-semse-*` falsificados no crean sesión.
- Logout impide reutilizar el refresh token.
- Cambio de rol invalida el access token previo.
- Reset confirmado invalida sesiones anteriores.
- Request de reset no distingue email existente/inexistente.
- Producción sin bootstrap token falla cerrado.
- Producción nunca devuelve el token de reset en body/log.

## 7. Rollback

La revocación puede deshabilitarse solo mediante rollback del cambio completo;
no se permite un fallback productivo que vuelva a confiar en headers o exponga
tokens.
