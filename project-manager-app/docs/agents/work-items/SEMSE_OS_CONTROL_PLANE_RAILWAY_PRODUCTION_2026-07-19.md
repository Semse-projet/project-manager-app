---
type: work-item
feature: "SEMSE OS Capability Control Plane"
domain: "platform"
environment: "production"
date: "2026-07-19"
risk: "critical"
status: "EXECUTED_VERIFIED_WITH_DOCUMENTED_CONFIG_DEBT"
base_sha: "c9c60cac5b63c763b1a683faa6c52842cb285691"
release_digest: "9d7cc04a830be473b975070811adf3250040232c29f4c9c238ee3501f3e80778"
migration_sha256: "73dbf86020ffb7725626eaa5f9ce9ffc8ca5ae2708b8aa53651c498022760cfe"
lockfile_sha256: "6d43e8a610ce9459455cd4d112ec95cfb6ba29e770a99a64aa4b998edf5472f5"
production_intent_quote: "va a railway produccion"
---

# WorkItem: Railway production — SEMSE OS F1–F4

## Autoridad y separación del task graph

Este WorkItem registra la intención humana de publicar en Railway production,
pero no modifica el digest aprobado de
`docs/specs/platform/semse-os-control-plane.tasks.md`, no marca F5+ como
completa y no afirma que el control plane esté activo. El release contiene
únicamente el núcleo F1–F4 no conectado a endpoints/executor, la migration F4
aditiva y hardening del proceso de migración.

La mutación de esquema y la rotación de una credencial productiva requieren
una confirmación final ligada al `release_digest` anterior. Hasta recibirla,
ningún `railway up`, cambio de variable, migration o redeploy está autorizado
por este paquete.

## Fuente exacta

- Base canónica: `Semse-projet/project-manager-app@c9c60ca` (`main`).
- Release candidate:
  `C:\Users\SEMSEproject\AppData\Local\Temp\semse-prod-base-20260719`.
- Delta: 44 archivos, calculado como estado + ruta + SHA-256 por archivo.
- No se despliega directamente el workspace divergente: frente a `main`
  eliminaría 113 archivos productivos de Prometeo, Sense Workspace, Forge y
  migraciones.
- Se restauraron en el workspace y en el candidato las seis migraciones que
  production ya tenía aplicadas. No se falsificaron checksums ni se reescribió
  `_prisma_migrations`.

## Targets congelados

- Project: `SEMSEproject` (`95ad1b14-d1d9-467d-82d8-5354619ba873`).
- Environment: `production` (`d682210a-956a-4508-9c5b-4ca5959278f9`).
- API: `2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770`.
- Worker: `26cd1c52-1a07-4f05-8b21-9a225e601d7a`.
- Web: `40ab1cd0-b0a6-4760-a43f-8742c1962ef7`.
- PostgreSQL: `7e1fefc3-4a4c-47ba-a1e7-89baea5a1446`.

## Cambio de datos

La única migration pendiente es
`20260719000000_semse_os_capability_control_plane`. Crea enums, seis tablas,
índices, constraints y foreign keys; no altera, borra ni rellena tablas
existentes. Railway ejecutará exclusivamente `prisma migrate deploy` en
`preDeployCommand`. El arranque de API no muta esquema ni datos.

Estado read-only verificado: 70 migrations locales, historial production
completo y solo F4 pendiente.

## Secuencia autorizable

1. Verificar que base SHA, digest del delta, migration y lockfile no cambiaron.
2. Establecer `SEMSE_DEMO_MODE=false` correctamente en API sin disparar un
   deployment separado.
3. `railway up` de API desde el candidato; el pre-deploy aplica F4 y falla
   cerrado. Esperar estado terminal `SUCCESS` y readiness.
4. Confirmar migration aplicada y existencia de las seis tablas nuevas.
5. `railway up` de worker; esperar `SUCCESS` y logs sanos.
6. `railway up` de web; esperar `SUCCESS`, health HTTP y rutas públicas.
7. Rotar en memoria la contraseña PostgreSQL expuesta durante la inspección,
   actualizar `POSTGRES_PASSWORD`, cambiar el rol dentro de una ventana
   coordinada y redeployar API/worker para consumir la referencia nueva.
8. Verificar deployments, logs acotados, health/readiness, Web y acceso DB.
9. Completar el reporte productivo con IDs, timestamps y evidencia redactada.

## Backup y rollback

- Backup lógico validado:
  `C:\Users\SEMSEproject\backups\semse-production-predeploy-20260719.dump`.
- Bytes: `9337921`.
- SHA-256:
  `f21fbd2295d072956af6df7941ac43639b6281c0c1c07da0e6723e277693a301`.
- La copia temporal remota fue eliminada y la clave SSH temporal fue revocada;
  sus cuatro archivos locales también fueron retirados.
- Base de rollback de servicios:
  API `8bf3d183-146e-4416-a75b-b6180c43dbc4`, worker
  `7f42571b-ed70-4f42-9247-3b21d8ce1138`, web
  `5a2a6fa7-0eb7-4c40-8e37-9914874a3426`, todos `SUCCESS`.
- La migration es aditiva y permanece al hacer rollback de aplicación. Un
  rollback destructivo de esquema queda prohibido; restaurar el dump requiere
  una autorización separada.

