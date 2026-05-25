# Communications WhatsApp Webhook Signature - 2026-05-24

## Resumen ejecutivo

Se aislo el frente de seguridad para webhooks de WhatsApp/Meta en la rama:

- `fix/communications-whatsapp-webhook-signature`

El cambio agrega validacion HMAC SHA-256 para `x-hub-signature-256` usando el raw body del request y comparacion timing-safe. No se tocaron Prisma, SDD, Angular, env examples, Hermes, Prometeo ni React/Next warnings.

## Alcance

Archivos modificados:

- `apps/api/src/modules/communications/communications.controller.ts`
- `apps/api/src/modules/communications/providers/whatsapp-cloud.adapter.ts`

Archivos agregados:

- `apps/api/test/communications-whatsapp-webhook-signature.test.ts`
- `docs/reportes/communications_whatsapp_webhook_signature_2026-05-24.md`

## Implementacion

La firma esperada sigue el formato de Meta:

```text
x-hub-signature-256: sha256=<hex-hmac-sha256>
```

El HMAC se calcula sobre el raw body con:

```text
HMAC_SHA256(app_secret, raw_body)
```

Variables soportadas para el secret:

- `WHATSAPP_APP_SECRET`
- `META_APP_SECRET`

Reglas:

- Si hay secret configurado, todo POST de webhook debe tener firma valida.
- Si `SEMSE_COMMUNICATIONS_MODE=live`, `NODE_ENV=production` o `RAILWAY_ENVIRONMENT_NAME=production`, la validacion de firma es obligatoria.
- Si la validacion es obligatoria y falta secret, el endpoint responde error de configuracion.
- En modo local/mock sin secret, se permite webhook sin firma para no romper desarrollo local.
- No se imprime ni registra el secret.

## Casos cubiertos por tests

- Firma valida -> accepted.
- Firma faltante -> rejected por la funcion de verificacion.
- Firma invalida -> rejected.
- Formato incorrecto -> rejected.
- Secret faltante en modo live -> rejected por el adapter.
- Secret faltante en modo mock/local -> permitido de forma documentada.

## Comandos ejecutados

```bash
git switch -c fix/communications-whatsapp-webhook-signature
node --experimental-strip-types --test apps/api/test/communications-whatsapp-webhook-signature.test.ts
pnpm typecheck
pnpm spec:preflight
pnpm test:unit
pnpm railway:preflight
git diff --check
```

## Resultados iniciales

| Comando | Resultado |
| --- | --- |
| `node --experimental-strip-types --test apps/api/test/communications-whatsapp-webhook-signature.test.ts` | OK, 5/5 |
| `pnpm typecheck` | OK |
| `pnpm spec:preflight` | OK, con 21 warnings SDD historicos |
| `pnpm test:unit` | Falla por resolucion root workspace de `@semse/schemas`, `@semse/agents`, `@semse/knowledge`; 11/15 pasan |
| `pnpm railway:preflight` | OK |
| `git diff --check` | OK |

Warnings no relacionados observados durante `railway:preflight`:

- 21 warnings SDD historicos por metadata canonical faltante.
- Warning conocido de Next config: `experimental.nodeMiddleware`.
- Warnings existentes de React Hooks / `next/image`.

## Riesgos pendientes

- El endpoint depende de que Nest/Fastify preserve `@RawBody()`; `main.ts` ya usa `{ rawBody: true }`.
- Los tests unitarios cubren la verificacion criptografica y el adapter. El controller queda cubierto por `typecheck`; no se importa directamente en el runner unitario porque sus parameter decorators no son compatibles con `node --experimental-strip-types` sin transformacion adicional.
- Produccion debe configurar `WHATSAPP_APP_SECRET` o `META_APP_SECRET` antes de habilitar `SEMSE_COMMUNICATIONS_MODE=live`.

## Recomendacion operativa

Antes de activar WhatsApp live:

1. Configurar `WHATSAPP_APP_SECRET` en Railway.
2. Confirmar que Meta envia `x-hub-signature-256`.
3. Probar webhook POST firmado en ambiente no productivo.
4. Confirmar que payloads sin firma reciben rechazo.
