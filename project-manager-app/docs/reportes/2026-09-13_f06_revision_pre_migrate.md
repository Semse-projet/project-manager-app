# F06 — Revisión de `pre-migrate.mjs`: qué es realmente riesgoso y qué no

**Fecha:** 2026-09-13
**Tipo:** revisión de solo lectura (código + logs reales de Railway), sin cambios de código ni de infraestructura. Responde al hallazgo F06 de `SEMSEproject_Auditoria_2026-09-11.md` ("Migraciones con limpieza automática... Falta evidencia de restauración y de paridad real de DB").

## Resumen ejecutivo

El script (`scripts/pre-migrate.mjs`) hace tres cosas con perfiles de riesgo muy distintos, y la redacción de la auditoría ("limpieza automática... reparación del historial y eliminación de duplicados") las mezcla en una sola frase alarmante. Separadas:

1. **Baseline (P3005)** — solo corre una vez, en un escenario detectado explícitamente (base con tablas pero sin historial de migraciones). Tiene guardas correctas: no baseliza una base vacía, no baseliza si ya hay historial. **Riesgo bajo, bien acotado.**
2. **Reparación de migraciones fantasma** — lista explícita y revisada a mano de exactamente 2 migraciones conocidas que quedaron mal registradas antes de un fix (#447). Verifica por introspección real (`information_schema`) antes de tocar nada. **Riesgo bajo, no es un mecanismo genérico.**
3. **Dedup de filas** — esto sí corre **sin condición, en cada deploy, para siempre**, contra 5 patrones de tabla hardcodeados. Es el único de los tres que borra datos de negocio de forma permanente. Es el punto que de verdad merece el "P0: separar mantenimiento de cada entrega" que pide la auditoría — ver detalle abajo.

Además, **se encontró y confirmó con logs reales de producción un incidente concreto que la auditoría no vio** (porque ocurrió el 12 de septiembre, un día después del corte de la auditoría): un `P3018` que bloqueó todos los deploys de `semse-API` durante ~13 horas, y que **no fue resuelto por el propio script** — requirió intervención manual directa contra la base de producción, sin registro en el repo.

## El script en sí (código)

Los pasos 1 y 2 fallan de forma segura y acotada. El paso 3 (dedup) es la pieza de diseño que hay que reconsiderar:

```js
// scripts/pre-migrate.mjs, runDedup()
{
  name: "Milestone (same projectId+sequence, not deleted)",
  sql: `DELETE FROM "Milestone" m1 USING "Milestone" m2
        WHERE m1."projectId" = m2."projectId"
          AND m1."sequence" = m2."sequence"
          AND m1."deletedAt" IS NULL AND m2."deletedAt" IS NULL
          AND m1.id > m2.id`,
}
```

Cinco reglas así (`BuildOpsProject`, `BuildOpsTask`, `Milestone`, `Project`, `JobTask`) se ejecutan en cada arranque de contenedor, para siempre, sin：

- **dry-run** (no hay forma de ver qué se borraría antes de que se borre),
- **respaldo** (no copia la fila a una tabla de auditoría antes del `DELETE`),
- **registro detallado** (el log solo dice `deleted ${n} rows`, nunca los IDs o el contenido — si algún día borra algo que no debía, no queda rastro de qué era).

**Evidencia real:** en los deploys recientes verificados (`railway logs --deployment <id> | grep dedup`), el resultado fue consistentemente `dedup complete — 0 rows removed`. Hoy no está borrando nada. El riesgo no es "está pasando ahora mismo" — es que la ventana nunca se cierra: cualquier futuro escenario legítimo que coincida por accidente con una de esas 5 reglas (dos filas creadas independientemente que casualmente comparten `projectId+sequence`, por ejemplo, en una reconciliación de datos futura) se borra en silencio, en el próximo deploy, sin aviso.

## El incidente real que sí se encontró (P3018, `LiveSessionStatus`)

Revisando logs de despliegues del 12-13 de septiembre (`railway deployment list --service semse-API` + `railway logs --deployment <id>`), se encontró una secuencia clara:

| Hora (UTC) | Deployment | Resultado |
| --- | --- | --- |
| 2026-09-12 13:03 | `68bfd4ff` | **`Error: P3018`** — `type "LiveSessionStatus" already exists` (código Postgres 42710) al aplicar `20260908050000_add_live_sessions` |
| 15:35 – 22:07 | `5a05bd79`, `bf37500e` | Cada intento repite: *"migrate found failed migrations in the target database, new migrations will not be applied"* — comportamiento estándar de Prisma: una vez que una migración queda marcada `failed`, **ninguna migración nueva se aplica hasta resolverla a mano** |
| 2026-09-13 01:39 | `e93641b2` | Sigue bloqueado |
| 02:01 | `b9d9689d` | `migrate deploy` **ya pasa** — la migración fallida fue resuelta entre las 01:39 y las 02:01 (fuera de este script; no hay comando de resolución en ningún log ni PR) |
| 02:30 – 02:39 | `8d2b579f` → `1f55963c` | Migraciones OK; ahora el bloqueo pasa a ser el crash de DI de `PaymentGovernanceService` (cerrado por `PR #613`) |

`CREATE TYPE` de Postgres **no admite `IF NOT EXISTS`** — la migración en sí (`packages/db/prisma/migrations/20260908050000_add_live_sessions/migration.sql:2`) no puede ser idempotente por diseño de Postgres. Que el tipo ya existiera en la base sin que la migración estuviera registrada como aplicada apunta a que en algún momento se corrió un `prisma db push` (o similar) contra producción que creó el tipo sin pasar por `migrate deploy` — coherente con el patrón de restauraciones manuales del 30-31 de agosto ya documentado en `docs/reportes/2026-09-11_f01_procedencia_release_api_web_worker.md`.

**Nadie automatizado arregló esto.** `repairPhantomMigrations()` solo cubre el caso opuesto (migración registrada como aplicada pero su efecto falta) — no cubre "migración registrada como `failed`", que es exactamente lo que bloqueó estos 13 horas. La resolución tuvo que ser manual (`prisma migrate resolve` contra la base productiva, probablemente), sin dejar rastro documentado en el repo.

## Qué significa esto para F06

La auditoría tenía razón en pedir "separar mantenimiento de cada entrega" — pero el mecanismo concreto más urgente de acotar no es el baseline ni la reparación de fantasmas (ambos ya están bien acotados), es:

1. **El dedup permanente sin log detallado ni respaldo** — riesgo de diseño, no incidente activo hoy.
2. **La ausencia de cualquier plan/runbook para "migrate found failed migrations"** — riesgo ya materializado dos veces (este P3018, y antes el enmascaramiento del crash de `PaymentGovernanceService`), cada vez resuelto de forma ad-hoc y no documentada, bajo presión de producción caída.

## No implementado en esta pasada (necesita decisión, no es un fix de una línea)

- Decidir si el dedup se convierte en un script de mantenimiento aparte (con dry-run) en vez de un paso permanente del predeploy, o si se queda pero con logging de IDs y un respaldo previo — ambas opciones tocan el contrato de arranque de producción, requieren aprobación explícita por `AGENTS.md`.
- Escribir un runbook para "migrate deploy encuentra una migración `failed`" (detección + pasos de `prisma migrate resolve` + verificación de paridad de esquema antes de marcarla resuelta), para que la próxima vez no dependa de resolverlo a mano bajo presión sin dejar registro.
- No se investigó *quién* corrió el `db push`/resolución manual ni *cuándo* exactamente entre 01:39 y 02:01 — los logs de Railway no lo registran; requeriría revisar accesos a la base o preguntar directamente.
