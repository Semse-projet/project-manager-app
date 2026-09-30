# Reporte — C10 Worker Verification: alcance por tenant e historial honesto (Wave A, lote A3)

**Fecha:** 2026-09-30 · **Base:** main

## Estado
C10 sigue abierta (avance). Tercer hueco concreto cerrado (tras evidence-gateway #702 y liens #703). Inventario de `tasks`, `reservations`, `ratings`, `trust`: consultas ya filtran por tenant en lo revisado; falta verificar org-scope fino en `reservations` y `ratings`.

## Hallazgos (verificados)
1. `GET /v1/…/:workerId/status` y `/history`, `POST :workerId/verify` y `/sign` recibían un `workerId` sin comprobar tenant: `User` es global y un worker pertenece a un tenant sólo vía `Membership`→`Org`. Cualquier titular de `worker:read/write` de otro tenant podía consultar o mover el estado de workers ajenos.
2. `getVerificationHistory` devolvía un historial **sintético** (`verified`) para cualquier `workerId`: éxito fabricado (mismo patrón que ADR-034). No existe persistencia de log de verificación (`createVerificationLog` sólo escribe a logs) ni consumidores (la web usa sólo `stats`).
- Positivo verificado: `verifyDidSignature` falla cerrado (no hay crypto DID), por lo que nadie puede quedar `verified` por esta vía.

## Cambios
- `worker-verification.repository.ts`: `getWorkerInTenant` (membresía en un org del tenant, igual que `getUnverifiedWorkers`); se elimina el historial sintético.
- `worker-verification.service.ts`: `requireWorkerInTenant` (404 sin oráculo de existencia) en initiate/sign/status/history; historial honesto: `User.verificationStatus` real, `verifications: []`, `historyAvailable: false`.
- `worker-verification.controller.ts`: pasa `tenantId` del actor. Sin migraciones.

## Tests
- Nuevo `test/worker-verification-scope.test.ts` (5). API unit: 2565 tests, 2528 pass, 0 fail; tsc, lint, build OK. (`worker-verification.service.spec.ts` es jest y no corre en el repo; no se tocó.)

## Abierto
- Estado de verificación en un `Map` en memoria por proceso (se pierde al reiniciar y no se comparte entre réplicas) → persistir (migración) con C11 (atestación).
- Decidir si el historial debe persistirse (tabla de logs de verificación).
- Cambio de comportamiento: `/history` ya no devuelve una entrada `verified` inventada.
