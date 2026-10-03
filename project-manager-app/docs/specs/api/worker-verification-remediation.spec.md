---
id: "api.worker-verification-remediation"
title: "Verificación de profesionales y cola de solicitudes"
domain: "trust"
version: "1.1"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/worker-verification/worker-verification.controller.ts
  - apps/api/src/modules/worker-verification/worker-verification.service.ts
  - apps/api/src/modules/worker-verification/worker-verification.repository.ts
  - apps/api/src/modules/worker-verification/worker-application.controller.ts
  - apps/web/app/(app)/worker/profile/page.tsx
  - apps/web/app/(app)/admin/trust/worker-applications/page.tsx
related_tests:
  - apps/api/test/worker-verification.controller.test.ts
  - apps/api/test/worker-application.service.test.ts
related_endpoints:
  - v1/workers
related_events: []
related_agents: []
last_verified: "2026-10-03"
---

# Spec: Verificación de profesionales y cola de solicitudes

## 1. Estado y alcance

Cubre `0.9`, `2.28` y `3.13`.

Permanece en `REVIEW`: el contrato de acceso y tenant es obligatorio, pero el
mecanismo probatorio definitivo de identidad todavía requiere una decisión del
owner (proveedor KYC/DID, evidencias aceptadas y retención).

## 2. Invariantes ya decididas

- Una string no vacía nunca constituye verificación criptográfica.
- `PRO` solicita verificación; no ejecuta el acto administrativo de verificarse.
- `OPS_ADMIN` revisa una solicitud tenant-scoped y debe ver la evidencia que
  sustenta su decisión.
- Listas, stats e historial siempre filtran por tenant y rol profesional.
- Aprobar/rechazar registra actor, motivo, evidencia y timestamps.
- La UI del profesional no llama al endpoint administrativo `users:verify`.
- Ningún estado `VERIFIED` se concede mientras el mecanismo configurado esté en
  modo sintético o stub.

## 2b. Estado verificado en `main` (2026-10-03)

El flujo de solicitud y revisión **ya existe**, implementado como feature
(hallazgo `2.28`). La spec original lo describía como propuesta; esto es lo que
el código hace hoy.

| Pieza | Estado real |
|---|---|
| Solicitud | `POST /v1/users/:userId/verify-request`, permiso `users:verify:request`. Permitida al propio usuario o a `OPS_ADMIN` (`canRequestVerification`). Crea un registro pendiente; **no** marca al usuario como verificado. |
| Dónde se guarda | Como registro de decisión en la memoria de workspace (`worker:<id>:verification`), no en una tabla propia. |
| Cola administrativa | `GET /v1/users/verify-requests`, permiso `users:verify`, consulta limitada al tenant del actor. |
| Revisión | `POST /v1/users/:userId/verify-request/:verificationType/review`, permiso `users:verify`. Registra revisor, nota y fechas. Aprobar ejecuta `verifyUser`; rechazar solo cierra la solicitud. |
| Atestación firmada | Para `id_document`, aprobar firma y persiste una atestación **antes** de registrar la decisión o marcar al usuario como verificado, de modo que un fallo de firma no deje una aprobación sin respaldo (ver `core.identity-attestation`). |
| UI del profesional | `/worker/profile` llama a `/api/semse/users/:id/verify-request`; ya no llama al endpoint administrativo `/verify`. |
| Verificación directa | `POST /v1/users/:userId/verify` (`users:verify`) sigue existiendo para `OPS_ADMIN`. |

Brechas frente a las invariantes de la sección 2:

- **Evidencia:** la solicitud no incluye evidencia ni la revisión la exige o la
  muestra al revisor.
- **Solo `id_document` genera atestación firmada.** `email`, `phone` y
  `background_check` siguen siendo verificaciones de bandera simple.
- **No verificado en esta pasada:** que el estado `REJECTED` permita una nueva
  solicitud con evidencia nueva.

### Módulo `worker-verification` (cola de Trust y firma DID)

Existe un segundo sistema, independiente del anterior, en
`apps/api/src/modules/worker-verification` (`/v1/workers/...`), que respalda la
vista de Trust de admin:

| Invariante | Estado real |
|---|---|
| Listas, stats e historial filtran por tenant | Cumple: el trabajador se resuelve por membresía en el tenant del actor y `listUnverifiedWorkers` y `getVerificationStats` filtran por tenant y por rol `PRO`/`WORKER`. |
| Solo el propio profesional u `OPS_ADMIN` atesta | Cumple: `initiateVerification` y `submitDidSignature` rechazan con 403 a cualquier otro actor. |
| Una string no vacía no es verificación criptográfica | Cumple: `verifyDidSignature` **falla cerrado** (no hay criptografía DID real) y registra una advertencia; `verified` solo se alcanza si esa verificación devuelve verdadero, lo que hoy nunca ocurre. |
| Transiciones atómicas y con evento | Cumple: `unverified → pending → verified` con guarda del estado de origen. |

Consecuencia: por la vía DID nadie llega a `VERIFIED` hasta que se implemente la
criptografía real; la vía operativa hoy es la revisión de `OPS_ADMIN` del
sistema de `users` descrito arriba. Que la UI de Trust y la del perfil usen
sistemas distintos es una divergencia por resolver junto con las decisiones de
la sección 5.

## 3. FSM propuesta

```text
NOT_REQUESTED -> PENDING_REVIEW
  actor: PRO
  guard: perfil propio + evidencia mínima configurada

PENDING_REVIEW -> VERIFIED
  actor: OPS_ADMIN
  guard: verificación real del proveedor + evidencia visible

PENDING_REVIEW -> REJECTED
  actor: OPS_ADMIN
  guard: motivo obligatorio

REJECTED -> PENDING_REVIEW
  actor: PRO
  guard: nueva evidencia
```

## 4. Contratos requeridos

### Solicitud del profesional

`POST /v1/workers/:workerId/verification-requests` o endpoint equivalente:

- Solo el propio profesional.
- Crea/actualiza una solicitud, no marca al usuario como verificado.
- Devuelve estado y próximos pasos.

### Revisión administrativa

- Lecturas/escrituras requieren `worker:read`/`worker:write` o permisos
  equivalentes OPS-only.
- La query se limita al tenant del actor.
- Decisión con confirmación y audit.

## 5. Decisiones bloqueantes

- Proveedor y método: DID real, KYC externo o revisión documental.
- Evidencia mínima por tipo (identidad, antecedentes, teléfono).
- Retención, cifrado y acceso a PII.
- Estrategia de migración para registros aceptados por el stub histórico.

## 6. Tests requeridos

- PRO puede solicitar revisión de su propio perfil sin 403.
- PRO no puede aprobar/verificar usuarios.
- OPS_ADMIN no ve solicitudes de otro tenant.
- El stub nunca produce `VERIFIED`.
- Aprobar exige evidencia real y deja audit.
- Stats cuentan solo profesionales del tenant.

## 7. Gate de aprobación

Cambiar a `APPROVED` solo cuando el owner documente las cuatro decisiones
bloqueantes. Hasta entonces se permiten fixes de scoping/deny-by-default, pero
no implementar una nueva ceremonia de identidad.
