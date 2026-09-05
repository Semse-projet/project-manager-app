# WorkItem: CP-REL-002 — candidato canónico F1–F4 sobre producción

**Estado:** DEPLOYED_VERIFIED  
**Riesgo:** critical  
**Fecha local:** 2026-07-23  
**Spec:** `platform.semse-os-control-plane`  
**Alcance:** F1–F4 exclusivamente

## Autoridad de esta ejecución

El owner autorizó primero preparar el candidato F1–F4 sobre el commit productivo
vigente. El 2026-07-23 autorizó después el despliegue productivo de CP-REL-002,
ligado inequívocamente a la base `88394934`, al digest runtime `74f12cc5` y al
digest canónico `8c6be2f9`.

La autorización productiva no incluyó:

- push, PR, actualización de rama o publicación en GitHub;
- migraciones manuales contra PostgreSQL productivo;
- F5+, endpoints capability, RBAC de capability o reconciler productivo.

## Identidad inmutable del candidato

| Campo | Valor |
| --- | --- |
| Repositorio | `Semse-projet/project-manager-app` |
| Base/HEAD | `88394934fb42b2e7848a1bc3584473bc118c869a` |
| Estado de HEAD al sellar | GitHub y API/worker/web productivos coinciden |
| Payload runtime | 44 archivos |
| Digest runtime | `sha256:74f12cc52278c94e5e7d98181fb49ddd8cc63e5544a5ec3d1ca6db4659623859` |
| Integración canónica | 79 archivos |
| Digest canónico | `sha256:8c6be2f91e84a2bacb68c91b1e9be31b8bafa71a56a111053468a65e2f32c2f0` |
| Directorio local | `release-candidates/semse-f1-f4-883949/project-manager-app` |

Los digests son el SHA-256 del manifiesto UTF-8 sin BOM. Cada línea tiene
`estado<TAB>path<TAB>sha256`, está ordenada ordinalmente por path y el archivo
termina en LF. Los manifiestos están en:

- `docs/agents/release-manifests/SEMSE_OS_CONTROL_PLANE_F1_F4_2026-07-23.runtime.sha256`;
- `docs/agents/release-manifests/SEMSE_OS_CONTROL_PLANE_F1_F4_2026-07-23.canonical.sha256`.

El digest canónico se calculó antes de agregar los dos manifiestos, este
WorkItem y el informe de pre-release; así se evita una dependencia circular.

## Base productiva observada antes del despliegue

| Servicio | Deployment activo | Estado | Commit |
| --- | --- | --- | --- |
| `semse-API` | `b5df3af8-b096-4b69-9787-b484204a44ce` | `SUCCESS` | `88394934…` |
| `semse-worker` | `b16aeb97-b958-4273-a202-994b5289f144` | `SUCCESS` | `88394934…` |
| `semse-web` | `50c22db9-4b6a-497d-a8a6-a0316a5eb553` | `SUCCESS` | `88394934…` |

Estos IDs son anclas de rollback/diagnóstico, no una autorización para ejecutar
un rollback.

## Gates completados

- frozen lockfile offline: PASS;
- workspace validator: PASS;
- SDD strict: 95 specs, 0 errores, 0 warnings;
- Prisma 6.19.3 validate/generate: PASS;
- 73 migraciones sobre PostgreSQL efímero desde cero, incluida F4: PASS;
- integración F4 final: 8 pass, 0 fail, 0 skip;
- builds de 11 paquetes, API y web: PASS;
- web: 402 páginas estáticas generadas;
- typecheck API/web y syntax check worker: PASS;
- suite unitaria: 976 tests, 966 pass, 0 fail, 10 skip;
- Graphify/control-plane API harness: 9 pass, 0 fail, 5 skip F5;
- Dockerfile workspace coverage y diff-check: PASS.

Los 10 skips corresponden a contratos reservados para fases posteriores y no
se habilitaron fuera del alcance F1–F4.

## Stop conditions del release

Antes de cualquier mutación productiva se debe detener el release si:

1. el HEAD canónico o cualquiera de los tres servicios deja de apuntar a
   `88394934fb42b2e7848a1bc3584473bc118c869a`;
2. cambia cualquiera de los dos digests;
3. la aprobación del owner no cita de forma inequívoca este WorkItem/candidato;
4. el pre-deploy propone `db push`, reset, seed, DML manual o una operación
   destructiva;
5. falla un build, pre-deploy, health/readiness o aparece un 5xx atribuible al
   release.

## Resultado productivo

La autorización fue consumida sin ampliar alcance. Los tres uploads locales
quedaron en estado terminal `SUCCESS`:

| Servicio | Deployment CP-REL-002 | Estado |
| --- | --- | --- |
| `semse-API` | `4f66595d-0144-4d4f-a417-31459cf77e13` | `SUCCESS` |
| `semse-worker` | `603fcb15-9998-4824-8db4-c62023fb88b3` | `SUCCESS` |
| `semse-web` | `7d19f1de-560b-4c65-82ba-27f944064912` | `SUCCESS` |

Comprobaciones posteriores a la promoción:

- API `/v1/health`: HTTP 200;
- API `/v1/ready`: HTTP 200, database/migrations/Redis/worker/storage `ok`;
- web `/api/semse/healthz`: HTTP 200;
- web `/`: HTTP 200;
- logs API: 0 errores y 0 respuestas 5xx;
- logs worker: 0 errores; heartbeat operativo y loop permanente programado;
- logs web: 0 respuestas 5xx y una advertencia no bloqueante de `metadataBase`;
- PostgreSQL: seis tablas `Capability*` presentes;
- migración `20260719000000_semse_os_capability_control_plane`: `finished=true`.

No se ejecutó DDL/DML manual, cambio de variables, rollback, push, commit ni PR.
El informe completo está en
`docs/reportes/RAILWAY_PRODUCTION_RELEASE_CP_REL_002_2026_07_23.md`.
