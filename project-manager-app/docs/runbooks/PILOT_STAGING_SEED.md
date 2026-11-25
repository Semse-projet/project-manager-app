# Siembra sintética del piloto en staging (OPEN-18 / Gate 5)

> **Autorización del propietario (2026-11-25, punto 3):** preparar y ejecutar **solo** en el entorno `staging` del
> proyecto Railway «SEMSE AgentRun 1149 Isolated QA», servicio `semse-api-qa`, mediante un `preDeployCommand`
> temporal que se retira después.
> **Bloqueo actual: no se ejecuta** hasta que el propietario confirme las coordenadas y los dos correos.
> **Nunca** en el proyecto SEMSEproject (producción). El script lo impide: comprueba el id y el nombre del proyecto,
> el entorno y el servicio.

## Decisión de aprovisionamiento (propietario, 2026-11-25)

El login usa la membresía ACTIVE **más antigua** de la cuenta y no hay selector de Org (`auth.repository`
`findUserByEmail` + `auth.service` `loginWithPassword`). El registro público siempre crea una Org propia, así que
una membresía añadida después nunca sería la Org de la sesión. Por eso (opción elegida: **invitación real, BO-03**):

- **Org del piloto = la Org PRO de sesión de la cuenta PRO** (su membresía más antigua, rol PRO, Org tipo PRO). La
  siembra no crea Org profesional ni memberships.
- **La cuenta WORKER se crea por invitación del PRO** desde esa Org (`registerInvited`): su única membresía es
  WORKER en la Org del piloto. Una cuenta WORKER registrada por el registro público **bloquea** `plan` y `apply`.

## Qué crea

Todo con ids fijos `pilot_seed_*`, en una sola transacción y de forma idempotente.

| Fila | Detalle |
|---|---|
| Org `pilot_seed_org_client` | Cliente sintético de los Jobs, en el tenant de la cuenta PRO |
| Jobs + Project | `pilot_seed_job_verified` y `pilot_seed_job_unverified`; el Project asigna la Org del piloto, así que el reloj los considera asignados |
| Obras (en la Org del piloto) | `pilot_seed_ws_verified`: pin manual verificado, radio configurable (150 m por defecto). `pilot_seed_ws_unverified`: geocodificada, nunca da AUTO (AC-02) |
| Vínculos | Job → obra, ACTIVE |

**No crea** usuarios, contraseñas, memberships ni invitaciones, y **no modifica** la Org del PRO. **No toca** flags
ni datos reales, y no imprime secretos. Los correos aparecen enmascarados en los logs.

## Requisitos previos

1. El propietario registra en staging (`https://semse-api-qa-staging.up.railway.app`) la cuenta **PRO** por el
   registro público (crea su Org PRO).
2. **Solo en staging** (`semse-api-qa`), para la invitación: `SEMSE_ORG_INVITATIONS_ENABLED=true`,
   `SEMSE_INVITATION_EMAIL_DELIVERY=true` y `SEMSE_INVITED_REGISTRATION_ENABLED=true`, con un buzón que reciba el
   enlace. **Nunca** en producción. Se retiran junto con la siembra.
3. El PRO, con sesión en su Org, invita al correo WORKER (rol WORKER). El WORKER abre el enlace y se registra con él
   (no por el registro público). Puede hacerse antes o después de `apply`; `plan` informa `workerAccount`:
   `pending_invitation` o `ready`.
4. `semse-api-qa` despliega un commit que contiene `scripts/staging/pilot-seed.mjs`. Hoy su fuente está fijada en
   `claude/open18-clients@66caabce`, que no lo tiene: hay que repuntarlo a `main` cuando este PR y #1189 estén
   fusionados.
5. Variables **no secretas** en `semse-api-qa` (staging):
   - `PILOT_SEED_CONFIRM=staging-only`;
   - `PILOT_SEED_MODE=plan`, luego `apply`;
   - `PILOT_SEED_PRO_EMAIL` y `PILOT_SEED_WORKER_EMAIL`;
   - `PILOT_SEED_VERIFIED_LAT`, `PILOT_SEED_VERIFIED_LNG` y `PILOT_SEED_VERIFIED_RADIUS=150`;
   - `PILOT_SEED_UNVERIFIED_LAT` y `PILOT_SEED_UNVERIFIED_LNG`.

