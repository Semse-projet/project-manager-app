---
version: 1.0.0
fecha: 2026-03-30
estado: canonical
owner: ai-lead
fuente: Análisis MiniMax M2.7 + principios de agent harness
---

# 07_SELF_IMPROVING_AGENTS — Sistema de Agentes Auto-Mejorables

## Principio central

> El valor competitivo de SEMSEproject no viene solo de tener IA dentro de la plataforma, sino de tener agentes internos que **aprenden operativamente** de cada job, cada evidencia, cada disputa, cada scope y cada iteración del producto.

El patrón correcto no es "poner un modelo y dejar que evolucione solo". Es diseñar ciclos medibles de:

```
EJECUTAR → EVALUAR → REGISTRAR MEMORIA → CORREGIR → COMPARAR → CONSERVAR O REVERTIR
```

---

## Arquitectura en 4 capas

### Capa 1 — Agentes Ejecutores
Hacen trabajo concreto. Producen el output principal.

| Agente | Tarea principal |
|--------|----------------|
| ScopeAgent | Redactar scopes claros, medibles, con cantidades, QC y evidencia |
| EvidenceAgent | Clasificar fotos, detectar huecos, preparar paquetes probatorios |
| OpsAgent | Supervisar secuencias de jobs, bloqueos, desvíos de tiempo |
| MilestoneAgent | Revisar evidencia y consistencia antes de recomendar liberación de pago |
| ProductBuilderAgent | Analizar módulos del producto, detectar inconsistencias, proponer cambios |

### Capa 2 — Agentes Evaluadores
No producen el trabajo principal. Lo **revisan**. No pueden autoaprobar el trabajo de la Capa 1.

Responsabilidades:
- Verificar consistencia del output contra el estándar SEMSE
- Detectar contradicciones entre scope, evidencia y estado del job
- Medir calidad: ¿cumple el output el criterio mínimo de la operación?
- Emitir veredicto: `APPROVED | NEEDS_REVISION | ESCALATE_HUMAN`

**Regla crítica:** Un agente evaluador nunca es el mismo agente que ejecutó la tarea. Separarlos es lo que hace que el sistema sea confiable.

### Capa 3 — Memoria Operativa
No es memoria conversacional. Es **memoria de rendimiento**.

Qué se guarda:
- Por qué se rechazó un milestone (patrón de error)
- Qué formato de scope genera menos aclaraciones
- Qué tipo de evidencia reduce disputas
- Qué secuencias aceleran el cierre de jobs
- Qué prompts internos producen mejores resultados
- Qué cambios mejoraron métricas y cuáles las empeoraron

Almacenamiento: PostgreSQL + pgvector para búsqueda semántica de memoria relevante.

```prisma
model AgentMemory {
  id          String   @id @default(cuid())
  agentType   String   // scope | evidence | ops | milestone | product
  context     String   // descripción del contexto donde aplica
  pattern     String   // qué falló o qué funcionó
  outcome     String   // IMPROVED | NEUTRAL | DEGRADED
  metrics     Json     // métricas antes/después
  embedding   Unsupported("vector(1536)")?
  createdAt   DateTime @default(now())

  @@index([agentType])
}
```

### Capa 4 — Motor de Mejora Controlada
Compara versiones de prompts, checklists y reglas. Decide qué conservar y qué revertir.

**Regla absoluta:** Ningún cambio entra silenciosamente. Todo cambio es un experimento con:
1. Versión A (control) vs Versión B (candidato)
2. Métricas de evaluación definidas antes del experimento
3. Periodo de prueba con muestra suficiente
4. Decisión explícita: conservar o revertir
5. Registro en audit log

```typescript
interface AgentImprovement {
  agentType: string;
  changeType: 'prompt' | 'checklist' | 'flow' | 'validation_rule';
  versionA: string;   // control
  versionB: string;   // candidato
  metrics: {
    before: Record<string, number>;
    after: Record<string, number>;
  };
  decision: 'KEEP' | 'REVERT' | 'PENDING';
  approvedBy: string; // siempre requiere un owner humano
  appliedAt?: Date;
}
```

---

## Los 5 agentes prioritarios para SEMSEproject

Ordenados por impacto operativo inmediato:

### 1. ScopeAgent (Sprint 1)
**Propósito:** Generar scopes claros y medibles que reduzcan aclaraciones, change orders y retrabajo.

```
Input: descripción del job, tipo de servicio, presupuesto, plazos
Output: scope estructurado con secciones, cantidades, QC, evidencia requerida, hitos
Evalúa: ¿cuántas aclaraciones generó? ¿hubo change orders no anticipados?
Aprende: qué formato de scope reduce fricción por tipo de trabajo
```

### 2. EvidenceAgent (Sprint 2)
**Propósito:** Clasificar evidencia, detectar huecos documentales y preparar paquetes para milestones.

```
Input: fotos, documentos, descripción del scope, estado del job
Output: clasificación antes/durante/después, gaps detectados, paquete probatorio
Evalúa: ¿el paquete fue aprobado o requirió retrabajo? ¿generó disputa?
Aprende: qué evidencia falta con más frecuencia por tipo de trabajo
```

### 3. OpsAgent (Sprint 2)
**Propósito:** Supervisar secuencias de jobs, detectar bloqueos y proponer rutas optimizadas.

```
Input: estado del job, tiempos por etapa, historial de eventos
Output: diagnóstico de bloqueos, ruta propuesta, alertas de desvío
Evalúa: ¿el job mejoró su tiempo de ciclo? ¿se redujo el retrabajo?
Aprende: qué secuencias producen mejores cierres por tipo y zona
```

### 4. MilestoneAgent (Sprint 3)
**Propósito:** Revisar consistencia antes de recomendar liberación de pagos.

