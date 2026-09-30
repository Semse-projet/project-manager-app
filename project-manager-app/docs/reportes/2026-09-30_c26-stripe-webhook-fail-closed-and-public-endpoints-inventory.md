# Reporte — C26 webhook Stripe fail-closed + inventario de endpoints públicos (Wave A, A2/A3)

**Fecha:** 2026-09-30 · **Base:** main

## C26 — Configuración de Stripe (PARCIAL, avance)
**Hallazgo (verificado):** `POST /v1/payments/webhook` es `@Public()` y su única autenticación es la firma `Stripe-Signature`. Si `STRIPE_WEBHOOK_SECRET` no estaba definido, la verificación se **omitía** salvo que `NODE_ENV=production` o `RAILWAY_ENVIRONMENT_NAME=production`. En staging/previews (o cualquier entorno mal etiquetado) un POST sin firma `{event, providerRef}` (forma "legacy" aceptada por `paymentsWebhookSchema`) llegaba a `PaymentsService.webhook`, que finaliza depósitos/releases.

**Cambio:** `resolveStripeWebhookMode(env)` → `verify` (hay secreto) | `skip_unsigned` (solo con `STRIPE_WEBHOOK_ALLOW_UNSIGNED=true` y fuera de producción) | `reject` (503 por defecto). Sin migraciones. Documentado en `infra/railway/RAILWAY_ENV_VARS.md` (no se tocó ninguna variable real).

**Tests:** `test/stripe-webhook-policy.test.ts` (6): política por entorno, rechazo sin llegar al servicio, opt-in solo no-prod, firma inválida/ausente rechazada, firma válida procesada. API unit: 2559 tests, 2522 pass, 0 fail; tsc, lint, build OK.

**Acción para el operador (no ejecutada):** confirmar que `STRIPE_WEBHOOK_SECRET` está en **todos** los entornos que reciben webhooks reales (API de producción y staging) *antes* de desplegar; de lo contrario el webhook responderá 503.

## C10 — inventario de endpoints (resultado del barrido)
- `@AuthenticatedAccess` restantes: todos "solo mi propio registro" (users, auth, workspace, push) salvo liens (corregido en #703).
- `tasks`, `reservations` (org-scope en crear/aceptar/liberar/expirar/listar), `ratings` (política por usuario), `trust` (`verify` público por token firmado): sin hallazgos.
- Corregidos en PR aparte: evidence-gateway (#702), liens (#703), worker-verification (#704).

## Hallazgos abiertos (decisión/diseño necesario, NO corregidos aquí)
1. **`GET /v1/uploads/files/*` es `@Public()`** (evidencia C19): la protección es solo que la clave `tenants/{tenantId}/{scope}{domain}/{nonce}` es difícil de adivinar; las URLs se emiten en respuestas/eventos (p. ej. `bucketKey`/`publicUrl`) y la web no tiene proxy GET (los navegadores usan la URL directa; el vision-service la consume sin sesión). Propuesta: URLs firmadas con expiración (HMAC) + lectura autenticada con check de tenant en la clave, con modo shadow→enforce por flag. Requiere spec SDD y decisión (afecta web, vision-service, evidencia).
2. **Webhook WhatsApp (C36):** exige firma en modo `live` o si hay `WHATSAPP_APP_SECRET`; en modo `mock` sin secreto acepta entrantes sin firma. Sin efecto monetario; revisar en B5 junto con C36/C37.
3. `intelligence` tiene 6 endpoints públicos (marketing): pendiente revisar minimización de datos de `public/openings/:jobId`.
