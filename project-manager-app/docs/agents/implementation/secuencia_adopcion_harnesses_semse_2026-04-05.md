# Secuencia de Adopción de Harnesses en SEMSE

## Objetivo

Cerrar la fase de diseño con una secuencia clara para pasar a implementación sin mezclar prioridades.

## Orden recomendado

1. `ProjectCopilotHarness`
2. `PaymentsHarness`
3. `DisputeHarness`

## Razon del orden

### 1. ProjectCopilotHarness primero

Porque ya tiene:

- UI
- thread persistido
- journal
- corpus
- search
- actions

Es el mejor candidato para consolidar el patrón `AgentHarness`.

### 2. PaymentsHarness después

Porque depende de:

- contexto del proyecto
- actions aprobables
- riesgo y approval
- work plan

Pero todavía puede vivir encima del proyecto sin necesitar delegación compleja.

### 3. DisputeHarness al final

Porque es el más transversal:

- docs
- evidence
- payments
- trust
- timeline
- work plans
- delegación futura

Si entra antes, arrastra demasiados supuestos.

## Fase 1. Consolidación de ProjectCopilotHarness

Entregables:

- `project-copilot.types.ts`
- `project-copilot.harness.ts`
- integración con `AgentMemoryService`
- contrato de refresh

## Fase 2. Introducción de Plan Mode

Entregables:

- enum de modos del harness
- serialización mínima de `AgentWorkPlan`
- review state explícito

## Fase 3. PaymentsHarness

Entregables:

- contrato técnico implementado
- transición `plan -> review -> execute`
- uso real de `AgentWorkPlan`

## Fase 4. DisputeHarness

Entregables:

- contrato técnico implementado
- análisis con citas
- plan persistido
- base para `AgentDelegation`

## Definition of done por fase

### Done Fase 1

- existe una clase o servicio formal de harness
- la UI deja de orquestar política principal
- thread, journal, context y memory se resuelven desde backend

### Done Fase 2

- plan mode existe como estado explícito
- una acción `HIGH` no puede saltarse el plan

### Done Fase 3

- pagos operan con approval y plan persistido

### Done Fase 4

- disputas operan con caso consolidado y readiness para delegación

## Lo que no conviene hacer entre medio

- abrir más superficies de AI sin harness
- añadir tools de dominio sin policy
- meter plugins antes de consolidar runtime
- intentar multi-agent general antes de `DisputeHarness`

## Siguiente paso recomendado

Implementar `ProjectCopilotHarness` real.
