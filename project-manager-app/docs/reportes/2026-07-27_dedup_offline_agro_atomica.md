# Reporte — La deduplicacion del sync offline de Agro pasa a ser atomica

**Fecha:** 2026-07-27
**Repositorio:** Semse-projet/project-manager-app
**Alcance:** `apps/api` (modulo agro) y `packages/db`. **Sin cambios de UI.**
**Contexto:** anillo 0 del trabajo de offline-first. Prerrequisito de la cola cliente.

## Problema

`AgroSyncService` ya implementaba las 8 acciones offline de
`F1_RANCHOPS_CORE_SPEC.md §8`, y sus tests pasaban. Pero la regla de la spec
—*"servidor deduplica por farmId + clientEventId"*— no estaba garantizada:

1. **Dedup sin constraint.** Era un `findFirst` seguido de un `create`, y
   `AgroAuditEvent` no tenia **ningun** `@@unique`. Dos entregas concurrentes del
   mismo `clientEventId` —que es exactamente lo que produce una conexion
   intermitente en campo— pasaban ambas el chequeo y aplicaban la accion dos
   veces.
2. **Marcador escrito despues de aplicar, y fuera de transaccion.** Si el proceso
   moria entre ambos pasos, el reintento volvia a aplicar. Para
   `inventory_movement.create` eso significa **movimiento de stock y asiento de
   costo duplicados**.
3. **`updateMany` sin mirar filas afectadas.** `farm_task.complete`,
   `farm_task.block`, `animal.move`, `animal.weigh` y `animal_group.move`
   devolvian `SYNCED` aunque la entidad no existiera: el cliente borraba el
   evento de su cola creyendo que se habia aplicado.

El DoD F1 dice *"12. Offline sync deduplica eventos"*. Deduplicaba solo en el
caso secuencial feliz, que era justo el que los tests cubrian.

## Solucion aplicada

### Idempotencia como garantia de base de datos

Mismo patron que `TimeEntry.clientEventId` (migracion `20260722010000`):

```sql
ALTER TABLE "AgroAuditEvent" ADD COLUMN "clientEventId" TEXT;
CREATE UNIQUE INDEX "AgroAuditEvent_farmId_clientEventId_key"
    ON "AgroAuditEvent"("farmId", "clientEventId");
```

Postgres no considera iguales dos NULL, asi que los eventos de auditoria
normales (todos con `clientEventId` NULL) no quedan afectados por el unique.

La migracion **hace backfill** de los marcadores ya existentes, que guardaban el
id dentro de `action` con el formato `sync.<clientEventId>`, excluyendo los
`sync.applied.<accion>`, que son la traza de la accion y no marcadores. Sin ese
backfill, un evento antiguo reenviado por un cliente no se habria detectado como
duplicado. Antes de crear el indice se eliminan posibles marcadores duplicados
—los que la carrera descrita arriba pudo haber creado ya en produccion—
conservando el mas antiguo de cada grupo.

### El marcador pasa a ser la puerta, dentro de la transaccion

`processSingleEvent` ahora abre una transaccion, **inserta primero el marcador**
y luego aplica la accion. Un `P2002` (violacion de unique) se traduce a
`DUPLICATE`. Si aplicar falla, la transaccion revierte tambien el marcador, y el
evento queda reintentable en vez de marcado como hecho.

`AgroInventoryRepository.createMovement` acepta ahora un cliente transaccional
opcional, para que el movimiento caiga dentro de la misma transaccion.

### Fallar en vez de mentir

Se añadio `mustAffectRows`: un `updateMany` con `count === 0` lanza, lo que
revierte la transaccion y devuelve `FAILED` con el motivo.

### Limpieza

`AgroSyncService` ya no inyecta `AgroAuditRepository`: escribe la auditoria
dentro de la transaccion, asi que la dependencia habia quedado muerta.

## Validacion

| Verificacion | Resultado |
|---|---|
| Suite completa de la API | ✅ **1969/1969**, 0 fallos |
| Tests de `agro-sync` | ✅ 11/11 (8 previos + 3 nuevos) |
| `prisma validate` | ✅ esquema valido |
| `spec:validate:strict` · `validate:workspace` | ✅ 95 specs, 0/0 · passed |
| SQL de la migracion | Se ejecuta en el job `integration` de CI (`pnpm db:migrate` contra Postgres 16) |

### Tests nuevos, uno por defecto

- **`el reintento concurrente no aplica la accion dos veces`** — dos entregas en
  paralelo del mismo evento: los estados salen `SYNCED` + `DUPLICATE` y la tarea
  se crea **una sola vez**.
- **`si aplicar falla, el evento queda reintentable y no marcado`** — con un
  fallo transitorio, no queda marcador; al reintentar, se aplica.
- **`completar una tarea inexistente devuelve FAILED, no SYNCED`**.

El stub de Prisma de la suite tuvo que crecer para sostenerlos: `$transaction`
ahora revierte al lanzar y **serializa** las transacciones. Sin aislamiento, al
revertir la perdedora de una carrera se borraba tambien lo que habia escrito la
ganadora — un artefacto del stub que Postgres no permite.

## Lo que esto no hace

- **No hay cola cliente todavia.** Este es el lado servidor.
- **No existe ruta BFF `/api/semse/agro/sync`**, asi que la web aun no puede
  llamar al endpoint. Entra con la cola.
- **Las fotos siguen fuera.** La unica accion de evidencia offline es
  `evidence.note.create`, texto. Los blobs pesados son un problema aparte.
