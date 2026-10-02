---
id: "trust.worker-verification-tenant"
title: "Verificación de trabajadores por tenant con desafío de un solo uso"
domain: "trust"
sdd_version: "2.0"
version: "0.1"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - packages/db/prisma/migrations/20261001020000_c11_worker_verification_per_tenant/migration.sql
  - apps/api/src/modules/worker-verification/worker-verification.state.ts
  - apps/api/src/modules/worker-verification/worker-verification.repository.ts
  - apps/api/src/modules/worker-verification/worker-verification.service.ts
  - apps/api/src/modules/matching/matching.repository.ts
related_tests:
  - apps/api/test/worker-verification-persistence.test.ts
  - apps/api/test/worker-verification-scope.test.ts
related_endpoints:
  - "POST /v1/workers/:workerId/verify"
  - "POST /v1/workers/:workerId/sign"
  - "GET /v1/workers/:workerId/status"
  - "GET /v1/workers/:workerId/history"
related_events: []
related_agents: []
last_verified: "2026-10-01"
---

# Spec: Verificación de trabajadores por tenant (C11)

> **Aprobado por el dueño en sesión (2026-10-01):** "migrar a verificación por tenant, no `User.verificationStatus` global. Crear estado tenantId + userId, challenge con nonce aleatorio de un solo uso, TTL, consumedAt, historial auditable y transiciones monotónicas. El campo global queda solo como compatibilidad temporal. DID real sigue fail-closed hasta tener proveedor criptográfico real."

## 1. Problema
`User.verificationStatus` es **global**: verificar a un trabajador en un tenant lo marcaba verificado para el matching de todos. El desafío era constante (`verify_<workerId>`, reutilizable), no había historial y el estado no sobrevivía a un reinicio (corregido en #723).

## 2. Modelo (migración aditiva `20261001020000_c11_worker_verification_per_tenant`)
- `WorkerVerification` (`tenantId`+`userId` único): `status` ∈ `unverified|pending|verified|suspended`, `verifiedAt`.
- `WorkerVerificationChallenge`: solo guarda `nonceHash` (sha256), `expiresAt`, `consumedAt`.
- `WorkerVerificationEvent`: historial **append-only** (`challenge_issued`, `status_changed`, `verified`, `signature_rejected`, con `fromStatus/toStatus/actorUserId/metadataJson`).
- Sin FK a Tenant/User (migración puramente aditiva, de bajo riesgo). Sin backfill. **Rollback:** `DROP TABLE` de las 3 tablas (SQL en la cabecera de la migración; verificado en Postgres 16).

## 3. Reglas
1. **Estado efectivo** = fila por tenant; sin fila, el global legado **solo como compatibilidad temporal** (lo escrito por esta vía **nunca** toca el global). Matching, estado, stats y lista de no verificados usan el estado efectivo.
2. **Monotónico:** `unverified → pending → verified` (también `unverified → verified`); nunca se baja; `suspended` no se sale ni se entra desde la atestación (decisión explícita de OPS fuera de este flujo). Cada transición es compare-and-set y escribe su evento en la misma transacción.
3. **Precondición:** solo el propio trabajador u `OPS_ADMIN` inicia/presenta la atestación (#723).
4. **Desafío:** nonce aleatorio de 256 bits, **un solo uso**, TTL (600 s por defecto; `WORKER_VERIFICATION_CHALLENGE_TTL_SECONDS` 30–3600), ligado a tenant+trabajador; emitir uno nuevo invalida el anterior vigente; se **consume antes** de validar la firma (un intento fallido también lo quema). El mensaje a firmar es `semse-verify:v1:{tenantId}:{workerId}:{nonce}`.
5. **DID real sigue fail-closed:** `verifyDidSignature` rechaza hasta tener proveedor criptográfico real; por tanto nada llega a `verified` por esta vía todavía.
6. Cross-tenant ⇒ 404 (sin oráculo); el historial de un tenant no es visible desde otro.

## 4. Contratos (cambios)
- `POST /verify` devuelve además `challenge: { nonce, expiresAt, message }` (solo en esa respuesta).
- `POST /sign` exige `nonce` en el body (400 si falta/forma inválida; `failed` si es inválido, caducado, ya usado o de otro trabajador/tenant).
- `GET /history` devuelve `historyAvailable: true` y `events[]` reales.

## 5. Tests y verificación
Lógica pura; tenant-isolation; nonce de un solo uso, caducado, ajeno e inventado; invalidación del desafío previo; precondición; monotonicidad; historial; compatibilidad con el global. Verificación en **Postgres 16 real** (esquema migrado + sin deriva): transiciones, carrera de 5 consumos simultáneos del mismo nonce (**gana exactamente 1**), cross-tenant/usuario, caducado, reemplazado, global intacto, nonce nunca en claro, eventos por tenant.

## 6. Gates de cierre
Migración aplicada en producción (automática en el arranque, ya validada su ruta) · CI terminal · merge SHA · deploy · smoke autenticado · proveedor criptográfico DID real (fuera de alcance).
