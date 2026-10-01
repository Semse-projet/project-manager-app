# ADR-041 slice 2a — hotfix (2026-10-01)

Corrige los fallos de #719 detectados en revisión. `PAYMENTS_RELEASE_COMMAND` sigue **off** (no se activa hasta 2b + tests de PENDING estancado).

## Bugs y arreglos
1. **Replay con `transaction` undefined.** `PaymentsService.release()` devolvía `{ transaction: undefined … } as never` en un replay; `PaymentsController.release()` llama `toVisiblePaymentTxn(result.transaction)` y el copilot lee `result.transaction.id`. *Reproducido en `main`:* `TypeError: Cannot read properties of undefined (reading 'type')`. Ahora el replay carga el `PaymentTxn` real (`getReleaseTransaction`) y el tipo de retorno es explícito (sin `as never`).
2. **Misma `idempotencyKey` tras FAILED definitivo.** Antes la reserva FAILED sin `providerRef` nuevo conservaba su referencia UNIQUE: repetir la clave = violación de unicidad. Ahora: con clave explícita, la misma clave devuelve el `failed` anterior (replay, sin 2.ª transferencia ni unique violation) y otra clave es un intento nuevo; sin clave, el reintento tras FAILED es un intento nuevo (`_a{n}`). La reserva FAILED conserva su referencia.
3. **Identidad alineada con ADR-041:** `(milestoneId, amountCents)`, independiente de `source` (antes `requestId`, distinto en cada petición). Importe distinto sobre un release activo ⇒ 409 (`ReleaseIdempotencyConflictError`). `Idempotency-Key` opcional por cabecera en REST (`[A-Za-z0-9._:-]{1,128}`).
4. **Resultado normalizado del proveedor** (`paid | processing | definitive_failure | ambiguous_failure`, `escrow-release.provider-adapter.ts`), sin importar `HttpException`: señal explícita (`PayoutFailureError`), o estado HTTP por duck-typing (`statusCode`/`status`/`getStatus()`); **sin señal ⇒ ambiguo**.
   - *Hallazgo:* casi todos los proveedores lanzan `Error` plano; con la clasificación anterior un rechazo previo definitivo (p. ej. Stripe «sin cuenta Connect») habría quedado como ambiguo y bloqueado el milestone. Se marcaron los rechazos previos (Stripe) y los errores HTTP de PayPal/Adyen llevan su estado (4xx definitivo salvo 408/409; 5xx/red ambiguo).
   - Stripe `transfers.create` ahora usa `idempotencyKey` (referencia de reserva): un reintento tras fallo ambiguo no puede crear una 2.ª transferencia en Stripe.
5. **Flag off** documentado en `RAILWAY_ENV_VARS.md` con la advertencia.

## Verificación
- `tsc --noEmit` OK; suite API **2601 pass / 0 fail** (incluye REST, Prometeo y copilot).
- Nuevos: `escrow-release-command.test.ts` (reescrito, 15), `escrow-release-provider-adapter.test.ts` (6), `escrow-release-service-replay.test.ts` (5: controller real + servicio real + repo en memoria: replay REST, independencia de fuente, misma clave tras FAILED, timeout ⇒ unknown, flag off).
- Concurrencia: probada con `Promise.all` sobre puertos en memoria que emulan la guarda y el UNIQUE. **No** se probó contra Postgres real con aislamiento Serializable (lo cubre el CI de integración solo si existen tests de DB para `releaseFunds`; pendiente añadirlos).

## Pendiente (2b)
Auto-release como adaptador; reconciliador proveedor↔DB (job/endpoint) y tests de PENDING estancado; columna de idempotencia (slice 3); dual approval (D2).
