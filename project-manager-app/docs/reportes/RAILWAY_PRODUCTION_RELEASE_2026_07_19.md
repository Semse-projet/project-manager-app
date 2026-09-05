# Railway Production Release — 2026-07-19

Estado: `DEPLOYED_VERIFIED_WITH_DOCUMENTED_CONFIG_DEBT`.

> Revalidación 2026-07-23: los deployments de este release ya no son los
> activos. Railway los sustituyó por auto-deploys del commit canónico
> `f60c60b048d6900c1a393cab1ed095b7a3d94e7d`. El entorno está sano, pero ese
> snapshot no contiene `packages/control-plane` ni la migration F4. Ver
> [`RAILWAY_PRODUCTION_REVALIDATION_2026_07_23.md`](RAILWAY_PRODUCTION_REVALIDATION_2026_07_23.md).

El release directo del workspace fue bloqueado porque su delta contra `main`
eliminaba 113 archivos productivos. Se creó un candidato limpio sobre
`c9c60cac5b63c763b1a683faa6c52842cb285691` y se superpusieron únicamente
F1–F4, el kit Dev Container validado, las correcciones de portabilidad y el
hardening fail-closed de migraciones.

Digest del candidato:
`9d7cc04a830be473b975070811adf3250040232c29f4c9c238ee3501f3e80778`.

La deuda del historial Prisma quedó resuelta recuperando del repositorio
canónico las seis migrations que estaban aplicadas en production pero ausentes
del checkout. La comprobación final reconoce 70 migrations y únicamente
`20260719000000_semse_os_capability_control_plane` como pendiente.

El respaldo lógico anterior al cambio está en
`C:\Users\SEMSEproject\backups\semse-production-predeploy-20260719.dump`, con
SHA-256
`f21fbd2295d072956af6df7941ac43639b6281c0c1c07da0e6723e277693a301`.
La clave SSH temporal se revocó y no se conservan sus copias privadas.

Gates verdes: instalación congelada, Prisma validate, preflight completo,
Dockerfile coverage, 972 tests unitarios sin fallos y spec strict 78/78 sin
errores ni warnings.

La aprobación explícita quedó ligada al WorkItem SHA-256
`397bdbe939d19b562993c4a2a48104d7d9ab868b7a40a942b8cfe0838a124ca4` y al
release digest indicado arriba.

## Resultado productivo

- API final: `b2d8148a-83a0-426d-8152-204b9f1c3cec` (`SUCCESS`).
- Worker final activo: `fce3d9b6-15ef-4f72-9a9c-fff773cfbec1` (`SUCCESS`).
- Web final: `66fa29f1-d997-4d85-8c5c-8cec8852ea6b` (`SUCCESS`).
- F4 aplicada y registrada; `prisma migrate status` confirma 70/70 al día.
- Seis tablas `Capability*` verificadas mediante consulta SQL read-only.
- Contraseña PostgreSQL rotada y validada; API y worker resuelven la credencial
  nueva. Ningún valor secreto fue registrado en este reporte.
- Smoke tests: API health 200, API readiness 200, web health 200 y web root 200.
- Worker: 0 líneas con indicadores críticos en la muestra de logs posterior a
  la rotación.

## Incidencia de configuración

El config-as-code de API no fue consumido por Railway durante el upload local;
la metadata efectiva mantuvo `preDeployCommand=[]`. F4 se aplicó manualmente
con el mismo comando fail-closed (`prisma migrate deploy`) y se verificó antes
de continuar. `railway environment edit` 5.27.0 devolvió éxito sin persistir el
binding y generó redeploys tardíos desde GitHub, que fueron neutralizados
esperando estabilidad y repitiendo los uploads del candidato.

Queda una deuda operativa explícita para el próximo release: integrar primero
el candidato en la fuente canónica o fijar el binding del config-as-code desde
Railway y comprobar en la metadata efectiva el pre-deploy revisado. Hasta
resolverla, las migrations de producción requieren ejecución y verificación
explícitas antes de promover API.
