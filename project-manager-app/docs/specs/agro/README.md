# SEMSE Agro / FarmOps

Estado: APPROVED FOR PLANNING  
Propietario: SEMSE Architecture / Product  
Relacion: vertical de dominio dentro de SEMSEproject, no fork.

## Proposito

Esta carpeta organiza la vision, arquitectura, roadmap y prompts de ejecucion para
SEMSE Agro / FarmOps.

SEMSE Agro convierte la finca en un sistema operativo inteligente:

```txt
Farm
→ Units
→ Animals / Groups / Crops / Cycles
→ Tasks
→ Inventory
→ Evidence
→ Costs
→ Audit
→ Traceability
→ Compliance
→ Reports
→ Trust Score
→ Weather / Sensors / Satellite
→ Risks / Predictive Alerts
→ Marketplace
→ Contracts
→ Payments
→ Reputation
→ Governance
```

## Orden recomendado de lectura

1. [EXECUTION_CONTROL.md](./EXECUTION_CONTROL.md)
2. [SEMSE_AGRO_MASTER_SPEC.md](./SEMSE_AGRO_MASTER_SPEC.md)
3. [F1_RANCHOPS_CORE_SPEC.md](./F1_RANCHOPS_CORE_SPEC.md)
4. [F2_TO_F5_ROADMAP.md](./F2_TO_F5_ROADMAP.md)
5. [IMPLEMENTATION_PROMPTS.md](./IMPLEMENTATION_PROMPTS.md)
6. [RAILWAY_GREEN_RECOVERY_RUNBOOK.md](./RAILWAY_GREEN_RECOVERY_RUNBOOK.md)

## Regla de ejecucion

No implementar todo el roadmap de una vez.

La secuencia correcta es:

```txt
Primero control.
Despues trazabilidad.
Despues confianza comercial.
Despues inteligencia predictiva.
Despues marketplace.
```

## Estado de implementacion

Estos documentos son especificacion y direccion. La vision queda aprobada para
planificacion; la implementacion queda bloqueada por PRs pequenos y por el estado
verde del repo.

Antes de codificar, cada PR debe:

- inspeccionar el repo real;
- respetar patrones existentes;
- mantener scope pequeno;
- validar builds/tests;
- no adelantar fases futuras.

Prioridad actual:

```txt
Railway green recovery
→ PR 1 Agro Foundation
→ F1 RanchOps Core
→ piloto operativo
```
