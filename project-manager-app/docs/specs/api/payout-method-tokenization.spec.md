---
id: "api.payout-method-tokenization"
title: "Métodos de cobro — tokenización y alcance PCI"
domain: "payments"
version: "1.1"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/web/app/components/payments/PayoutMethodForm.tsx
  - apps/web/app/api/semse/workers/payout-method/route.ts
  - apps/web/lib/payout-method-security.ts
  - apps/api/src/modules/payments/payments.controller.ts
  - apps/api/src/modules/payments/payments.service.ts
related_tests:
  - apps/api/test/payments.controller.test.ts
  - apps/api/test/stripe-connect.service.test.ts
  - tests/unit/payout-method-security.test.ts
related_endpoints:
  - v1/payments
related_events: []
related_agents: []
last_verified: "2026-07-25"
---

# Spec: Métodos de cobro — tokenización y alcance PCI

## 1. Alcance y estado

Cubre `2.44` y complementa `api-payments-escrow`.

Permanece en `REVIEW` hasta elegir proveedor/riel. La restricción de seguridad
sí es inmediata: SEMSE no debe recibir PAN, CVV, número bancario completo ni
routing completo como JSON propio.

## 2. Invariantes

- Datos completos se capturan en componentes hospedados/tokenizados del
  proveedor (Stripe Elements/Connect o equivalente).
- Web, BFF, API, logs, tracing y analytics solo reciben tokens/identificadores y
  metadata no sensible (`brand`, `last4`, expiración cuando corresponda).
- CVV nunca se persiste ni se reenvía.
- El cambio de método requiere sesión reciente y audit sin datos sensibles.
- No se promete un riel bancario que el proveedor configurado no soporte.

## 2.1 Mitigación activa v1.1

Mientras sigue abierta la elección del riel definitivo:

- `PayoutMethodForm` no contiene inputs de PAN, tarjeta, cuenta ni routing;
- banco/tarjeta legacy se muestran solo como referencia histórica no editable;
- el único CTA automático es Stripe Connect;
- PayPal, Zelle y Cash App solo guardan un identificador no sensible y se
  etiquetan como instrucción manual, no payout automático;
- el BFF aplica una allowlist exacta `{type,email}`;
- la API acepta únicamente `paypal|zelle|cashapp` mediante Zod `.strict()`;
- cualquier campo adicional o tipo bancario/tarjeta recibe `400` y nunca se
  reenvía desde el BFF al API.

Esta mitigación reduce el alcance PCI, pero no selecciona ni implementa el riel
tokenizado final; por eso la spec permanece en `REVIEW`.

## 3. Flujo esperado

```text
DADO un PRO que configura cobro
CUANDO ingresa datos en el componente seguro del proveedor
ENTONCES el proveedor devuelve un token/account id
  Y SEMSE guarda solo el identificador y last4
  Y ningún request propio contiene el número completo
```

## 4. Decisiones bloqueantes

- Stripe Connect-only vs. PaymentMethod/Elements adicional.
- Soporte bancario: Financial Connections/Plaid/otro proveedor.
- Países, monedas y tipos de cuenta permitidos.
- Migración o invalidación de métodos legacy.

## 5. Tests requeridos

- [x] Payload propio rechaza PAN/routing completos en BFF y API.
- [x] El formulario no renderiza ni serializa campos financieros completos.
- [ ] Formulario usa componente tokenizado para el riel definitivo.
- [ ] Logs/audit del riel definitivo no contienen números completos.
- [ ] API persiste token + last4 del riel definitivo, nunca secreto.
- [ ] Error del proveedor es visible y no deja método parcialmente activo.

## 6. Gate

No implementar el nuevo formulario hasta resolver las decisiones. La
mitigación que retira inputs propios y aplica deny-by-default ya está activa;
no equivale a aprobar la arquitectura final.
