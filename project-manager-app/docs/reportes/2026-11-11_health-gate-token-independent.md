# Production Health Gate único sin dependencia de RAILWAY_TOKEN (consolida #1143 + #1145)

**Fechas:** 2026-11-11 (versión inicial #1143) · 2026-11-12 (consolidación) · **Rama:** `ci/health-gate-token-independent`
**Autorización:** el dueño pidió el PR técnico el 2026-11-11 y la consolidación el 2026-11-12. Sin merge, deploy ni cambios de secretos o infraestructura.

## Problema

Desde el 2026-10-26, el paso con token de `railway-deploy.yml` falla con `Not Authorized`. `health-check` dependía de él y quedaba `skipped`, y `Production Health Gate` (`deploy.yml`) exige `Railway Deploy = success`, así que tampoco corría. Producción se sigue desplegando por la integración nativa GitHub→Railway, pero durante más de dos semanas ningún deploy pasó por el gate de procedencia (C02).

## Hechos verificados (Railway, solo lectura, 2026-11-12)

| Servicio | `checkSuites` | `watchPatterns` | Observación |
|---|---|---|---|
| semse-API | `false` | `project-manager-app/**` | `preDeployCommand: node scripts/pre-migrate.mjs` |
| semse-web | `false` | `project-manager-app/**` | — |
| semse-worker | `false` | `project-manager-app/**` | sin endpoint público de procedencia |
| semse-vision | `false` | (rootDirectory `apps/vision-service`) | sin endpoint público de procedencia |

- `checkSuites:false`: Railway **no espera a CI**; despliega cada push a `main`.
- Lectura pública de `/v1/health` y `/api/semse/healthz`: ambos sirven `gitSha=7e80dd0…` (= HEAD de `main`), con `deploymentId` y `environment=production` presentes e `imageDigest=unknown`.

## Comparación y decisión

| Criterio | #1143 (job en workflow existente) | #1145 (workflow nuevo) | Solución consolidada |
|---|---|---|---|
| Duplicidad | no | **sí**: segundo consumidor de CI con la misma verificación; el workflow viejo sigue roto | un solo gate |
| Cadena `deploy.yml` (smoke) | se reactiva | sigue sin correr | se reactiva |
| Fork con rama `main` | `if` vulnerable (solo `head_branch`) | endurecido (`event` + `head_repository`) | endurecido en `deploy` (que usa el token) |
| `main` avanza / merges agrupados | skip superseded | `concurrency cancel-in-progress` (puede dejar sin verificar un SHA intermedio sin aviso) | skip superseded + re-chequeo si `main` avanza **durante** la espera |
| Commit que solo toca `.github/` | **falso rojo** (SHA nunca servido) | **falso rojo** | exige el último commit que tocó `project-manager-app/**` |
| CI rojo y Railway lo despliega igual | sin detección | sin detección | alarma de solo lectura (`production-unvalidated-deploy-alarm.yml`) |
| API/Web en paralelo, `timeout` | no | sí | sí |
| Worker/Vision | solo con token | no | solo con token; **declarado NO verificado** en el summary |

**Decisión:** mantener el gate como job de `railway-deploy.yml` (#1143), porque `deploy.yml` depende de ese workflow, y portar lo mejor de #1145. **#1145 queda sustituido**: cerrarlo es decisión del dueño.

La alarma va en un workflow aparte a propósito: si fuera un job de `Railway Deploy`, una alarma verde dejaría ese workflow en `success` y dispararía `Production Health Gate` como si hubiera un deploy validado.

## Qué ocurre si Railway despliega antes de terminar CI

Con `checkSuites:false`, eso es lo **normal**: Railway construye cada push a `main` en paralelo a CI.

| Escenario | Qué sirve producción | Qué hace CI/CD | Resultado |
|---|---|---|---|
| CI verde, build nativo listo antes | el SHA X | `health-check` exige X → pasa | ✅ verificado |
| CI verde, build nativo aún compilando | el anterior, luego X | el gate reintenta hasta 20 min (80 × 15 s) | ✅ cuando se sirve X; ❌ si no llega a tiempo |
| CI verde, build nativo falla | el anterior | el gate no ve X | ❌ fail closed |
| Commit X solo en `.github/` | el último commit desplegable | se exige ese commit | ✅ sin falso rojo |
| X superado por Y antes del gate | Y (o X un instante) | gate de X termina con aviso; lo cubre el run de Y | depende del run de Y |
| **CI rojo en X** | **X igualmente** (y `pre-migrate` ya aplicó sus migraciones) | `Railway Deploy` no corre; la **alarma** vigila 20 min | ❌ alarma roja si API o Web sirven X |
| CI rojo y build lento (> 20 min) | X más tarde | la alarma ya terminó | ⚠️ **no detectado**: ventana acotada |

Límites que siguen abiertos (decisión del dueño):

- La alarma **detecta, no previene**: no hace rollback, y las migraciones de `pre-migrate` ya se aplicaron. La prevención real es activar **"Wait for CI"** (`checkSuites`) en Railway, un cambio de infraestructura de producción que no se tocó aquí.
- Worker y Vision solo se verifican con un `RAILWAY_TOKEN` válido. Renovarlo es tarea del dueño.

## Validación

- `actionlint` 1.7 con `shellcheck`: 0 hallazgos en `railway-deploy.yml` y `production-unvalidated-deploy-alarm.yml`.
- Paso bloqueante del gate extraído del YAML y ejecutado contra servidores de health simulados:
  - API y Web en el SHA esperado → exit 0;
  - Web viejo y `main` sin cambios → exit 1;
  - `main` avanzó durante la espera → exit 0 con aviso;
  - health sin `gitSha` válido → exit 1.
- Alarma extraída del YAML:
  - API sirve el SHA rojo → exit 1;
  - Web lo sirve → exit 1;
  - ninguno lo sirve → exit 0;
  - commit solo `.github/` (`3cf9c55`) → exit 0 con aviso.
- Resolución del SHA esperado con historia real: `3cf9c55` (bump de Dependabot, solo `.github/`) → `54353de`. El gate anterior habría fallado en ese commit.
- **Límite:** `workflow_run` usa el workflow de la rama por defecto, así que no se puede ejecutar antes del merge. Hay que revisar el primer run real tras fusionar: el gate tras un CI verde de `main` y la alarma tras el primer CI rojo.

## Rollback

Revertir el merge en `main`. Vuelve el comportamiento anterior (gate `skipped` mientras el token falle) y no hay estado que limpiar.
