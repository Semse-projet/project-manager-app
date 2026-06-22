# SEMSE Agro — Implementation Prompt Library

Version: 1.0  
Estado: DRAFT  
Uso: prompts operativos para Codex/Claude al implementar o revisar PRs.

## Regla general para todos los PRs

Antes de tocar codigo:

```txt
1. inspeccionar repo real;
2. detectar patrones existentes;
3. listar archivos a crear/modificar;
4. declarar que NO se tocara;
5. ejecutar cambios pequenos;
6. validar typecheck/build/tests;
7. reportar resultados honestamente.
```

No implementar fases futuras dentro de un PR foundation.

## PR 1 — Agro Foundation

Objetivo:

```txt
AgroModule
AgroFarm
AgroFarmUnit
AgroAuditEvent
endpoints base de farms/units/audit-events
seed Rancho Prometeo
tests minimos
```

No implementar:

```txt
animals
groups
tasks
inventory
costs
evidence
dashboard
sync
crops
marketplace
```

Definition of Done:

```txt
1. AgroModule existe.
2. AgroFarm existe.
3. AgroFarmUnit existe.
4. AgroAuditEvent existe.
5. Hay migracion Prisma.
6. Se puede crear finca.
7. Se puede crear unidad.
8. Se generan audit events.
9. Hay seed demo.
10. Tests minimos pasan.
```

Review focus:

```txt
scope creep
migracion segura
auth/access
audit events
seed idempotente
tests reales
```

## PR 2 — RanchOps Entities

Objetivo:

```txt
AgroAnimal
AgroAnimalGroup
create/update
move
weigh
status
timeline desde AgroAuditEvent
```

Eventos:

```txt
animal.created
animal.updated
animal.moved
animal.weighed
animal.status_changed
animal_group.created
animal_group.updated
animal_group.moved
animal_group.count_adjusted
animal_group.status_changed
```

Review focus:

```txt
tagCode unico por finca
currentUnit cross-farm validation
count/weight/cost no negativos
timeline filtra por entityType/entityId
no TaskOps todavia
```

## PR 3 — TaskOps Agro

Objetivo:

```txt
AgroFarmTask
crear/listar/actualizar tareas
start/complete/block/cancel
tareas por entidad
timeline desde AgroAuditEvent
```

Target types:

```txt
ANIMAL
ANIMAL_GROUP
FARM_UNIT
INVENTORY
GENERAL
```

En PR 3, `INVENTORY` debe rechazarse con error claro porque inventario entra en PR 4.

Eventos:

```txt
farm_task.created
farm_task.updated
farm_task.started
farm_task.completed
farm_task.blocked
farm_task.cancelled
```

Review focus:

```txt
transiciones validas
target cross-farm isolation
no inventario/evidencia/costos
timeline correcto
```

## PR 4 — InventoryOps + CostEntry automatico

Objetivo:

```txt
AgroInventoryItem
AgroInventoryMovement
AgroCostEntry
stock calculation
consume inventory
auto CostEntry desde OUT/consume con unitCost
manual costs
summary
```

Regla:

```txt
Inventory without costs is counting.
Inventory with movements and auto costs shows real operation cost.
```

Review focus:

```txt
stock calculation
OUT stock guard
auto cost creation
target/task cross-farm validation
ADJUSTMENT policy clear
seed idempotente
```

## PR 5 — EvidenceOps Agro

Objetivo:

```txt
AgroEvidenceItem o wrapper del Evidence core
evidence por farm/entity
NOTE/PHOTO/VIDEO/DOCUMENT/EXTERNAL_URL
recent evidence
audit events
```

Entidades:

```txt
FARM
FARM_UNIT
ANIMAL
ANIMAL_GROUP
FARM_TASK
INVENTORY_ITEM
INVENTORY_MOVEMENT
COST_ENTRY
GENERAL
```

Review focus:

```txt
reuso de Evidence core si existe
target validation
no evidencia vacia
fileUrl requerido para media de archivo
cross-farm isolation
```

## PR 6 — Agro Dashboard

Objetivo:

```txt
GET /v1/agro/farms/:farmId/dashboard
farm summary
counts
month costs
alerts
recentActivity
recentEvidence
nextBestActions
```

Alertas:

```txt
OVERDUE_TASK
BLOCKED_TASK
LOW_STOCK
MISSING_EVIDENCE
ANIMAL_INACTIVITY
```

Review focus:

```txt
no mezclar fincas
counts correctos
low stock desde movements
missing evidence deterministico
recent limits
no audit report formal todavia
```

## PR 7 — AuditOps Weekly Report

Objetivo:

```txt
reporte semanal de control operativo
findings por severidad
audit readiness score
recommendations deterministicas
opcional persistencia AgroAuditReport
```

Finding shape:

```ts
{
  severity: "CRITICAL" | "WARNING" | "INFO";
  code: string;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  suggestedAction?: string;
}
```

Reglas:

```txt
overdue tasks
blocked tasks
low stock
missing evidence
animal inactivity
cost summary
recent activity
```

Score:

```txt
score = 100
- 15 * criticalFindings
- 5 * warningFindings
- 1 * infoFindings
min = 0
max = 100
```

Review focus:

```txt
no cumplimiento regulatorio oficial
no IA
findings deterministicas
score consistente
no datos cross-farm
```

## PR 8 — Offline Sync MVP

Objetivo:

```txt
AgroSyncEvent
POST /v1/agro/sync/events
dedupe por farmId + clientEventId
allowlist de acciones
aplicar evento
crear AuditEvent
marcar SYNCED/FAILED
```

Acciones F1:

```txt
farm_task.create
farm_task.complete
farm_task.block
animal.move
animal.weigh
animal_group.move
inventory_movement.create
evidence.note.create
```

Review focus:

```txt
dedupe real
no doble consumo
fallo por evento no bloquea lote completo
cross-farm validation
no archivos offline pesados
```

## PR 9-15 — UI F1

Secuencia:

```txt
PR 9  — UI Shell + Dashboard Navigation
PR 10 — Animals & Groups UI
PR 11 — TaskOps UI
PR 12 — Inventory + CostOps UI
PR 13 — Evidence UI
PR 14 — Audit Report UI
PR 15 — Offline Queue UI
```

Reglas UI:

```txt
operativa, no decorativa
formularios cortos
estados vacios utiles
copy bilingue
dashboard como centro
offline visible sin estorbar
```

## Railway Green Recovery Prompt

Para estabilizacion de deploy, usar:

[RAILWAY_GREEN_RECOVERY_RUNBOOK.md](./RAILWAY_GREEN_RECOVERY_RUNBOOK.md)

Regla:

```txt
Primero verde. Despues features.
```

