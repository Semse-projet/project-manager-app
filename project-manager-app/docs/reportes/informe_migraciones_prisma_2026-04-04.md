# Informe de Migraciones Prisma

> Nota histórica: este informe describe el cierre inicial de drift de Prisma. El estado vigente de migraciones y approvals persistidos quedó actualizado en reportes posteriores de abril 8.

Fecha: 2026-04-04
Proyecto: `project-manager-app`
Ámbito: `packages/db`

## 1. Problema detectado

Después de levantar PostgreSQL y validar `apps/api`, apareció un fallo de schema:

```text
The column `milestonesApproved` does not exist in the current database.
```

Ese error mostró que:

- el schema actual de Prisma y el cliente generado sí esperaban ciertas columnas
- pero el historial versionado de migraciones no reconstruía completamente esa estructura desde cero

En otras palabras:

- `migrate deploy` no bastaba
- por eso el entorno local solo quedaba funcional después de `db push`

## 2. Diagnóstico

Se comparó:

- `prisma/migrations`
- contra `prisma/schema.prisma`

El diff confirmó que faltaban en migraciones:

- enums de memoria/delegación/work plan
- nuevos valores de `EvidenceKind`
- columnas en `Contract`
- columnas en `Evidence`
- columnas en `Milestone`
- columnas en `User`
- tablas `AgentMemory`, `AgentDelegation`, `AgentWorkPlan`
- índices y foreign keys asociados

## 3. Corrección aplicada

Se añadió la migración:

- `packages/db/prisma/migrations/20260405021000_reconcile_schema_drift/migration.sql`

Esta migración incluye:

- creación de enums faltantes
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- creación de tablas faltantes
- índices `IF NOT EXISTS`
- foreign keys protegidas con bloques `DO $$ ... IF NOT EXISTS ... $$`

El objetivo fue que la migración sea segura sobre entornos de desarrollo y a la vez cierre el drift detectado.

## 4. Endurecimiento operativo

Se añadió verificación reproducible:

- script: `scripts/db-verify-fresh.sh`
- comando root: `npm run db:verify:fresh`

Qué hace:

1. crea una base temporal
2. aplica todas las migraciones desde cero
3. corre el seed
4. elimina la base temporal

## 5. Verificación

Comando ejecutado:

```bash
npm run db:verify:fresh
```

Resultado:

- pasa correctamente

Conclusión de la verificación:

- el repositorio ya puede reconstruir una base nueva mediante migraciones + seed
- deja de depender de `db push` como paso manual de rescate

## 6. Estado al cierre

Estado actual de `packages/db`:

- migraciones reconciliadas con el schema actual
- seed funcional sobre base fresca
- verificación automatizada disponible en el repo

## 7. Conclusión

Esta fase cerró uno de los riesgos más delicados del proyecto:

- antes, el entorno local podía parecer sano pero reconstruirse mal desde cero
- ahora, existe una migración correctiva versionada y una prueba reproducible de reconstrucción limpia
