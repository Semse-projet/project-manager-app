# Release productivo Railway — CP-REL-002

**Fecha local:** 2026-07-23  
**Resultado:** DEPLOYED_VERIFIED  
**Producción modificada:** sí, únicamente API/worker/web  
**Entorno Railway:** `production` (`d682210a-956a-4508-9c5b-4ca5959278f9`)

## Autorización consumida

El owner autorizó explícitamente:

> Autorizo el despliegue productivo de CP-REL-002 sobre base 88394934 con los
> digests runtime 74f12cc5 y canónico 8c6be2f9.

La autorización se vinculó a estos valores completos:

| Campo | Valor |
| --- | --- |
| Base/HEAD | `88394934fb42b2e7848a1bc3584473bc118c869a` |
| Runtime | `sha256:74f12cc52278c94e5e7d98181fb49ddd8cc63e5544a5ec3d1ca6db4659623859` |
| Canónico | `sha256:8c6be2f91e84a2bacb68c91b1e9be31b8bafa71a56a111053468a65e2f32c2f0` |
| Proyecto Railway | `95ad1b14-d1d9-467d-82d8-5354619ba873` |

Inmediatamente antes de la primera mutación se revalidaron el HEAD remoto, los
79 paths del manifiesto canónico, los hashes de todos los archivos y ambos
digests. No hubo paths ausentes, inesperados ni hashes divergentes. API, worker
y web seguían en `SUCCESS` sobre la base autorizada.

## Despliegues promovidos

| Servicio | Service ID | Deployment CP-REL-002 | Estado terminal |
| --- | --- | --- | --- |
| `semse-API` | `2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770` | `4f66595d-0144-4d4f-a417-31459cf77e13` | `SUCCESS` |
| `semse-worker` | `26cd1c52-1a07-4f05-8b21-9a225e601d7a` | `603fcb15-9998-4824-8db4-c62023fb88b3` | `SUCCESS` |
| `semse-web` | `40ab1cd0-b0a6-4760-a43f-8742c1962ef7` | `7d19f1de-560b-4c65-82ba-27f944064912` | `SUCCESS` |

Los mensajes de despliegue registran `CP-REL-002`, base `88394934`, runtime
`74f12cc5` y canónico `8c6be2f9`. Railway muestra commit `-` porque fueron
uploads del árbol local sellado; por eso la procedencia se prueba con los
deployment IDs, los mensajes auditables y los manifiestos SHA-256.

Los predecesores
`b5df3af8-b096-4b69-9787-b484204a44ce`,
`b16aeb97-b958-4273-a202-994b5289f144` y
`50c22db9-4b6a-497d-a8a6-a0316a5eb553` quedaron `REMOVED` después de la
promoción. Se conservan como referencia histórica, no como réplicas activas.

## Verificación posterior

| Comprobación | Resultado |
| --- | --- |
| API `GET /v1/health` | HTTP 200; `status=ok`, `service=semse-api`, `persistence=prisma` |
| API `GET /v1/ready` | HTTP 200; database, migrations, Redis, worker y storage `ok` |
| Web `GET /api/semse/healthz` | HTTP 200; `status=ok`, `service=semse-web` |
| Web `GET /` | HTTP 200 |
| HTTP API 5xx | 0 |
| HTTP web 5xx | 0 |
| Logs API nivel error | 0 |
| Logs worker, muestra acotada | 13 registros; 0 errores; 4 marcadores operativos |
| Logs web nivel error | 1 advertencia no bloqueante; 0 fallos de request |

La muestra positiva del worker contiene la finalización de los motores de
inteligencia y la programación de su loop permanente. Además, readiness
confirmó el heartbeat del worker después de su promoción.

La comprobación SQL final fue exclusivamente de lectura y confirmó:

- `CapabilityDefinition`;
- `CapabilityExecutionReceipt`;
- `CapabilityInstallation`;
- `CapabilityOperation`;
- `CapabilityOperationApproval`;
- `CapabilityRuntimeTarget`;
- migración `20260719000000_semse_os_capability_control_plane` con
  `finished=true`.

No se ejecutó `db push`, reset, seed, DDL, DML ni edición manual de datos.

## Dominios y observaciones no bloqueantes

- API Railway activa:
  `https://project-manager-app-production-977f.up.railway.app`;
- web Railway activa:
  `https://semse-web-production.up.railway.app`;
- ambos dominios generados figuran `ACTIVE`;
- `https://api.semseproject.com` cerró el handshake TLS desde la máquina de
  verificación y no apareció entre los dominios asociados por Railway. Es una
  deuda separada de DNS/edge; los health checks del dominio Railway sí pasan;
- el único log web clasificado como error es la advertencia de Next.js por
  `metadataBase` ausente al resolver imágenes sociales;
- la configuración efectiva consultada no expuso un `preDeployCommand`
  persistido. La base no tenía migraciones fallidas/incompletas y F4 quedó
  aplicada, pero el binding del pre-deploy debe corregirse antes de un release
  futuro que dependa de una migración nueva.

## Límites respetados

No se cambiaron variables, dominios, réplicas ni servicios auxiliares. Tampoco
se hizo rollback, push, commit, PR ni publicación en GitHub. F5+, endpoints
capability, RBAC capability y reconciler productivo quedaron fuera de alcance.

Este informe y la actualización del WorkItem son evidencia generada después
del sellado; no forman parte del digest canónico autorizado y no alteran el
runtime desplegado.
