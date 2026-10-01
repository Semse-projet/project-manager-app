# C11 — Precondiciones de atestación de identidad (2026-10-01)

## Qué estaba mal
- El estado de verificación vivía en un `Map` en memoria (`verificationStates`): se perdía al reiniciar y cada réplica veía otro estado.
- `updateWorkerVerificationStatus` solo logueaba: ni siquiera una verificación "válida" se persistía.
- Cualquier holder de `worker:write` del tenant podía iniciar/presentar una atestación sobre **otro** trabajador.

## Cambios (sin migración)
- Estado **derivado de `User.verificationStatus`** (`unverified|pending` ⇒ pending, `verified` ⇒ verified, `suspended` ⇒ failed). Estados intermedios y `failed` son transitorios de una petición; no se devuelve la firma.
- **Precondición:** solo el propio trabajador u `OPS_ADMIN` puede iniciar o presentar la atestación; sin actor ⇒ 403 (fail closed). El controller pasa la identidad autenticada.
- **Persistencia real y atómica** (`markPendingIfUnverified`, `markVerified`, `updateMany` condicionales): `unverified→pending`, `unverified|pending→verified`; **nunca** toca `suspended` ni degrada `verified`. Un suspendido no se re-verifica por este flujo (ni se almacena la firma).
- Se eliminó el `Map`; `updateWorkerVerificationStatus` (falso) reemplazado por las dos transiciones reales.

## Verificación
- `tsc` limpio; suite API **2612 pass / 0 fail**; +7 tests (`worker-verification-persistence`: "reinicio" con dos instancias sobre la misma DB, no degradar, precondición, firma inválida, firma válida persiste, suspendido, mapeo de estados) y scope/controller actualizados.
- Prueba real en Postgres 16 (esquema migrado) del repositorio compilado: `unverified→pending` ✔; `verified` y `suspended` no se modifican por `markPendingIfUnverified`; `pending→verified` ✔; `suspended→verified` ✘; `verified→verified` no-op.

## Brechas que siguen abiertas (C11 NO se cierra)
1. **No hay criptografía DID real**: `verifyDidSignature` falla cerrado, así que nada llega a "verified" por esta vía (correcto, pero la capacidad no existe).
2. **Desafío constante** (`verify_<workerId>`): reutilizable/replay. Hace falta un nonce emitido por el servidor, de un solo uso y con expiración (necesita almacenamiento: tabla o Redis).
3. **Historial no persistido** (`historyAvailable:false`): requiere tabla de eventos de verificación (migración).
4. **`User.verificationStatus` es global**, no por tenant: verificar a un trabajador en un tenant lo marca verificado para el matching de todos. Requiere decisión de diseño (estado por membresía/tenant) y migración.
Estas 4 necesitan decisión o migración planificada; no se tocan sin aprobación.
