# SEMSE Agro — Execution Control

Version: 1.0  
Estado: APPROVED FOR PLANNING  
Proposito: controlar la ejecucion de SEMSE Agro sin convertir la vision en scope creep.

## 1. Decision ejecutiva

SEMSE Agro es una vertical de dominio dentro de SEMSEproject. No es fork, no es app
separada y no debe implementarse como un bloque gigante.

La secuencia de producto queda bloqueada asi:

```txt
Primero control.
Despues trazabilidad.
Despues confianza comercial.
Despues inteligencia predictiva.
Despues marketplace.
```

## 2. Orden de ejecucion obligatorio

### Gate 0 — Repo verde

Antes de construir features Agro, SEMSEproject debe estar desplegable:

```txt
Prisma generate pasa.
API typecheck/build pasa.
Web typecheck/build pasa.
Worker build/check pasa si aplica.
Health checks existen.
Railway config esta alineada.
No hay secretos impresos ni filtrados.
```

Runbook: `docs/specs/agro/RAILWAY_GREEN_RECOVERY_RUNBOOK.md`.

### Gate 1 — F1 RanchOps Core

Implementar solo el nucleo ganadero:

```txt
Farm
FarmUnit
Animal
AnimalGroup
FarmTask
InventoryItem
InventoryMovement
CostEntry
EvidenceItem
Dashboard
Weekly Audit
Offline Sync MVP
```

Spec: `docs/specs/agro/F1_RANCHOPS_CORE_SPEC.md`.

### Gate 2 — F2 Mixed FarmOps

Solo despues de un piloto F1 funcional:

```txt
ProductionCycle
CropCycle
InputApplication
HarvestRecord
TraceabilityEvent
ComplianceCheck
Prometeo Agro Query
```

Roadmap: `docs/specs/agro/F2_TO_F5_ROADMAP.md`.

### Gate 3 — F3 Commercial Trust

Solo despues de datos reales de trazabilidad:

```txt
Buyer packages
Public share links / QR
PDF exports
Farm Trust Score
Monetization gates
Marketplace prep
```

### Gate 4 — F4 Intelligence

Solo despues de suficiente historial operativo:

```txt
Weather
Map / geo features
Sensors
Satellite observations
Risk engine
Predictive alerts
Prometeo advanced
```

### Gate 5 — F5 Marketplace

Solo despues de confianza comercial real:

```txt
Providers
Buyers
Suppliers
Transport
Contracts
Payments
Trust Passport
Governance
```

## 3. Primer MVP que se puede pilotear

El piloto minimo no necesita cultivos, satelite, IA avanzada ni marketplace.

Flujo de piloto:

```txt
1. Crear finca.
2. Crear potrero/corral/bodega.
3. Registrar animal o grupo.
4. Crear inventario inicial.
5. Crear tarea de alimentacion o revision.
6. Consumir inventario desde la tarea.
7. Generar costo automatico.
8. Adjuntar evidencia.
9. Completar tarea.
10. Ver dashboard.
11. Generar auditoria semanal.
```

Si este flujo funciona, SEMSE Agro ya demuestra valor.

## 4. Definition of Done por PR

Cada PR Agro debe cumplir:

```txt
1. Inspecciona patrones reales del repo antes de editar.
2. Declara archivos a tocar.
3. Mantiene scope pequeno.
4. No adelanta fases futuras.
5. Valida auth/access/cross-farm isolation.
6. Emite AgroAuditEvent en acciones criticas.
7. Agrega tests del comportamiento nuevo.
8. Ejecuta typecheck/build/test aplicables.
9. Reporta comandos y resultados.
10. Actualiza docs si cambia contrato.
```

## 5. Orden PR F1 bloqueado

```txt
PR 1  — Agro Foundation
PR 2  — RanchOps Entities
PR 3  — TaskOps Agro
PR 4  — InventoryOps + CostEntry automatico
PR 5  — EvidenceOps Agro
PR 6  — Agro Dashboard
PR 7  — AuditOps Weekly Report
PR 8  — Offline Sync MVP
PR 9  — UI Shell + Dashboard Navigation
PR 10 — Animals & Groups UI
PR 11 — TaskOps UI
PR 12 — Inventory + CostOps UI
PR 13 — Evidence UI
PR 14 — Audit Report UI
PR 15 — Offline Queue UI
```

No saltar a PR 16+ antes de terminar y pilotear F1.

## 6. Bloqueos explicitos

No implementar en F1:

```txt
Cultivos completos
Satelite
IoT
Marketplace
Pagos
Trust Passport
Prometeo avanzado
Diagnostico veterinario
Prescripcion de quimicos o medicamentos
Cumplimiento legal garantizado
```

## 7. Reglas de seguridad de producto

Prometeo Agro nunca debe:

```txt
diagnosticar enfermedades;
prescribir medicamentos;
definir dosis quimicas definitivas;
garantizar cumplimiento legal;
ejecutar acciones criticas sin confirmacion.
```

Compliance debe comunicarse como:

```txt
cumplimiento configurable y organizacion de evidencia
```

No como:

```txt
certificacion oficial universal
```

## 8. Prioridad actual

Prioridad inmediata:

```txt
1. Mantener SEMSEproject verde para Railway.
2. Consolidar PR 1 de Agro Foundation.
3. Implementar F1 en orden.
4. Lanzar piloto RanchOps.
```

Todo lo demas queda como roadmap documentado, no como trabajo activo.

