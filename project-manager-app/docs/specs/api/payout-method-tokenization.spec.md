---
id: "api.payout-method-tokenization"
title: "Métodos de cobro — tokenización y alcance PCI"
domain: "payments"
version: "1.1"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex; actualizada el 2026-10-03 contra el código de main"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/web/app/components/payments/PayoutMethodForm.tsx
  - apps/api/src/modules/payments/payments.controller.ts
  - apps/api/src/modules/payments/payments.service.ts
related_tests:
  - apps/api/test/payments.controller.test.ts
  - apps/api/test/stripe-connect.service.test.ts
related_endpoints:
  - v1/payments
related_events: []
related_agents: []
last_verified: "2026-10-03"
---

# Spec: Métodos de cobro — tokenización y alcance PCI

## 1. Alcance y estado

Cubre el hallazgo `2.44` del plan y complementa `api-payments-escrow`.

La decisión que esta spec dejaba abierta (riel/proveedor) **ya está tomada**:
el owner decidió el 2026-07-27 migrar ahora **solo con Stripe, sin agregar
Plaid** (PR #458). La restricción de seguridad original se cumple en `main`:
SEMSE no recibe PAN, CVV, número bancario completo ni routing completo como
JSON propio. La spec sigue en `REVIEW` solo porque las decisiones de la sección
5 que no cubrió esa migración siguen sin documentarse.

## 2. Invariantes

- Datos completos se capturan en componentes hospedados/tokenizados del
  proveedor (Stripe Elements/Connect o equivalente).
- Web, BFF, API, logs, tracing y analytics solo reciben tokens/identificadores y
  metadata no sensible (`brand`, `last4`, expiración cuando corresponda).
- CVV nunca se persiste ni se reenvía.
- El cambio de método requiere sesión reciente y audit sin datos sensibles.
- No se promete un riel bancario que el proveedor configurado no soporte.

## 3. Estado verificado en `main` (2026-10-03)

| Invariante | Estado | Evidencia |
|---|---|---|
| Captura en el navegador, directo a Stripe | Cumple (PR #458) | `PayoutMethodForm.tsx` tokeniza cuenta bancaria y tarjeta con Stripe.js; al BFF solo llegan `stripeToken` y `last4`. |
| El API solo guarda token + `last4`, nunca el número | Cumple | `PaymentsService.saveWorkerPayoutMethod` guarda un registro sanitizado (`type`, `label`, `bankName`, `last4`, `email`, `verified: false`) y descarta el token, que es de un solo uso. |
| `last4` no se confía al navegador cuando se puede verificar | Cumple parcialmente | Se consulta `verifyPayoutToken` en Stripe; si el servicio no está cableado o Stripe está en modo mock, se usa el `last4` del cliente. |
| El payload propio rechaza campos financieros | Cumple (PR #761) | `workerPayoutMethodSchema` es `.strict()`: `routingNumber`, `accountNumber`, `cardNumber` y cualquier campo desconocido devuelven 400. Cubierto en `payments.controller.test.ts`. |
| Un destinatario sin cuenta Connect activa nunca cobra por la cuenta compartida | Cumple | `StripePaymentProvider` lanza `PayoutFailureError` definitivo: "Refusing to fall back to the shared platform account". |
| CVV nunca se persiste ni se reenvía | Sin pruebas específicas | No hay un test que lo afirme; el formulario no maneja CVV propio. |
| Cambio de método con sesión reciente | **No verificado** | No se revisó en esta pasada. |
| Logs/audit sin números completos | **No verificado** | El audit registra el evento; no se auditó el contenido de logs de terceros. |

El registro del método de cobro es de presentación y estado; el mecanismo real
de payout es la cuenta de Stripe Connect, que es un panel separado en
`/worker/payments`.

## 4. Flujo vigente

```text
DADO un PRO que configura cobro con cuenta bancaria o tarjeta
CUANDO ingresa los datos en el componente de Stripe
ENTONCES Stripe devuelve un token de un solo uso y su last4
  Y SEMSE guarda solo el tipo, el banco, el last4 y verified=false
  Y ningún request propio contiene el número completo

DADO un PRO que elige PayPal, Zelle o Cash App
ENTONCES SEMSE guarda el identificador de contacto, sin datos bancarios
```

## 5. Decisiones que siguen abiertas

- Países, monedas y tipos de cuenta permitidos.
- Migración o invalidación de métodos legacy guardados antes de la tokenización.
- Si se exige sesión reciente para cambiar el método (hoy no verificado).

Ya resueltas: proveedor y riel (solo Stripe, sin Plaid; PR #458).

## 6. Tests

Existentes: `.strict()` y aceptación de payload tokenizado en
`payments.controller.test.ts`.

Faltan: un test de que logs y audit no contienen números completos, uno de que
un error del proveedor no deja el método parcialmente activo y uno de unidad del
rechazo explícito a pagar por la cuenta compartida.

## 7. Gate

Pasar a `APPROVED` exige documentar las decisiones abiertas de la sección 5.
Mientras tanto no se reintroduce ningún campo propio que reciba datos
financieros completos.
