# 2026-11-05 — Identidad por cabeceras fail-closed (core.header-identity-fail-closed)

Sesión de agente, 2026-11-04 y 2026-11-05. Owner: `@Samuelcastella`.

## Resumen

Partió de una revisión independiente de los tests de #1083 (observer/history),
hecha con los agentes `security-reviewer` y `pr-test-analyzer` de ECC, instalado
solo en el contenedor de la sesión. La revisión encontró que la API aceptaba
identidad por cabeceras (`x-user-id`, `x-tenant-id`, `x-org-id`, `x-roles`)
cuando faltaba `AUTH_SECRET` y `NODE_ENV` no era exactamente `production`,
incluido `NODE_ENV` sin definir. Se siguió el flujo SDD completo y se entregó
en tres PRs fusionados:

| PR | Contenido | Commit en `main` |
|---|---|---|
| #1090 | `.github/CODEOWNERS` (enrutamiento de revisiones) | `f919ef6` |
| #1091 | Tests O.HI4/O.HI5 de observer/history: 21 casos HTTP y 10 subtests en Postgres; sin skip silencioso | `30fec10` |
| #1092 | Spec + plan + tareas + checklist y el fix: regla única `headerIdentityAllowed()` (opción A), OI con contexto verificado, ajuste de 2 workflows | `7a66a96` |

**Regla (opción A, decidida por el owner):** la identidad por cabeceras solo se
acepta si se cumplen a la vez tres condiciones: `AUTH_SECRET` ausente,
`SEMSE_ALLOW_HEADER_IDENTITY=true` y `NODE_ENV` en {`development`, `test`}. Si
falta `AUTH_SECRET` y no se cumplen las otras dos condiciones, la API responde
503 en vez de confiar en las cabeceras. Con `AUTH_SECRET` definido, que es la
configuración normal de producción, el opt-in no tiene efecto: la API exige
bearer firmado y sesión, y una petición sin bearer recibe 401.

**Operational Intelligence:** los 7 handlers tomaban la identidad del objeto
`req` en vez de sus cabeceras. Por código respondían siempre 401, y el arreglo
"obvio" habría abierto un IDOR por cabecera. Ahora usan
`resolveRequestContext(req)`.

## Checklist final

- ✅ Spec `core.header-identity-fail-closed` `APPROVED` → `IMPLEMENTED`; plan, tareas y checklist.
- ✅ Tests escritos primero, en rojo contra `main` y en verde con el cambio.
- ✅ Mutación: quitar cualquiera de las tres condiciones, o volver a leer cabeceras en OI, hace fallar tests.
- ✅ CI de #1092: 13 checks terminados sin fallos; revisión de Codex sin hallazgos.
- ✅ Cambio en `api-integration.yml` y `api-smoke.yml`, autorizado por el owner: declaran el opt-in para la API de prueba sin `AUTH_SECRET`.
- ✅ Deploy de producción (`SEMSEproject`): 4 servicios en SUCCESS.
- ❌ Smoke autenticado de `/v1/operational-intelligence/*` con OPS_ADMIN real: pendiente.
- ❌ `SEMSE T008 Staging` sigue expuesto (ver Riesgos abiertos).

## Evidencia

- API unit: 3762 pasan, 0 fallan (tras traer `main` con #1090 y #1091).
- API integración (Postgres 16 desechable, mismo entorno que `api-integration.yml`): 137 pasan, 0 fallan, 7 se saltan.
- Root unit: 1630 pasan. `tsc --noEmit` y `eslint` de los archivos tocados pasan.
- `pnpm spec:validate:strict`: 0 errores y 0 advertencias.
- Fallo de CI reproducido en local: `scripts/api-integration.mjs` recibía 503 en
  `POST /v1/jobs` sin el opt-in. Con el opt-in pasan `api-integration.mjs` y
  `api-f01-bids-integration.mjs`.
- CI de `main` sobre el squash `7a66a96` (evento push): `CI` (41897034776),
  `API Integration` (41897034611), `API Smoke` (41897034587),
  `Autonomy Staged API` (41897034631) y `Operacion Asistida API` (41897034613).
  Los cinco terminaron en success.
- Procedencia: Railway reporta para el deployment `83f11346` de `semse-API`
  `commitHash` `7a66a9657df07590ef8b360dac4ba12df8ed6915` en `main`, el mismo
  commit fusionado en #1092. El deployment activo al 2026-11-06 es `ce1cc4ad`
  (`645ce3b`), que contiene `7a66a96` (verificado con `git merge-base --is-ancestor`).
- Producción, deployment `83f11346` de `semse-API`:
  - `api_bootstrap_complete` a las 19:34:16Z;
  - no aparece `auth_secret_missing_fail_closed` ni `auth_header_identity_mode_enabled`, así que `AUTH_SECRET` está presente;
  - el tráfico firmado del Worker responde 201 y no hay ningún 503.

## Riesgos abiertos

1. **`SEMSE T008 Staging` acepta identidad por cabeceras desde internet.**
   - Los servicios `semse-api-t008-a` y `semse-api-t008-b` no tienen
     `AUTH_SECRET` y corren el código anterior (deploy del 2026-10-18).
   - Un GET sin credenciales a `/v1/ops/observer/history` responde 401
     "Missing required header 'x-user-id'". Es decir, cualquiera puede actuar
     como OPS_ADMIN de cualquier tenant de esa base.
   - Los nombres de los volúmenes sugieren datos sintéticos; no está verificado.
   - El owner eligió "añadir `AUTH_SECRET` y redesplegar". Generar el secreto
     dentro de la sesión del agente fue bloqueado a propósito para no
     materializar credenciales allí. Hay que fijarlo desde el panel de Railway.
   - `semse-api-pr987` sí tiene `AUTH_SECRET`.
2. **Smoke de OI pendiente.** `activation_status` se queda en `INACTIVE`
   hasta ejecutarlo.

## Siguientes pasos

1. **T008:** en Railway → `SEMSE T008 Staging` → `semse-api-t008-a` y `-b` →
   Variables, crear `AUTH_SECRET` con un valor aleatorio de al menos 32
   caracteres, sin pegarlo en ningún chat. Railway redespliega solo.
   Verificación: el mismo GET sin credenciales debe responder 401 "Missing or
   malformed Authorization header".
2. **Smoke OPS_ADMIN en producción:**
   - iniciar sesión como OPS_ADMIN en la web;
   - con esa sesión, llamar a `GET /api/semse/operational-signals`. Es el BFF
     que llega a `GET /v1/operational-intelligence/signals`, el handler
     corregido. **No usar `/admin/mission-control`**: esa vista consume
     `/api/semse/ops/mission-control/*`, no Operational Intelligence, y puede
     funcionar aunque OI siga fallando. La vista web que sí consume OI es
     `/admin/intelligence-rooms/[id]`;
   - esperado: 200 solo con señales del propio tenant (antes, siempre 401).
   - Después, registrar la evidencia, poner `activation_status: ACTIVE` y,
     cerrados los gates, `status: VERIFIED`.
3. **Fuera de alcance de este spec:** validación de `AUTH_SECRET` al arranque
   del proceso (hoy es por request) y la frontera SSE `@Public()` (ADR-040).
