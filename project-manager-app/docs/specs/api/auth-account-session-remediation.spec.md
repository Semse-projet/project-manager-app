---
id: "api.auth-account-session-remediation"
title: "Auth, sesiones y recuperación de cuenta — remediación"
domain: "auth"
version: "1.1"
status: "VERIFIED"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/auth/auth.repository.ts
  - apps/api/src/infrastructure/email/email.service.ts
  - apps/web/middleware.ts
  - apps/web/lib/semse-api-auth.ts
  - apps/web/app/api/semse/auth/login/route.ts
  - apps/web/app/api/semse/auth/forgot-password/route.ts
  - apps/web/app/api/semse/auth/reset-password/route.ts
related_tests:
  - apps/api/test/auth-remediation.test.ts
  - apps/api/test/auth-token.test.ts
  - apps/api/test/auth-password.test.ts
  - tests/unit/web-bff-auth-policy.test.ts
related_endpoints:
  - POST /v1/auth/token
  - POST /v1/auth/logout
  - POST /v1/auth/refresh
  - POST /v1/auth/password-reset/request
  - POST /v1/auth/password-reset/confirm
related_events: []
related_agents: []
last_verified: "2026-07-23"
---

# Spec: Auth, sesiones y recuperación de cuenta

## 1. Alcance del plan

Este contrato gobierna `0.1`, `0.2` y `0.32` de
`docs/AUDIT_REMEDIATION_PLAN.md`.

No redefine el modelo de roles ni el contrato general del BFF; complementa
`api.bff-auth-boundary` con el lifecycle de credenciales y sesiones.

La revocación inmediata del access token (`0.3`) está excluida y gobernada por
`auth.session-revocation-architecture`, en estado `REVIEW`, porque el plan
registra una decisión explícita de no reintroducir el lookup síncrono a
Postgres en cada request.

## 2. Invariantes

- Un request público nunca puede convertir headers `x-semse-*` enviados por el
  cliente en identidad autenticada.
- En producción, bootstrap falla cerrado si `SEMSE_BOOTSTRAP_TOKEN` no existe.
- Logout revoca la sesión persistida y su refresh token.
- Un reset de contraseña revoca todas las sesiones persistidas del usuario.
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

### P1 — Revocación persistida

```text
DADO un refresh token válido
CUANDO el usuario hace logout o confirma un reset
ENTONCES la sesión persistida queda revocada
  Y el refresh token anterior no puede emitir otro access token
  Y la operación no amplía roles ni tenant
```

La ventana residual del access token ya emitido no se declara cerrada aquí;
ver `auth.session-revocation-architecture`.

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
- Revoca la sesión persistida y el refresh token presentado.
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

- El BFF elimina headers `x-semse-*` falsificados sin sesión y los sobrescribe
  desde una sesión firmada.
- Bootstrap productivo sin secreto o con secreto incorrecto falla cerrado.
- Logout revoca la sesión persistida y la búsqueda de refresh solo acepta
  sesiones activas no revocadas.
- Reset confirmado consume el token una sola vez y revoca sesiones persistidas.
- Request de reset no distingue email existente/inexistente.
- Producción nunca devuelve el token de reset en body/log.
- La contraseña mínima del BFF coincide con la policy API de 12 caracteres.

## 7. Evidencia

- Tests focalizados de auth y BFF enlazados en frontmatter.
- En producción, la respuesta de recuperación es idéntica serializada para
  email existente e inexistente.
- El token raw solo se entrega al proveedor de correo; se persiste su SHA-256.
- `RESEND_API_KEY` y `EMAIL_FROM` están documentados en las plantillas de
  entorno.

## 8. Rollback

Un rollback de este lote no puede restaurar confianza en headers, exponer
tokens de recuperación ni quitar la revocación persistida de refresh tokens.
