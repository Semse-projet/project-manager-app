---
type: plan
feature: "account-center"
domain: "core"
spec: "docs/specs/core/account-center.spec.md"
version: "1.0"
status: "APPROVED"
branch: "codex/semse-account-center"
date: "2026-07-25"
---

# Plan técnico: centro de cuenta y seguridad

## 1. Resumen

Se amplía el módulo Auth existente con cambio de contraseña autenticado y
transaccional, se reutilizan los endpoints User/Profile y se crea un único
componente web montado en los portales de cliente, profesional y operaciones.

Complejidad: media. Riesgo principal: credenciales y revocación parcial de
access tokens ya emitidos.

## 2. Constitution check

- [x] Spec `core.account-center` aprobada antes de implementar.
- [x] No toca pagos ni escrow.
- [x] El cambio de credencial genera audit canónico.
- [x] Ningún secreto sale hacia un proveedor o modelo.
- [x] Los tests de contrato y servicio se escriben antes del código.

## 3. Stack afectado

```yaml
backend:
  framework: NestJS
  módulos: [auth]
  schemas: [api-input.schema.ts]
  prisma_cambios: no
frontend:
  framework: Next.js 15 App Router
  rutas:
    - /worker/account
    - /client/account
    - /admin/account
  componente: apps/web/app/components/account/AccountCenter.tsx
workers:
  bullmq_jobs: no
infraestructura:
  railway: no cambia
  variables_nuevas: []
```

## 4. Persistencia

Sin migración. La operación de repositorio usa una transacción para actualizar
`User.passwordHash` y revocar `AuthSession` activas cuyo id no sea el actual.

## 5. API y schema

- `authPasswordChangeSchema`: `currentPassword` 1..128 y `newPassword` 15..128.
- `AuthRepository.findUserCredentialById`.
- `AuthRepository.changePasswordAndRevokeOtherSessions`.
- `AuthService.changePassword`.
- `POST /v1/auth/password-change`, autenticado y limitado por tasa.

## 6. Web

- BFF privado `POST /api/semse/auth/password-change`.
- Helper tipado `changeMyPassword`.
- `AccountCenter` carga `users/me` y `users/me/profile`, permite editar perfil,
  cambiar contraseña y cerrar sesión.
- Wrappers livianos para los tres prefijos con RBAC ya aplicado por middleware.
- Entrada “Cuenta y seguridad” en cada navegación.

## 7. Eventos

Audit `user.password_changed`, entidad `User`, sin before/after con datos de
contraseña. El resultado solo incluye el número de sesiones secundarias
revocadas.

## 8. Fases

1. Especificación, plan, tareas y checklist.
2. Tests fallando del servicio y contrato web.
3. Schema, repositorio, servicio y controller.
4. BFF, helper, componente y navegación.
5. Build, tests, revisión React, spec index y reporte.

## 9. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Filtración de secretos | No incluir body en logs/audit; respuestas opacas |
| Enumeración o fuerza bruta | Endpoint autenticado + throttle |
| Sesión robada cambia contraseña | Exigir contraseña vigente |
| Access token secundario sigue vivo | Revocar refresh; documentar TTL residual |
| Duplicación entre roles | Un componente compartido, tres wrappers |

## Checklist

- [x] Spec aprobada.
- [x] Sin migración.
- [x] Archivos y contratos identificados.
- [x] Tests preceden implementación.
- [x] Riesgos de seguridad explícitos.
