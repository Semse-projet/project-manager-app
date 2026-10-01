# C11 — verificación por tenant (2026-10-01)

Decisión del dueño aplicada: estado por (tenant, usuario), desafío con nonce de un solo uso + TTL + `consumedAt`, historial auditable, transiciones monotónicas, global solo como compatibilidad temporal, DID real fail-closed.

## Hecho
- **Migración aditiva** `20261001020000_c11_worker_verification_per_tenant` (3 tablas, sin FK, sin backfill, rollback documentado y verificado). Aplicada a un Postgres 16 con las 105 migraciones previas: sin deriva (`prisma migrate diff` = sin diferencias).
- `worker-verification.state.ts` (lógica pura), repositorio con CAS + evento en la misma transacción, servicio reescrito (initiate emite nonce de 256 bits solo-hash; sign lo consume antes de validar la firma; mensaje ligado a tenant+trabajador+nonce).
- Matching, estado, stats y lista de no verificados usan el estado **efectivo** (fila por tenant, o global legado como compatibilidad temporal). Lo verificado por esta vía **nunca** escribe el global.
- Historial real (`GET /history`: `historyAvailable:true` + `events[]`).

## Verificación
- 23 tests de verificación (puros + servicio con repositorio en memoria de misma semántica + scope/controller) · suite API 2632 pass / 0 fail · `tsc` limpio.
- **Postgres real:** transición única y sin degradar; estado independiente por tenant; **carrera de 5 consumos simultáneos del mismo nonce → gana exactamente 1**; cross-tenant y cross-usuario rechazados; caducado rechazado; un desafío nuevo invalida el anterior; global intacto; nonce en claro nunca almacenado; historial por tenant.

## Cambios de contrato
`POST /verify` devuelve `challenge`; `POST /sign` exige `nonce` (400 si falta). Ningún cliente actual consume estos endpoints con éxito (la verificación falla cerrada), pero el cliente de firma futuro debe seguir este protocolo.

## Pendiente (C11 sigue PARTIAL)
Proveedor criptográfico DID real (hasta entonces nada llega a `verified`); aplicar la migración en producción (automática al desplegar; verificar logs `migrate deploy`); smoke autenticado.
