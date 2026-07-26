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
  - tests/unit/worker-profile-verification-mitigation.test.ts
related_endpoints:
  - v1/workers
related_events: []
related_agents: []
last_verified: "2026-07-25"
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

## 2.1 Mitigación activa v1.1

Mientras no exista el contrato aprobado de solicitud:

- `/worker/profile` no llama `POST /v1/users/:userId/verify`;
- no presenta "Solicitud enviada" ni un botón que inevitablemente devuelve 403;
- identidad, antecedentes y teléfono se muestran como próximos pasos no
  disponibles, con copy que desaconseja enviar documentos por canales alternos;
- el endpoint existente conserva `users:verify` y la policy OPS_ADMIN;
- no se concede a PRO el permiso administrativo ni se crea un registro
  sintético.

Esto cierra la capacidad engañosa y mantiene deny-by-default, pero no implementa
la cola KYC/DID final.

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

- [x] La UI PRO no llama al endpoint administrativo ni ofrece una solicitud falsa.
- [ ] PRO puede solicitar revisión de su propio perfil mediante el futuro contrato sin 403.
- [ ] PRO no puede aprobar/verificar usuarios.
- [ ] OPS_ADMIN no ve solicitudes de otro tenant.
- [x] El stub nunca produce `VERIFIED`.
- [ ] Aprobar exige evidencia real y deja audit.
- [x] Stats cuentan solo profesionales del tenant.

## 7. Gate de aprobación

Cambiar a `APPROVED` solo cuando el owner documente las cuatro decisiones
bloqueantes. Hasta entonces se permiten fixes de scoping/deny-by-default, pero
no implementar una nueva ceremonia de identidad.
