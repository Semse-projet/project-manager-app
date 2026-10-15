# Runbook — smoke autenticado de S0 con dos usuarios (T-062)

**Spec:** [`labor.free-project-mutation-guard`](../specs/labor/free-project-mutation-guard.spec.md) §8.
**Script:** [`scripts/labor-s0-free-project-smoke.mjs`](../../scripts/labor-s0-free-project-smoke.mjs) (Node 22, sin dependencias).
**Ejecuta:** un operador autorizado por el owner, con dos cuentas de prueba.

## Qué comprueba

| Id | Caso | Esperado |
|---|---|---|
| N1-lectura | A hace `PATCH {}` sobre el proyecto de B | 404 y la respuesta no trae el nombre de B |
| N1 | A cambia el nombre del proyecto de B | 404 |
| N2 | A archiva (`DELETE`) el proyecto de B | 404 |
| N1-conv | A convierte el proyecto de B | 404 |
| B-intacto | B relee su proyecto | mismo nombre, `active`, sin Job |
| N12 | B manda `status` en `PATCH` | 400 |
| Propio | B edita su propio proyecto | 2xx |
| N5 | A convierte su proyecto a un Job inexistente | 403 genérico |
| P1 | A convierte su proyecto al Job asignado | 2xx, `converted`, `convertedJobId` = Job |
| P2 | A repite la misma conversión | 2xx (idempotente) |
| N9 | A reconvierte a otro Job | 409 |
| Archivar / P2-arch | B archiva su proyecto dos veces | 2xx y 2xx (idempotente) |

## Requisitos

- **Dos cuentas de prueba (A y B) del mismo tenant**, creadas para esto y
  autorizadas por el owner, con un rol que tenga `field-ops:write` (`WORKER`
  o `PRO`). Nunca cuentas ni proyectos de personas reales.
- **Un Job asignado a A**: uno que aparezca en el selector de trabajos del
  Time Tracker de A (`GET /v1/time-tracker/jobs`; la asignación por
  organización también cuenta, D8). La conversión sólo escribe el proyecto
  sintético de A; el Job no se modifica. Sin este Job el resultado queda
  `INCOMPLETE`.
- Node 22 y una copia del repositorio. No hace falta `pnpm install`.

## Qué escribe

- Dos FreeProject `SMOKE-S0 <runId> A|B`, uno por usuario. El de A queda
  convertido al Job (referencia histórica) y los dos se archivan al final.
  Nada se borra.
- Filas de AuditLog `free_project.converted` y `free_project.archived` de esos
  proyectos.
- Una sesión por usuario, cerrada (`/v1/auth/logout`) al terminar.

No toca otros proyectos, Jobs ni registros de horas. No imprime correos,
contraseñas ni tokens.

## Ejecución

Las credenciales van sólo en variables de entorno de la sesión, nunca en
argumentos, archivos del repo, tickets ni chats.

PowerShell (Windows):

```powershell
cd project-manager-app
$env:SEMSE_SMOKE_API_URL = "https://api.semseproject.com"
$env:SEMSE_SMOKE_A_EMAIL = "<correo de prueba A>"
$env:SEMSE_SMOKE_B_EMAIL = "<correo de prueba B>"
$env:SEMSE_SMOKE_JOB_ID  = "<id del Job asignado a A>"
$plain = { param($s) [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
$env:SEMSE_SMOKE_A_PASSWORD = & $plain (Read-Host -AsSecureString "Contraseña A")
$env:SEMSE_SMOKE_B_PASSWORD = & $plain (Read-Host -AsSecureString "Contraseña B")

node scripts/labor-s0-free-project-smoke.mjs                  # plan, no escribe
node scripts/labor-s0-free-project-smoke.mjs --yes --out smoke-s0.json

Remove-Item Env:SEMSE_SMOKE_A_PASSWORD, Env:SEMSE_SMOKE_B_PASSWORD
```

bash:

```bash
cd project-manager-app
export SEMSE_SMOKE_API_URL=https://api.semseproject.com
export SEMSE_SMOKE_A_EMAIL='<correo de prueba A>' SEMSE_SMOKE_B_EMAIL='<correo de prueba B>'
export SEMSE_SMOKE_JOB_ID='<id del Job asignado a A>'
read -rsp "Contraseña A: " SEMSE_SMOKE_A_PASSWORD; echo; export SEMSE_SMOKE_A_PASSWORD
read -rsp "Contraseña B: " SEMSE_SMOKE_B_PASSWORD; echo; export SEMSE_SMOKE_B_PASSWORD

node scripts/labor-s0-free-project-smoke.mjs                  # plan, no escribe
node scripts/labor-s0-free-project-smoke.mjs --yes --out smoke-s0.json

unset SEMSE_SMOKE_A_PASSWORD SEMSE_SMOKE_B_PASSWORD
```

El login admite 5 intentos por minuto; si el script dice `429`, espera un
minuto antes de repetir.

## Resultado

| Código | Significado |
|---|---|
| 0 | `PASS`: todos los casos pasaron |
| 1 | `FAIL`: al menos un caso falló |
| 2 | `INCOMPLETE`: todo pasó, pero sin `SEMSE_SMOKE_JOB_ID` no se probó P1 |
| 3 | Precondición: configuración, login, usuarios distintos del mismo tenant o Job no asignado a A |

Ante un `FAIL` en producción: corregir hacia adelante con un PR nuevo y
**nunca** volver a un deployment sin el guard (spec §7, D7).

## Registro

En el reporte de S0 (`docs/reportes/2026-10-15_labor-s0-free-project-guard.md`)
anotar sólo: fecha y hora UTC, SHA desplegado de `semse-API`, `runId`,
veredicto, y los `requestId` de los casos (`smoke-s0-<runId>-NN`, sirven para
buscar cada llamada en los logs). El archivo `--out` ya trae ese contenido sin
datos personales. No se registran correos, contraseñas ni nombres.
