# Siembra sintética del piloto en staging (OPEN-18 / Gate 5)

> **Autorización del propietario (2026-11-25, punto 3):** preparar y ejecutar **solo** en el entorno `staging` del
> proyecto Railway «SEMSE AgentRun 1149 Isolated QA», servicio `semse-api-qa`, mediante un `preDeployCommand`
> temporal que se retira después.
> **Bloqueo actual: no se ejecuta** hasta que el propietario confirme las coordenadas y los dos correos.
> **Nunca** en el proyecto SEMSEproject (producción). El script lo impide: comprueba el id y el nombre del proyecto,
> el entorno y el servicio.

## Qué crea

Todo con ids fijos `pilot_seed_*`, en una sola transacción y de forma idempotente.

| Fila | Detalle |
|---|---|
| Org `pilot_seed_org_pro` | «Piloto FieldOps (sintético)», tipo PRO, en el tenant de la cuenta PRO |
| Org `pilot_seed_org_client` | Cliente sintético de los Jobs |
| Memberships ACTIVE | cuenta PRO → PRO; cuenta WORKER → WORKER, ambas en la Org del piloto |
| Jobs + Project | `pilot_seed_job_verified` y `pilot_seed_job_unverified`; el Project asigna la Org del piloto, así que el reloj los considera asignados |
| Obras | `pilot_seed_ws_verified`: pin manual verificado, radio configurable (150 m por defecto). `pilot_seed_ws_unverified`: geocodificada, nunca da AUTO (AC-02) |
| Vínculos | Job → obra, ACTIVE |

**No crea** usuarios ni contraseñas: las dos cuentas las registra el propietario en staging. **No toca** flags ni
datos reales, y no imprime secretos. Los correos aparecen enmascarados en los logs.

**Org de la sesión (AC-11):** la cuenta WORKER debe tener seleccionada la Org «Piloto FieldOps (sintético)». Si no,
`geofence-sites` no devuelve las obras del piloto.

## Requisitos previos

1. El propietario registra en staging (`https://semse-api-qa-staging.up.railway.app`) las dos cuentas: WORKER y
   PRO.
2. `semse-api-qa` despliega un commit que contiene `scripts/staging/pilot-seed.mjs`. Hoy su fuente está fijada en
   `claude/open18-clients@66caabce`, que no lo tiene: hay que repuntarlo a `main` cuando este PR y #1189 estén
   fusionados.
3. Variables **no secretas** en `semse-api-qa` (staging):
   - `PILOT_SEED_CONFIRM=staging-only`;
   - `PILOT_SEED_MODE=plan`, luego `apply`;
   - `PILOT_SEED_PRO_EMAIL` y `PILOT_SEED_WORKER_EMAIL`;
   - `PILOT_SEED_VERIFIED_LAT`, `PILOT_SEED_VERIFIED_LNG` y `PILOT_SEED_VERIFIED_RADIUS=150`;
   - `PILOT_SEED_UNVERIFIED_LAT` y `PILOT_SEED_UNVERIFIED_LNG`.

## Procedimiento (agente, con la autorización del punto 3)

1. **Verificar el entorno, solo lectura:**
   - proyecto `dc1754a3-…` y entorno `staging`;
   - `postgres-qa` es su propia base;
   - el health de `semse-api-qa` responde.

   Anotar el `preDeployCommand` actual (`node scripts/pre-migrate.mjs`).
2. **Plan:** con `PILOT_SEED_MODE=plan`, `preDeployCommand` =
   `node scripts/pre-migrate.mjs && node scripts/staging/pilot-seed.mjs` y redeploy. El log debe mostrar
   `{"pilotSeed":"plan",…}` sin escribir nada.
3. **Apply:** `PILOT_SEED_MODE=apply` y redeploy. El log debe mostrar `{"pilotSeed":"apply","ok":true,…}`.
4. **Retirar:** volver el `preDeployCommand` a `node scripts/pre-migrate.mjs` y borrar las variables `PILOT_SEED_*`.
   Redeploy y **verificar** en la configuración del servicio y en el log que el script ya no corre.
5. **Evidencia** en `docs/reportes/`: SHA desplegado, ids de los deploys, líneas de log de plan y apply, y
   confirmación de la retirada.

## Rollback

Repetir los pasos 2–4 con `PILOT_SEED_MODE=rollback`. Borra solo las filas `pilot_seed_*` y los `TimeEntry` y
`GeofenceEvent` sintéticos ligados a esos Jobs y obras. No toca las cuentas ni las Org propias del propietario.

## Verificación hecha antes de usarlo (2026-11-25, PostgreSQL 16 local desechable)

Todas las migraciones aplicadas, con dos usuarios y una Org propia del PRO como fixture.

| Paso | Resultado |
|---|---|
| `plan` | exit 0, nada escrito |
| `apply` | 2 Org, 2 memberships, 2 Jobs, 2 obras (1 verificada), 2 vínculos |
| `apply` otra vez | mismos conteos (idempotente) |
| `rollback` | 0 filas `pilot_seed_*`; los usuarios y la Org propia, intactos |
| correo WORKER inexistente | exit 1, transacción revertida, nada escrito |
| fuera del staging autorizado | exit 2, sin conexión a la base (tests unitarios) |

## Pruebas en los teléfonos (misma cuenta WORKER)

Ver `GATE5_DEVICE_TEST_SCRIPT.md` §3: un teléfono a la vez, sin relojes activos entre pruebas.