**Identidad del entorno:** el script exige el id y el nombre exactos del proyecto, el entorno `staging` y el servicio
`semse-api-qa`. No mira `NODE_ENV`: `Dockerfile.api` fija `NODE_ENV=production` también en staging (modo de Node, no
entorno).

## Procedimiento (agente, con la autorización del punto 3)

1. **Verificar el entorno, solo lectura:**
   - proyecto `dc1754a3-…` y entorno `staging`;
   - `postgres-qa` es su propia base;
   - el health de `semse-api-qa` responde.

   Anotar el `preDeployCommand` actual (`node scripts/pre-migrate.mjs`).
2. **Plan (solo lectura de la siembra):** con `PILOT_SEED_MODE=plan`, `preDeployCommand` =
   `node scripts/pre-migrate.mjs && node scripts/staging/pilot-seed.mjs` y redeploy. El plan comprueba en la base,
   sin escribir: cuenta PRO activa y su Org de sesión; cuenta WORKER (`pending_invitation`/`ready`, o bloqueo si su
   Org de sesión no es WORKER en la Org del piloto); filas `pilot_seed_*` ya presentes y de qué Org. El log debe
   mostrar `{"pilotSeed":"plan","ok":true,"readOnly":true,…}`.
   **Ojo:** `pre-migrate.mjs` es el paso normal de cualquier despliegue y aplica las migraciones pendientes de
   `main` a la base de staging **antes** del plan. Eso no forma parte de la siembra ni es de solo lectura; es el
   efecto de desplegar `main` en staging (paso 4 de requisitos).
3. **Apply:** `PILOT_SEED_MODE=apply` y redeploy. El log debe mostrar `{"pilotSeed":"apply","ok":true,…}` con
   `pilotOrgId`. Repetir `plan` tras la invitación hasta ver `workerAccount: "ready"`.
4. **Retirar:** volver el `preDeployCommand` a `node scripts/pre-migrate.mjs` y borrar las variables `PILOT_SEED_*`.
   Redeploy y **verificar** en la configuración del servicio y en el log que el script ya no corre.
5. **Evidencia** en `docs/reportes/`: SHA desplegado, ids de los deploys, líneas de log de plan y apply, y
   confirmación de la retirada.

## Rollback

Repetir los pasos 2–4 con `PILOT_SEED_MODE=rollback`. Borra solo las filas `pilot_seed_*` y los `TimeEntry` y
`GeofenceEvent` sintéticos ligados a esos Jobs y obras. No toca las cuentas, sus memberships ni la Org del PRO.
Los tres flags de invitación de staging se retiran aparte (paso 4).

## Verificación hecha antes de usarlo (2026-11-25, PostgreSQL 16 local desechable)

Todas las migraciones aplicadas; fixture: PRO con su Org PRO, un WORKER «público» (Org propia más antigua + WORKER
en la Org del PRO) y un WORKER invitado (solo WORKER en la Org del PRO). Variables con la identidad del staging y
`NODE_ENV=production`.

| Paso | Resultado |
|---|---|
| `plan` / `apply` con el WORKER público | exit 1, bloqueado («créala por invitación»), nada escrito |
| `plan` con WORKER aún sin cuenta | exit 0, `workerAccount: pending_invitation`, nada escrito |
| `plan` con el WORKER invitado | exit 0, `readOnly: true`, nada escrito |
| `apply` | 2 Jobs, 2 obras (1 `manual_pin` verificada, 1 `geocoded`), 2 vínculos y 2 Projects en la Org del PRO; +1 Org cliente |
| `apply` otra vez | mismos conteos (idempotente) |
| `rollback` | 0 filas `pilot_seed_*`; Org del PRO, cuentas y memberships intactas |
| fuera del staging autorizado | exit 2, sin conexión a la base (tests unitarios) |

## Pruebas en los teléfonos (misma cuenta WORKER)

Ver `GATE5_DEVICE_TEST_SCRIPT.md` §3: un teléfono a la vez, sin relojes activos entre pruebas.
