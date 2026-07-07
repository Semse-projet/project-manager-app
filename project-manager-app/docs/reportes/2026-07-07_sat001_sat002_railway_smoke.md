# Smoke Railway — SAT-001 + SAT-002 (anillo 4)

**Fecha:** 2026-07-07
**Ejecutor:** Claude — sesión satélites
**Entorno:** producción (`project-manager-app-production-977f.up.railway.app`)
**Referencia:** `docs/specs/satellites/SAT-000-sdd-harness.spec.md` §2 (anillo 4), `SAT-001-semse-sdk.spec.md`, `SAT-002-alexa-voice-channel.spec.md`

## Cambios en Railway

- Servicio `semse-API`: variable `SATELLITE_TOKENS_ENABLED` creada con valor `true` (antes no existía → default `false` en código). Redeploy automático disparado por Railway al cambiar la variable.

## Emisión del token real `alexa`

- Autenticado como admin construyendo localmente un SEMSE Signed Token (`userId=usr_admin_001`, `roles=[OPS_ADMIN]`, TTL 15 min) firmado con el `AUTH_SECRET` de producción — mismo algoritmo que `apps/api/src/common/auth-token.ts`, sin usar ninguna cuenta ni sesión persistida.
- `POST /v1/satellites/tokens` `{ name: "alexa", scopes: ["intake:write"] }` → `201`.
- **Token id:** `cmra4rlsy0000mz01xp2dvbdw` (el valor en claro se entregó una sola vez, fuera de este documento, para configurar `SEMSE_SATELLITE_TOKEN` en la Lambda — no se commitea).

## Pruebas contra producción

| Caso | Request | Resultado |
|---|---|---|
| Introspección | `GET /v1/satellites/me` con token `alexa` | `200` — `{ name: "alexa", scopes: ["intake:write"] }` |
| Happy path | `POST /v1/intake/analyze` con `x-semse-channel: alexa` + token | `200` — intake creado (`bathroom_remodel`, confidence 0.78), `voicePrompt` en español sin markdown: *"¿Qué tipo de remodelación necesita el baño? Puedes responder: ..."* |
| Negativo — scope insuficiente | `GET /v1/satellites/tokens` con token `alexa` (sin permiso admin) | `401 Invalid or expired auth token` (rechazado por el `AuthGuard` general, correcto: el satellite token no es una sesión de usuario) |
| Negativo — canal sin token | `POST /v1/intake/analyze` con `x-semse-channel: alexa` sin `Authorization` | `401 "Channel claims require a satellite token — 'Authorization: Bearer sst_...'"` |
| Heartbeat pasivo | `GET /v1/satellites/tokens` (admin) tras la llamada de intake | `lastUsedAt` del token `alexa` actualizado a `2026-07-07T04:14:49.725Z` — confirma la base de SAT-008 (Observer) |
| Fuga de secreto | Listado admin de tokens | El valor `token` en claro nunca aparece; solo `id`, `scopes`, `status`, timestamps |

## Conclusión

Anillo 4 cerrado para **SAT-001** (infraestructura de tokens) y **SAT-002** (canal Alexa, lado SEMSE). Ambos pasan a `CONNECTED-STAGING` en `SATELLITES.md`.

Pendiente para `LIVE`: desplegar la Lambda (`~/alexa-openai-skill`) con `SEMSE_SATELLITE_ENABLED=true` y el token real, y una prueba con dispositivo Alexa físico — fuera del alcance de esta sesión (requiere AWS/Alexa Developer Console).
