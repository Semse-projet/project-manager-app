# Pre-release Railway — SEMSE OS Control Plane F1–F4

**Fecha local:** 2026-07-23  
**Resultado:** READY_FOR_OWNER_RELEASE_APPROVAL  
**Producción modificada:** no

## Resumen

Se reconstruyó el candidato F1–F4 sobre el commit que estaba realmente activo
en producción al cierre:

`88394934fb42b2e7848a1bc3584473bc118c869a`

La preparación comenzó sobre `f60c60b…`, pero GitHub/Railway avanzaron primero
a `5d9ca8d…` y después a `88394934…`. En ambos casos se detuvo el sellado, se
portó el overlay a un clon limpio y se comprobó que las deltas upstream no
solapaban los archivos F1–F4. Esto evita que el release revierta las PR #408,
#409 o #410.

## Artefactos sellados

| Artefacto | Archivos | Digest |
| --- | ---: | --- |
| Payload runtime F1–F4 | 44 | `sha256:74f12cc52278c94e5e7d98181fb49ddd8cc63e5544a5ec3d1ca6db4659623859` |
| Integración canónica F1–F4 | 79 | `sha256:8c6be2f91e84a2bacb68c91b1e9be31b8bafa71a56a111053468a65e2f32c2f0` |

El payload runtime contiene código, schemas, migration, lockfile, scripts,
Docker/Railway y tests. La integración canónica añade spec, plan, tasks,
contratos, verificación, ADR, threat model, TaskPackets, DecisionPackages,
WorkItems históricos e índices foundation.

## Evidencia de validación

| Gate | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | PASS; lockfile vigente |
| `validate:workspace` | PASS |
| `spec:validate:strict` | 95 specs; 0 errores; 0 warnings |
| `spec:coverage` | ejecutado; deuda global registrada, sin gate fallido |
| Prisma validate/generate 6.19.3 | PASS |
| Migraciones sobre PostgreSQL efímero nuevo | 73/73 PASS, F4 incluida |
| Integración PostgreSQL F4 final | 8 pass; 0 fail; 0 skip |
| Paquetes workspace | 11/11 build PASS |
| API | build PASS |
| Web exacta con PR #410 | build PASS; 402 páginas |
| API/web typecheck | PASS |
| Worker syntax check | PASS |
| Suite unitaria completa | 976 total; 966 pass; 0 fail; 10 skip |
| Graphify + contratos API capability | 9 pass; 0 fail; 5 skip F5 |
| Dockerfile workspace coverage | PASS |
| `git diff --check` | PASS |

La suite unitaria requiere compilar API antes de ejecutarse porque varios tests
importan `apps/api/dist`. Una primera pasada en un clon nuevo falló únicamente
por esos módulos todavía ausentes; después de `build:api`, la suite completa
terminó sin fallos.

La prueba PostgreSQL reprodujo una limitación conocida de `prisma dev` al usar
su puerto TCP directo (`prepared statement already exists`). Se reinició solo
la instancia efímera y la misma suite pasó 8/8 mediante el proxy oficial. La
instancia local se detuvo al terminar.

El runner compuesto `railway:preflight` de un candidato intermedio excedió el
timeout local de 15 minutos mientras repetía el typecheck web; no reportó un
fallo de código. Todos sus subgates se ejecutaron después de forma explícita y
pasaron sobre el candidato final.

## Observaciones no bloqueantes

- `apps/assistant-portal/package.json` conserva un `pnpm.overrides` anidado que
  pnpm advierte que debe vivir en la raíz; es deuda preexistente fuera de F1–F4.
- `spec:coverage` reporta deuda transversal del repositorio (87% con tests y
  45% VERIFIED); no es una regresión del candidato y el validador estricto
  permanece limpio.
- Los cinco contratos HTTP capability siguen `skip` hasta F5, conforme al
  tasks graph. No se implementaron endpoints ni RBAC fuera de alcance.

## Estado productivo al sellar

| Servicio | Deployment | Estado | Commit |
| --- | --- | --- | --- |
| API | `b5df3af8-b096-4b69-9787-b484204a44ce` | `SUCCESS` | `88394934…` |
| Worker | `b16aeb97-b958-4273-a202-994b5289f144` | `SUCCESS` | `88394934…` |
| Web | `50c22db9-4b6a-497d-a8a6-a0316a5eb553` | `SUCCESS` | `88394934…` |

No se ejecutó `railway up`, redeploy, rollback, cambio de variables, migration
contra producción, push, commit ni PR.

## Gate pendiente

Para continuar se necesita una aprobación humana explícita ligada a:

- base `88394934fb42b2e7848a1bc3584473bc118c869a`;
- runtime `sha256:74f12cc52278c94e5e7d98181fb49ddd8cc63e5544a5ec3d1ca6db4659623859`;
- canónico `sha256:8c6be2f91e84a2bacb68c91b1e9be31b8bafa71a56a111053468a65e2f32c2f0`;
- WorkItem `CP-REL-002`.

Inmediatamente antes del deploy se debe repetir la comprobación de HEAD y
deployment IDs. Si cambian, la aprobación queda obsoleta y el release se
detiene.
