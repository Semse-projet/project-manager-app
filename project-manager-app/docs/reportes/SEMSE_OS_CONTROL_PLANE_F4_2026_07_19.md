# Reporte de implementación — SEMSE OS Control Plane F4

**Fecha:** 2026-07-19  
**Spec:** `platform.semse-os-control-plane`  
**Resultado:** COMPLETE_BUILDER_VERIFIED  
**Entorno:** PostgreSQL local efímero; sin Docker, deploy ni producción

## Cadena de autoridad

| Artefacto | Digest |
| --- | --- |
| Tasks aprobado para F4 | `sha256:20a60e08d6d6d5aadf5aa9652405536307f461f522b0baa7c22f4a9ae56a0aaa` |
| Tasks después de registrar F4 | `sha256:7bb5528f692518a16bd8ecabe42c5fcd735a7ba76eb0d7966f3fc04edb5bb4d9` |
| Bundle source/data/test F4 | `sha256:387b122079644b93d0de54525a373efe43d4fe10c944063f3c7f0162e4945f8d` |
| Lockfile con importer autorizado | `sha256:934df9a42e123224041d8ac45adc08313600f894ace6e135108d45864a0e3f6d` |

El bundle se calculó sobre líneas `relativePath:sha256`, ordenadas por path, de
schema Prisma, migration SQL, repository y test de integración. Excluye `dist`
generado y documentación.

## Resultado T-040..T-048

- Se registró exactamente `packages/control-plane: {}` en `pnpm-lock.yaml`; la
  verificación `pnpm install --frozen-lockfile --lockfile-only --offline` pasó.
- Se añadieron 11 enums y seis modelos Prisma: definition, runtime target,
  installation, operation, approval y execution receipt.
- La migration es aditiva: no contiene `DROP`, `TRUNCATE`, DML ni `ALTER` sobre
  tablas existentes.
- El catálogo PostgreSQL confirmó 6 tablas, 11 enums, 15 foreign keys, 16 check
  constraints y 24 índices no primarios, incluido el unique parcial que impide
  contar dos veces al mismo aprobador.
- Todos los FKs tienen índice aplicable. Los índices tenant/workspace colocan
  columnas de igualdad antes de estado/tiempo; no se añadió GIN JSONB sin query.
- El repository aplica tenant/workspace scoping también en relaciones y locks,
  CAS por estado/revisión, idempotency key, lease por installation/target,
  receipt inmutable por operation/step y orden de lock explícito.
- Cada transición material persiste estado + `AuditLog` + outbox v2 en la misma
  transacción. `APPLYING` requiere observación previa y una lease vencida queda
  `BLOCKED`; nunca se adopta drift silenciosamente.

## Verificación

| Gate | Resultado |
| --- | --- |
| Prisma format/validate | PASS |
| Prisma generate 6.19.3 | PASS |
| 64 migrations sobre PostgreSQL local efímero | PASS |
| Catálogo DDL F4 | PASS |
| Integración F4 | 8 pass, 0 fail, 0 skip |
| CP-005/006/011/012 | PASS |
| EXPLAIN list/claim tenant-scoped | usa índices compuestos esperados |
| TypeScript aislado repository + test | PASS |
| Builds de 11 paquetes, incluido control-plane | PASS |
| Arnés capability F1-F3 | 17 pass, 0 fail, 5 skip F6 |
| Arnés spec/container | 5 pass, 0 fail |
| SDD estricto | 78 specs, 0 errores, 0 warnings |

## Migrate diff y deriva histórica

`prisma migrate diff --from-migrations --to-schema-datamodel` no reportó ninguna
diferencia `Capability*` después de alinear el nombre abreviado del índice de
claim con el nombre canónico de Prisma/PostgreSQL.

El diff global continúa no vacío por deriva anterior a F4 en Agro,
`AlgorithmRun`, `BuildOpsPlanVersion`, `ChangeOrderCandidate`, `Contract`,
`Milestone` y `MilestoneEvidenceItem`. No se corrigió ni se ocultó: esas tablas
están fuera del TaskPacket F4 y requieren un baseline/paquete separado. El
escaneo estático confirmó que la migration F4 no las altera.

## Problemas encontrados y resolución

1. El cliente Prisma necesitó descargar sus engines: se usó la versión exacta
   6.19.3 del lockfile y luego generate/validate pasaron.
2. No había PostgreSQL del sistema. Se inició `prisma dev` como servidor local
   efímero, sin Docker y sin escribir `.env`.
3. La URL TCP directa del runtime beta cerró sesiones tras conflictos de
   prepared statements. Se reinició solo el servidor efímero y las pruebas se
   ejecutaron mediante su proxy oficial, con la URL mantenida en memoria.
4. Un insert duplicado de receipt hacía depender el retry de una excepción
   única. Se sustituyó por `upsert` atómico y comparación de campos inmutables.
5. El runner del workspace invoca `pnpm` sin Corepack y falla con `ENOENT`; el
   script de knowledge además usa `mkdir -p`/`cp` no portable en PowerShell. Se
   reprodujo la misma secuencia con `corepack pnpm` y copia nativa de tres assets.
6. Tras construir dependencias, el build API global quedó inicialmente con
   cinco errores por un `AiModelsSSEService` huérfano que importaba
   `@nestjs/event-emitter`. Una autorización posterior permitió inspeccionarlo:
   no estaba registrado, no tenía productores/consumidores y duplicaba el bus
   SSE canónico. Se retiró fuente/dist sin añadir dependencia; build API PASS.

## Límites preservados

- No se usó `db push`, down migration, reset, seed ni una base externa.
- No se implementó controller, service de negocio, module, RBAC, API capability,
  worker, queue, executor o adapter Docker.
- No se usó Docker/WSL, Railway, deploy, staging ni producción.
- No se creó rama, commit ni push, conforme al waiver Git.
- El servidor PostgreSQL efímero se detiene al terminar la verificación.

Estado del grafo al cierre: **43 completas, 1 bloqueada y 46 pendientes**. F5+
requiere una aprobación humana nueva ligada al digest actual de tasks.
