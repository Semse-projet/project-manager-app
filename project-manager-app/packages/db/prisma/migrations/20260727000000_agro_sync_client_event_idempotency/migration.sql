-- Offline sync de Agro: convierte la deduplicacion por clientEventId en una
-- garantia de base de datos.
--
-- Hasta ahora AgroSyncService deduplicaba con un findFirst seguido de un
-- create, sin constraint: dos reintentos concurrentes del mismo clientEventId
-- --que es exactamente lo que produce una conexion intermitente en campo--
-- pasaban ambos el chequeo y aplicaban la accion dos veces. Para
-- inventory_movement.create eso significa movimiento de stock y asiento de
-- costo duplicados.
--
-- Mismo patron que TimeEntry.clientEventId (20260722010000).

ALTER TABLE "AgroAuditEvent" ADD COLUMN "clientEventId" TEXT;

-- Backfill de los marcadores ya existentes, que guardaban el id del evento
-- dentro de la columna `action` con el formato 'sync.<clientEventId>'. Se
-- excluyen los registros 'sync.applied.<accion>', que son la traza de la
-- accion aplicada y no marcadores de dedup.
UPDATE "AgroAuditEvent"
   SET "clientEventId" = substring("action" FROM 6)
 WHERE "action" LIKE 'sync.%'
   AND "action" NOT LIKE 'sync.applied.%';

-- Defensa: si la carrera descrita arriba ya ocurrio en produccion, existirian
-- marcadores duplicados y el indice unico no podria crearse. Se conserva el
-- mas antiguo de cada grupo, que es el que corresponde a la aplicacion real.
DELETE FROM "AgroAuditEvent" a
 USING "AgroAuditEvent" b
 WHERE a."clientEventId" IS NOT NULL
   AND a."clientEventId" = b."clientEventId"
   AND a."farmId"        = b."farmId"
   AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

-- NULL no es igual a NULL para un indice unico en Postgres, asi que los
-- eventos de auditoria normales (clientEventId NULL) no quedan afectados.
CREATE UNIQUE INDEX "AgroAuditEvent_farmId_clientEventId_key"
    ON "AgroAuditEvent"("farmId", "clientEventId");