```
Input: scope, evidencia, porcentaje de avance, historial del profesional
Output: recomendación APPROVE | REQUEST_MORE_EVIDENCE | ESCALATE
Regla: si falta información crítica → abstenerse, nunca inventar
Evalúa: ¿la recomendación fue correcta? ¿hubo disputas post-liberación?
Aprende: qué señales predicen aprobación exitosa vs problemática
```

**Regla de abstención:** Este agente DEBE abstenerse cuando no tiene evidencia suficiente. Nunca recomienda aprobación con datos incompletos. Preferir falso negativo sobre falso positivo en operaciones financieras.

### 5. ProductBuilderAgent (Sprint 4)
**Propósito:** Analizar módulos del producto, detectar inconsistencias y proponer mejoras.

```
Input: código, schema, endpoints, UI, permisos
Output: inconsistencias detectadas, propuestas de cambio, impacto estimado
Evalúa: ¿el cambio mejoró la métrica objetivo? ¿introdujo regresiones?
Aprende: qué tipo de cambio tiene mayor impacto con menor riesgo
```

---

## KPIs que importan (métricas de negocio, no de modelo)

| KPI | Descripción | Responsable |
|-----|-------------|-------------|
| `scope_acceptance_rate` | % de scopes aceptados sin aclaraciones | ScopeAgent |
| `evidence_completeness_rate` | % de jobs con evidencia completa al primer intento | EvidenceAgent |
| `milestone_approval_rate` | % de milestones aprobados sin retrabajo documental | MilestoneAgent |
| `dispute_reduction_rate` | Reducción de disputas por falta de evidencia | EvidenceAgent |
| `job_cycle_time` | Tiempo medio desde creación hasta cierre | OpsAgent |
| `change_order_rate` | % de jobs con change orders no anticipados | ScopeAgent |
| `agent_abstention_rate` | % de veces que el agente se abstuvo correctamente | MilestoneAgent |
| `false_approval_rate` | % de aprobaciones que derivaron en disputa posterior | MilestoneAgent |

**Regla:** Sin línea base de estas métricas, no se puede saber si el sistema mejoró o solo cambió.

---

## Gobernanza: lo que nunca puede cambiar solo

Los agentes **no pueden modificar sin aprobación humana explícita:**

- Reglas de liberación de pagos
- Criterios de aprobación de milestones
- Plantillas de contratos
- Validaciones de disputas
- Criterios de matching que afecten decisiones de contratación
- Cualquier regla que impacte operaciones financieras

Para estos casos: el agente puede **proponer** el cambio, pero un human-in-the-loop debe **aprobar, medir y confirmar** antes de que entre en producción.

---

## Riesgos y mitigaciones

| Riesgo | Descripción | Mitigación |
|--------|-------------|------------|
| Optimización falsa | El sistema parece más rápido pero empeora calidad | Medir KPIs de calidad, no solo velocidad |
| Refuerzo de malos hábitos | El agente aprende atajos que funcionan a corto plazo | Evaluar a largo plazo, incluir métricas de disputas |
| Alucinación operativa | El agente completa información faltante en lugar de abstenerse | Regla de abstención obligatoria en agentes financieros |
| Cambios silenciosos | Reglas críticas cambian sin trazabilidad | Todo cambio requiere versión, audit log y rollback |
| Juez y parte | El mismo agente ejecuta y evalúa | Separación obligatoria Capa 1 / Capa 2 |

---

## Flujo completo de un job con agentes auto-mejorables

```
Cliente crea job
    ↓
[ScopeAgent Capa 1] → genera scope
    ↓
[EvaluadorScope Capa 2] → revisa calidad
    ↓ APPROVED
Job se activa → profesional acepta
    ↓
[OpsAgent Capa 1] → supervisa secuencia
    ↓ alerta de bloqueo
[EvaluadorOps Capa 2] → confirma diagnóstico
    ↓
Profesional sube evidencia
    ↓
[EvidenceAgent Capa 1] → clasifica y verifica
    ↓
[EvaluadorEvidencia Capa 2] → aprueba paquete
    ↓
Milestone listo para liberación
    ↓
[MilestoneAgent Capa 1] → revisa todo
    ↓ si falta info → ABSTIENE
    ↓ si completo → RECOMMEND_APPROVE
[Human-in-the-loop] → decisión final de pago
    ↓
[Memoria Operativa Capa 3] → registra patrón
    ↓
[Motor de Mejora Capa 4] → ¿este flujo fue mejor que el anterior?
    → si sí: conserva
    → si no: revierte
```

---

## Roadmap de implementación

| Sprint | Capa | Qué se construye |
|--------|------|-----------------|
| Sprint 1 | Capa 1 | ScopeAgent + estructura AgentRun + BullMQ queue |
| Sprint 2 | Capa 1 | EvidenceAgent + OpsAgent + Vision API |
| Sprint 3 | Capa 1+2 | MilestoneAgent + primeros EvaluatorAgents |
| Sprint 4 | Capa 3 | AgentMemory + pgvector + RAG contextual |
| Sprint 5 | Capa 4 | Motor de mejora controlada + experiment tracking |
| Sprint 6 | Orquestación | TriageAgent que coordina todo como "un solo asistente" |

---

## Relación con los otros documentos

- `04_AGENTIC_LAYER.md` → arquitectura técnica base (stack, schemas, BullMQ)
- `07_SELF_IMPROVING_AGENTS.md` → este documento, capa de auto-mejora
- `05_DATA_ARCHITECTURE.md` → AgentMemory, pgvector, knowledge layer
- `06_EXECUTION_ROADMAP.md` → fases y sprints de implementación
