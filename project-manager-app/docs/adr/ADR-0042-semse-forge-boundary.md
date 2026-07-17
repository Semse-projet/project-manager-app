# ADR-0042 — SEMSE Forge como plano de control de ingeniería

**Estado:** Proposed
**Fecha:** 2026-07-17

## Contexto

SEMSEproject ya tiene `packages/agents`, un runtime gobernado, approvals y agentes operativos. La nueva capacidad de construir software y apps de profesores podría duplicar esa capa si se implementa como otro runtime.

## Decisión

Crear `packages/forge` como **plano de control**:

- specs;
- task graph;
- policy de ingeniería;
- FSM;
- Creator blueprints;
- coordinación.

La ejecución concreta seguirá integrándose con `packages/agents`, workers, GitHub y CI mediante adaptadores.

## Consecuencias

### Positivas

- separa operación del negocio e ingeniería del producto;
- reutiliza gobernanza existente;
- evita un agente omnipotente;
- permite apps creadas por profesores;
- mejora trazabilidad.

### Costos

- nuevo paquete y contratos;
- adaptación con AgentRun;
- almacenamiento futuro para ForgeRun;
- UI de Mission Control;
- mayor disciplina de specs.

## No decidido todavía

- persistencia Prisma de ForgeRun;
- endpoints;
- BullMQ;
- proveedor de sandbox;
- adaptadores de modelos;
- modelo de revenue share.
