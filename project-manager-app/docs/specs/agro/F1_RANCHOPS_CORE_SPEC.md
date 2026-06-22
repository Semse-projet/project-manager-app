# SEMSE Agro F1 — RanchOps Core Spec

Version: 1.0  
Estado: DRAFT  
Objetivo: primera fase ejecutable de SEMSE Agro dentro de SEMSEproject.

## 1. Decision de producto

F1 no es FarmOps completo. F1 es RanchOps Core.

Debe resolver:

```txt
Tengo animales, grupos, alimento, medicinas, trabajadores, tareas y costos.
Quiero saber que esta pasando, que falta, cuanto cuesta y que evidencia tengo.
```

## 2. Alcance F1

### Entra

```txt
crear finca
crear unidades de finca
registrar animales
registrar grupos de animales
crear tareas ganaderas
registrar inventario basico
registrar movimientos de inventario
generar costos automaticos desde consumo
adjuntar evidencia
dashboard operacional
auditoria semanal
offline sync minimo
```

### No entra

```txt
cultivos completos
satelite
drones
IoT
marketplace
pagos
nomina completa
contabilidad fiscal
cumplimiento regulatorio por pais
IA generativa avanzada
diagnostico veterinario
prediccion sanitaria
blockchain
```

## 3. Modelos F1

### AgroFarm

```ts
AgroFarm {
  id: string
  ownerId?: string
  name: string
  operationType: "LIVESTOCK" | "MIXED" | "CROP"
  locationLabel?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}
```

### AgroFarmUnit

```ts
AgroFarmUnit {
  id: string
  farmId: string
  name: string
  type:
    | "PASTURE"
    | "CORRAL"
    | "BARN"
    | "STORAGE"
    | "WATER_SOURCE"
    | "WORK_AREA"
    | "FIELD"
    | "GREENHOUSE"
    | "OTHER"
  areaValue?: number
  areaUnit?: "SQFT" | "ACRE" | "HECTARE" | "MANZANA" | "OTHER"
  notes?: string
}
```

### AgroAnimal

```ts
AgroAnimal {
  id: string
  farmId: string
  currentUnitId?: string
  tagCode?: string
  species: "CATTLE" | "PIG" | "GOAT" | "SHEEP" | "HORSE" | "CHICKEN" | "OTHER"
  breed?: string
  sex: "MALE" | "FEMALE" | "UNKNOWN"
  birthDate?: Date
  estimatedAgeMonths?: number
  initialWeight?: number
  currentWeight?: number
  status: "ACTIVE" | "SOLD" | "DEAD" | "LOST" | "INACTIVE"
  acquisitionDate?: Date
  acquisitionCost?: number
  notes?: string
}
```

### AgroAnimalGroup

```ts
AgroAnimalGroup {
  id: string
  farmId: string
  currentUnitId?: string
  name: string
  species: AnimalSpecies
  count: number
  averageWeight?: number
  status: AnimalStatus
  acquisitionDate?: Date
  acquisitionCost?: number
  notes?: string
}
```

### AgroFarmTask

```ts
AgroFarmTask {
  id: string
  farmId: string
  targetType: "ANIMAL" | "ANIMAL_GROUP" | "FARM_UNIT" | "INVENTORY" | "GENERAL"
  targetId?: string
  assignedToId?: string
  title: string
  type:
    | "FEEDING"
    | "VACCINATION"
    | "TREATMENT"
    | "WEIGHING"
    | "MOVEMENT"
    | "CLEANING"
    | "INSPECTION"
    | "INVENTORY"
    | "SALE"
    | "WATER_CHECK"
    | "OTHER"
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  dueAt?: Date
  startedAt?: Date
  completedAt?: Date
  blockedAt?: Date
  cancelledAt?: Date
  blockReason?: string
  cancelReason?: string
  notes?: string
}
```

### AgroInventoryItem

```ts
AgroInventoryItem {
  id: string
  farmId: string
  name: string
  category:
    | "FEED"
    | "MEDICINE"
    | "VACCINE"
    | "FERTILIZER"
    | "SEED"
    | "FUEL"
    | "TOOL"
    | "MATERIAL"
    | "EQUIPMENT"
    | "OTHER"
  unit:
    | "UNIT"
    | "LB"
    | "KG"
    | "TON"
    | "LITER"
    | "GALLON"
    | "BAG"
    | "BOX"
    | "DOSE"
    | "BOTTLE"
    | "OTHER"
  minimumStock?: number
  notes?: string
}
```