## Evidencia pre-release

- `pnpm install --frozen-lockfile`: PASS (20 workspaces).
- Prisma validate: PASS.
- `prisma migrate status` production read-only: 70 migrations; solo F4
  pendiente.
- Tests focalizados: 22 PASS, 5 SKIP F6, 0 FAIL.
- `railway:preflight`: PASS en 572.1 s.
- Suite unitaria: 972 total, 962 PASS, 10 SKIP, 0 FAIL.
- Dockerfile workspace coverage: PASS.
- Spec validation estricta del workspace: 78 specs, 0 errores, 0 warnings.
- Advertencia no bloqueante preexistente: `pnpm.overrides` de
  `apps/assistant-portal` debe vivir en la raíz.

## Stop conditions

Detener y conservar los deployments anteriores si cambia cualquier digest,
si la migration deja de ser la única pendiente, si el pre-deploy falla, si un
servicio no alcanza `SUCCESS`, si health/readiness falla, si aparecen errores
de autenticación/DB o si la rotación de credencial no puede verificarse sin
mostrar secretos.

## Ejecución autorizada y resultado

La ejecución fue autorizada explícitamente con el WorkItem SHA-256
`397bdbe939d19b562993c4a2a48104d7d9ab868b7a40a942b8cfe0838a124ca4` y el
release digest
`9d7cc04a830be473b975070811adf3250040232c29f4c9c238ee3501f3e80778` para
aplicar F4, desplegar API/worker/web y rotar coordinadamente PostgreSQL.

Resultado final verificado:

- API: `b2d8148a-83a0-426d-8152-204b9f1c3cec`, `SUCCESS`, deployment activo y
  misma imagen que el upload estable del candidato.
- Worker: `fce3d9b6-15ef-4f72-9a9c-fff773cfbec1`, `SUCCESS`, deployment activo,
  sin líneas con palabras críticas `error`, `fatal` o `panic` en la muestra
  posterior a la rotación. El upload local posterior
  `3780edf1-606c-4953-b83e-6261edecb8bf` quedó `SKIPPED` por snapshot sin
  cambios.
- Web: `66fa29f1-d997-4d85-8c5c-8cec8852ea6b`, `SUCCESS`, deployment activo y
  misma imagen que el upload estable del candidato.
- HTTP: API `/v1/health` 200, API `/v1/ready` 200, web
  `/api/semse/healthz` 200 y web `/` 200.
- PostgreSQL: contraseña rotada sin escribirla en archivos ni salida; las
  variables `POSTGRES_PASSWORD` y `PGPASSWORD`, el URL público y las referencias
  `DATABASE_URL` de API/worker convergen en la credencial nueva.
- Prisma: `migrate status` confirma esquema actualizado. F4 está registrada
  como terminada y existen exactamente seis tablas `Capability*`:
  `CapabilityDefinition`, `CapabilityExecutionReceipt`,
  `CapabilityInstallation`, `CapabilityOperation`,
  `CapabilityOperationApproval` y `CapabilityRuntimeTarget`.

## Incidencias resueltas durante el release

1. El primer `railway up project-manager-app` fue rechazado con
   `prefix not found`. El upload correcto se realizó desde la raíz del candidato
   sin argumento de ruta, preservando `rootDirectory=project-manager-app`.
2. Railway no consumió `infra/railway/api.railway.json`: el manifest efectivo
   mostró `preDeployCommand=[]`. F4 se aplicó de forma explícita y fail-closed
   con `prisma migrate deploy`, seguida por `migrate status` y comprobación SQL
   read-only de historial y tablas.
3. Cuatro intentos de `railway environment edit` devolvieron éxito sin
   persistir `configFile` ni los valores del harness y encolaron redeploys
   tardíos desde la fuente GitHub. Se esperó una ventana estable de más de
   23 minutos y se repitieron los uploads locales para dejar activos los
   artefactos aprobados.
4. La rotación se abortó dos veces antes de cambiar el rol: primero por APIs
   criptográficas no disponibles en el .NET local y luego porque el proceso no
   se ejecutó desde la raíz con `@prisma/client`. Ambos intentos restauraron las
   variables antes de `ALTER ROLE`. El intento definitivo rotó y validó la
   credencial; después se reparó la referencia materializada del worker y se
   redeployaron API/worker.

## Deuda operativa aislada

El dashboard efectivo de API continúa con `preDeployCommand=[]`, timeout 30 s
y sin binding persistido al config-as-code revisado, aunque el archivo del
repositorio es correcto. No se volvió a usar `environment edit` porque sus
redeploys desde GitHub sustituían el candidato local. Antes del siguiente
release debe cumplirse una de estas dos condiciones:

1. integrar el candidato aprobado en la fuente GitHub canónica y entonces
   vincular `/project-manager-app/infra/railway/api.railway.json`; o
2. corregir el binding desde Railway con una ventana controlada y confirmar en
   metadata efectiva `preDeployCommand=["node scripts/pre-migrate.mjs"]`.

Hasta entonces, todo release con migrations debe ejecutar y verificar
`prisma migrate deploy` explícitamente antes de promover API. Esta deuda no
afecta el estado actual: F4 ya está aplicada, los servicios están sanos y la
rotación está verificada.
