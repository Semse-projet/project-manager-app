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
- ✅ Smoke autenticado OPS_ADMIN en producción: 200 el 2026-11-07, y el 2026-11-08 con contenido observado (1 señal, solo `tenant_default`, el tenant del owner). En la verificación documentada de los 7 handlers de Operational Intelligence anteriores al fix, la identidad se leía de `req` y las solicitudes fallaban con 401; esto no describe todas las rutas, usuarios ni sesiones.
- ✅ `SEMSE T008 Staging` cerrado (2026-11-07): sin dominios públicos.

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

- Smoke OPS_ADMIN (2026-11-07, sesión real del owner desde iPhone). Logs HTTP de Railway:
  - web `app.semseproject.com/api/semse/operational-signals` y API
    `api.semseproject.com/v1/operational-intelligence/signals`: 403 a las
    03:48:17Z (antes de entrar con la cuenta OPS_ADMIN; es permiso denegado,
    no fallo de autenticación);
  - después, 200 a las 03:50:08Z, 04:03:59Z, 04:06:16Z y 04:07:53Z.
  - El contenido no se inspeccionó ese día. Codex lo señaló en #1114 y se
    completó el 2026-11-08 (siguiente punto).
- Smoke OPS_ADMIN con contenido observado (2026-11-08):
  - 23:54:40Z y 23:55:15Z: web y API 403, sesión con una cuenta sin
    `ops:dashboard:read`;
  - 23:59:42Z: 401 del BFF ("Authentication required for SEMSE API route"),
    sin sesión, sin llegar a la API;
  - 00:02:05Z: web y API **200** con la sesión OPS_ADMIN del owner.
  - Cuerpo: `{"data":[ ... ]}` con **1 señal** (`type`
    `EXPERIENCE_FRICTION`, `tenantId` `tenant_default`) y ningún otro
    `tenantId`. El owner confirma que su cuenta OPS_ADMIN pertenece a
    `tenant_default`. El `null` que vio el 2026-11-07 era el último campo de
    la señal (`resolvedAt`), no el cuerpo.
  - Hallazgo aparte, no relacionado con este spec: el texto de la señal se
    muestra con mojibake (`FricciÃ³n` en vez de `Fricción`), un problema de
    codificación UTF-8 al guardar o mostrar el mensaje.
- T008 (2026-11-07): `semse-api-t008-a` y `-b` sin `serviceDomains` ni
  `customDomains` en Railway; los dos hostnames responden 404
  "Application not found".

## Riesgos abiertos

1. **Cerrado — `SEMSE T008 Staging`.** Sus dos APIs aceptaban identidad por
   cabeceras desde internet (sin `AUTH_SECRET`, código del 2026-10-18). El
   owner quitó los dominios públicos el 2026-11-07. Los servicios siguen
   corriendo sin `AUTH_SECRET`: si vuelven a tener dominio público, hay que
   definir antes `AUTH_SECRET`.
2. **Cerrado — smoke de OI.** Ver Evidencia (2026-11-07).

## Siguientes pasos

1. Ninguno pendiente de este spec.
2. Si T008 recupera dominio público, definir antes `AUTH_SECRET` en sus dos APIs.
3. **Fuera de alcance de este spec:** validación de `AUTH_SECRET` al arranque
   del proceso (hoy es por request) y la frontera SSE `@Public()` (ADR-040).