### AgroInventoryMovement

```ts
AgroInventoryMovement {
  id: string
  farmId: string
  itemId: string
  movementType: "IN" | "OUT" | "ADJUSTMENT"
  quantity?: number
  adjustmentDelta?: number
  unitCost?: number
  totalCost?: number
  relatedTaskId?: string
  targetType?: AgroCostTargetType
  targetId?: string
  occurredAt: Date
  notes?: string
}
```

### AgroCostEntry

```ts
AgroCostEntry {
  id: string
  farmId: string
  sourceType: "INVENTORY_MOVEMENT" | "TASK" | "MANUAL" | "SERVICE" | "EQUIPMENT" | "OTHER"
  sourceId?: string
  targetType: "FARM" | "FARM_UNIT" | "ANIMAL" | "ANIMAL_GROUP" | "FARM_TASK" | "INVENTORY_ITEM" | "GENERAL"
  targetId?: string
  category: AgroCostCategory
  amount: number
  currency: string
  description?: string
  occurredAt: Date
}
```

### AgroEvidenceItem

```ts
AgroEvidenceItem {
  id: string
  farmId: string
  entityType:
    | "FARM"
    | "FARM_UNIT"
    | "ANIMAL"
    | "ANIMAL_GROUP"
    | "FARM_TASK"
    | "INVENTORY_ITEM"
    | "INVENTORY_MOVEMENT"
    | "COST_ENTRY"
    | "GENERAL"
  entityId?: string
  mediaType: "NOTE" | "PHOTO" | "VIDEO" | "DOCUMENT" | "EXTERNAL_URL" | "OTHER"
  title?: string
  note?: string
  fileUrl?: string
  capturedAt: Date
  capturedById?: string
  latitude?: number
  longitude?: number
}
```

### AgroAuditEvent

```ts
AgroAuditEvent {
  id: string
  farmId: string
  actorId?: string
  entityType: string
  entityId: string
  action: string
  before?: Json
  after?: Json
  source: "WEB" | "MOBILE" | "SYNC" | "SYSTEM" | "IMPORT"
  createdAt: Date
}
```

## 4. PRs F1

| PR | Nombre | Resultado |
|---:|---|---|
| 1 | Agro Foundation | Farm, FarmUnit, AuditEvent, endpoints base |
| 2 | RanchOps Entities | Animal, AnimalGroup, move/weigh/status/timeline |
| 3 | TaskOps Agro | FarmTask, estados, transitions, entity tasks |
| 4 | InventoryOps + CostEntry | Inventory, movements, stock, auto cost |
| 5 | EvidenceOps Agro | Evidence por entidad |
| 6 | Agro Dashboard | counts, alerts, costs, recent activity |
| 7 | AuditOps Weekly Report | findings, score, recommendations |
| 8 | Offline Sync MVP | local event queue, sync, dedupe |
| 9 | UI Shell + Navigation | Agro home, farm layout, dashboard shell |
| 10 | Animals & Groups UI | listas, formularios, perfiles |
| 11 | TaskOps UI | tareas, estados, filtros |
| 12 | Inventory + CostOps UI | inventario, movimientos, costos |
| 13 | Evidence UI | evidence feed, create dialog |
| 14 | Audit Report UI | reporte semanal |
| 15 | Offline Queue UI | sync status, retry |

## 5. Endpoints F1

### Farms

```txt
GET    /v1/agro/farms
POST   /v1/agro/farms
GET    /v1/agro/farms/:farmId
PATCH  /v1/agro/farms/:farmId
```

### Farm Units

```txt
GET    /v1/agro/farms/:farmId/units
POST   /v1/agro/farms/:farmId/units
GET    /v1/agro/farm-units/:unitId
PATCH  /v1/agro/farm-units/:unitId
```

### Animals

```txt
GET    /v1/agro/farms/:farmId/animals
POST   /v1/agro/farms/:farmId/animals
GET    /v1/agro/animals/:animalId
PATCH  /v1/agro/animals/:animalId
POST   /v1/agro/animals/:animalId/move
POST   /v1/agro/animals/:animalId/weigh
POST   /v1/agro/animals/:animalId/status
GET    /v1/agro/animals/:animalId/timeline
```

