# Diseño de Plan Mode para Payments y Disputes en SEMSE

## Objetivo

Definir `plan mode` como estado operativo antes de ejecutar acciones sensibles en `Payments` y `Disputes`.

## Problema actual

Hoy `SEMSE` ya tiene:

- `requiresApproval`
- `eligibility`
- `ActionRiskClassifier`
- `AgentWorkPlan`

Pero todavía no tiene una transición formal:

- `plan`
- `review`
- `execute`

## Definicion de Plan Mode

`Plan mode` es un estado en el que el agente puede:

- leer
- analizar
- organizar pasos
- preparar justificación
- proponer acciones

pero no debe ejecutar mutaciones sensibles directamente.

## Estados recomendados

```ts
type HarnessExecutionMode =
  | "assist"
  | "plan"
  | "review"
  | "execute"
  | "paused"
```

## Regla global

Toda acción `HIGH` por riesgo o toda acción con:

- dinero
- resolución de disputa
- cambio contractual
- liberación irreversible

debe pasar por:

1. `plan`
2. `review`
3. `execute`

## Payments Plan Mode

## Cuándo entra

Entrar a `plan` cuando:

- una acción implique `release_escrow`
- haya milestones aprobadas pero disputa abierta
- haya insuficiencia de saldo
- haya inconsistencia entre evidencia, milestone y pago

## Qué hace en `plan`

Debe producir:

- resumen del caso financiero
- milestones involucradas
- pagos relevantes
- estado de escrow
- riesgos
- prerequisitos faltantes
- propuesta de acción

## Output esperado

Debe serializarse como `AgentWorkPlan` con:

- `entityType = "Project"` o `"Milestone"`
- `agentRole = "payments-review"`
- pasos concretos
- bloqueo explícito si falta evidencia o approval

## Ejemplo de pasos

1. verificar milestone objetivo
2. verificar evidencia requerida
3. verificar disputas activas
4. verificar saldo de escrow
5. preparar recomendación
6. esperar decisión humana

## Transicion a review

Pasa a `review` cuando:

- el plan está completo
- no faltan datos esenciales
- la acción final está definida

## Transicion a execute

Solo cuando:

- approval humana registrada
- plan aprobado
- condiciones siguen vigentes

## Disputes Plan Mode

## Cuándo entra

Entrar a `plan` cuando:

- se propone abrir disputa compleja
- se propone resolver disputa
- existe conflicto entre contrato, evidencia y pagos
- se requiere coordinación entre varias fuentes

## Qué hace en `plan`

Debe producir:

- resumen del caso
- hechos observados
- documentos relevantes
- evidencia relevante
- impacto financiero
- riesgos de falsa resolución
- propuesta de resolución o siguiente paso

## Output esperado

`AgentWorkPlan` con:

- `entityType = "Dispute"`
- `agentRole = "dispute-orchestrator"` o similar
- tareas bloqueadas por falta de evidencia
- sugerencia de delegación si hace falta

## Ejemplo de pasos

1. resumir timeline del caso
2. mapear documentos y evidencia
3. validar impacto en milestones/pagos
4. identificar contradicciones
5. proponer resolución o investigación adicional
6. elevar a review humana

## Integracion con approval y risk

`ActionRiskClassifier` ya da una base útil.

Regla recomendada:

- `LOW` -> puede operar en `assist` o `execute`
- `MEDIUM` -> puede ejecutar con audit reforzado o entrar en `plan` si es multi-step
- `HIGH` -> debe entrar a `plan` y después `review`

## Integracion con AgentWorkPlan

`AgentWorkPlan` no debe ser opcional para estos casos. Debe ser el artefacto operativo.

Campos clave ya existentes:

- `status`
- `stepsJson`
- `approvedAt`
- `entityType`
- `entityId`

Estados útiles:

- `DRAFT`
- `ACTIVE`
- `COMPLETED`
- `CANCELLED`

## Integracion con UI

El copiloto no debe saltar directo de recomendación a ejecución.

Debe mostrar:

- modo actual
- resumen del plan
- pasos
- bloqueos
- qué approval falta
- qué entidad va a mutar si se ejecuta

## Integracion con journal

Cada transición debe auditarse:

- `entered_plan_mode`
- `plan_generated`
- `plan_blocked`
- `plan_approved`
- `execution_started`
- `execution_completed`

## Qué no hacer

- usar `plan mode` para todo
- convertir cada acción baja en proceso burocrático
- permitir ejecución `HIGH` saltándose el plan
- mezclar plan con chat sin artefacto persistido

## Recomendacion concreta

Antes de implementar más automatización en `Payments` y `Disputes`, conviene cerrar:

1. enum de modos del harness
2. política de transición a `plan`
3. contrato mínimo de `AgentWorkPlan.stepsJson`
4. UI de review/aprobación del plan

## Conclusión

`Plan mode` no debe verse como una pantalla más. Debe verse como el amortiguador de seguridad entre:

- análisis agentico
- recomendación
- mutación sensible

Para `Payments` y `Disputes`, ese amortiguador es obligatorio si queremos autonomía controlada en vez de simple automatización riesgosa.