### Animal Groups

```txt
GET    /v1/agro/farms/:farmId/animal-groups
POST   /v1/agro/farms/:farmId/animal-groups
GET    /v1/agro/animal-groups/:groupId
PATCH  /v1/agro/animal-groups/:groupId
POST   /v1/agro/animal-groups/:groupId/move
POST   /v1/agro/animal-groups/:groupId/adjust-count
POST   /v1/agro/animal-groups/:groupId/status
GET    /v1/agro/animal-groups/:groupId/timeline
```

### Tasks

```txt
GET    /v1/agro/farms/:farmId/tasks
POST   /v1/agro/farms/:farmId/tasks
GET    /v1/agro/tasks/:taskId
PATCH  /v1/agro/tasks/:taskId
POST   /v1/agro/tasks/:taskId/start
POST   /v1/agro/tasks/:taskId/complete
POST   /v1/agro/tasks/:taskId/block
POST   /v1/agro/tasks/:taskId/cancel
GET    /v1/agro/tasks/:taskId/timeline
GET    /v1/agro/entities/:targetType/:targetId/tasks
```

### Inventory / Costs

```txt
GET    /v1/agro/farms/:farmId/inventory/items
POST   /v1/agro/farms/:farmId/inventory/items
GET    /v1/agro/inventory/items/:itemId
PATCH  /v1/agro/inventory/items/:itemId
GET    /v1/agro/inventory/items/:itemId/movements
GET    /v1/agro/inventory/items/:itemId/stock
GET    /v1/agro/farms/:farmId/inventory/movements
POST   /v1/agro/farms/:farmId/inventory/movements
POST   /v1/agro/farms/:farmId/inventory/consume
GET    /v1/agro/farms/:farmId/costs
POST   /v1/agro/farms/:farmId/costs
GET    /v1/agro/farms/:farmId/costs/summary
GET    /v1/agro/entities/:targetType/:targetId/costs
```

### Evidence

```txt
GET    /v1/agro/farms/:farmId/evidence
POST   /v1/agro/farms/:farmId/evidence
GET    /v1/agro/evidence/:evidenceId
PATCH  /v1/agro/evidence/:evidenceId
GET    /v1/agro/entities/:entityType/:entityId/evidence
GET    /v1/agro/farms/:farmId/evidence/recent
```

### Dashboard / Audit / Sync

```txt
GET  /v1/agro/farms/:farmId/dashboard
GET  /v1/agro/farms/:farmId/audit-events
POST /v1/agro/farms/:farmId/audit-report
POST /v1/agro/sync/events
```

## 6. Dashboard F1

El dashboard debe devolver:

```txt
farm summary
counts
month cost summary
alerts
recent activity
recent evidence
next best actions
```

Alertas deterministicas:

```txt
OVERDUE_TASK
BLOCKED_TASK
LOW_STOCK
MISSING_EVIDENCE
ANIMAL_INACTIVITY
```

No usar IA en F1 dashboard.

## 7. AuditOps F1

La auditoria semanal debe responder:

```txt
Esta la finca bajo control esta semana?
```

Secciones:

```txt
resumen operativo
tareas atrasadas
inventario bajo
animales sin actividad
evidencia faltante
costos del periodo
eventos recientes
recomendaciones deterministicas
```

Score inicial:

```txt
score = 100
- 15 * criticalFindings
- 5 * warningFindings
- 1 * infoFindings
min 0, max 100
```

## 8. Offline MVP

Acciones offline F1:

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

Regla:

```txt
cliente encola evento local
servidor deduplica por farmId + clientEventId
servidor valida permisos
servidor aplica accion
servidor crea AuditEvent
cliente marca SYNCED o FAILED
```

## 9. Definition of Done F1

F1 esta terminado cuando:

```txt
1. Se puede crear finca.
2. Se pueden crear unidades.
3. Se pueden registrar animales y grupos.
4. Se pueden mover animales/grupos.
5. Se pueden crear/completar/bloquear/cancelar tareas.
6. Se puede crear inventario.
7. Se puede consumir inventario.
8. El consumo genera costo automatico.
9. Se puede adjuntar evidencia.
10. Dashboard muestra estado real.
11. Auditoria semanal detecta pendientes.
12. Offline sync deduplica eventos.
13. UI principal funciona.
14. Tests backend pasan.
15. TypeScript web/API limpio.
```

