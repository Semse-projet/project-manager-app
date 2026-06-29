# Arnés de Agentes para Mejoras del Ecosistema SEMSE

**Fecha:** 2026-06-28
**Estado:** ACTIVO
**Complementa:** `docs/AGENTIC_HARNESS.md`, `docs/specs/SEMSE_ECOSYSTEM_SDD_KIT_2026-06-28.md`

## Propósito

Este arnés define cómo repartir trabajo entre agentes profesionales y técnicos para mejorar SEMSE sin perder control humano, seguridad ni trazabilidad.

El agente no es solo un prompt. Un agente SEMSE es:

```text
Agent = manifest + contexto + memoria + herramientas + política + evaluación + audit trail
```

## Modelo operativo

1. El humano abre un `WorkItem`.
2. El coordinador clasifica riesgo, dominio, servicios y herramientas permitidas.
3. El coordinador reparte sub-tareas a agentes especializados.
4. Cada agente entrega hallazgos o cambios con evidencia.
5. El coordinador consolida un `DecisionPackage`.
6. El humano aprueba, rechaza o pide ajustes.
7. Solo después se implementa o se mergea.

## Contratos canónicos

### WorkItem

```ts
type WorkItem = {
  id: string;
  objective: string;
  riskLevel: "L0" | "L1" | "L2" | "L3" | "L4";
  services: string[];
  humanOwner: string;
  suggestedAgents: string[];
  contextRefs: string[];
  allowedTools: string[];
  forbiddenTools: string[];
  acceptanceCriteria: string[];
  rollbackRequired: boolean;
};
```

### AgentManifest

```ts
type AgentManifest = {
  key: string;
  role: string;
  domain: string[];
  canRead: string[];
  canWrite: string[];
  tools: string[];
  maxRiskWithoutHumanApproval: "L0" | "L1" | "L2";
  outputSchema: "FindingReport" | "PatchPlan" | "DecisionPackage";
};
```

### DecisionPackage

```ts
type DecisionPackage = {
  workItemId: string;
  recommendation: "approve" | "revise" | "reject" | "defer";
  summary: string;
  evidence: string[];
  risks: string[];
  tests: string[];
  rolloutPlan: string[];
  rollbackPlan: string[];
  humanDecisionRequired: boolean;
};
```

## Niveles de riesgo y permisos

| Nivel | Ejemplos | Qué puede hacer el agente |
|---|---|---|
| L0 | Documentos, auditorías, planes | Leer, proponer, editar docs |
| L1 | UI no crítica, copy, componentes aislados | Editar con tests/smokes |
| L2 | Auth, RBAC, tenant data, BFF, agents tools | Preparar patch y pruebas; requiere aprobación de merge |
| L3 | Payments, escrow, evidence legal, migraciones, deploy | No muta producción; requiere aprobación y rollback |
| L4 | Secretos, pagos reales, borrado, infra crítica | Solo humano autorizado ejecuta |

## Herramientas permitidas por defecto

- Lectura de repo con `rg`, `sed`, `git show`, `git diff`.
- Tests locales y builds del monorepo.
- Browser/Playwright para verificar UI.
- GitHub read para PRs, checks y logs.
- Railway read para estado, logs y deploy metadata.
- Web research cuando el bloque lo requiera, siguiendo el kit SDD.

## Herramientas restringidas

- Mutaciones de producción.
- Cambios en secretos o variables de entorno.
- Dashboard de pagos.
- Borrado de datos.
- Migraciones destructivas.
- Deploy manual fuera del pipeline.
- Comandos shell abiertos generados por el modelo cuando exista alternativa cerrada o template.

## Roster de agentes profesionales

| Agente | Responsabilidad | Salida esperada |
|---|---|---|
| Field Superintendent Agent | Campo, tareas, evidencia diaria, bloqueos | Reporte de ejecución y riesgos |
| Estimator Agent | Intake, alcance, estimación, materiales | Estimación explicable y supuestos |
| Scheduler/BuildOps Agent | Calendario, dependencias, crews, clima | Plan operativo y conflicto de agenda |
| Payments/Escrow Controller | Funding, milestones, release readiness | Checklist de pago y retención |
| Legal/Compliance Analyst | Disputas, evidencia, términos, auditoría | Riesgo legal y decisión recomendada |
| Evidence QA Agent | Fotos, EXIF, completeness, chain of custody | Score de evidencia y faltantes |
| Comms Agent | Mensajes a cliente/pro/ops | Borradores aprobables |
| Marketplace Trust Router | Matching, reputación, fraude básico | Routing y señales de confianza |
| Prometeo Concierge | Ayuda guiada, explicación del sistema | Respuesta contextual y next action |

## Roster de agentes técnicos

| Agente | Responsabilidad | Salida esperada |
|---|---|---|
| Runtime Architect | Unificar AgentRun, DeveloperRuntime y Autonomy | Diseño de runtime y contratos |
| Backend/API Architect | Specs, RBAC, tenant-safe repositories | Patch plan y pruebas API |
| Frontend/Design Systems Architect | Shell, navegación, tokens, responsive | Patch plan UI y screenshots |
| Security Engineer | Auth, BFF, OWASP, secrets, supply chain | Threat model y tests negativos |
| DevOps/SRE | Railway, CI/CD, readiness, rollback | Runbook y health gate |
| QA/E2E Engineer | Playwright, smoke, coverage, fixtures | Plan de pruebas y evidencia |
| Docs/Governance Curator | SDD, SPEC_INDEX, reportes, ADR | Documentación actualizada |

## Matriz de reparto inicial

| Bloque | Agentes requeridos | Gate humano |
|---|---|---|
| BFF auth/middleware | Security Engineer, Backend/API, QA/E2E | Sí, L2 |
| RBAC registry | Backend/API, Security, Docs/Governance | Sí, L2 |
| Agro IDOR | Backend/API, QA/E2E, Field Superintendent | Sí, L2 |
| `/v1/ready` + Railway gate | DevOps/SRE, Backend/API | Sí, L2 |
| Página servicio por servicio | Product/UX, Frontend, Prometeo Concierge | Revisión de producto |
| Intake público | Product/UX, Frontend, Backend/API, QA/E2E | Sí, L2 si toca auth/data |
| Navigation registry | Frontend, Docs/Governance | Revisión normal |
| AgentHarness v1 | Runtime Architect, Security, Docs/Governance | Sí, L2/L3 |
| Payments readiness | Payments Controller, Security, Backend/API | Sí, L3 |
| Evidence QA | Evidence QA, Legal/Compliance, Backend/API | Sí, L3 |

## Formato de reporte de agente

```markdown
# Agent Report: [agent-key] - [WorkItem]

## Contexto leído
- [archivos/specs/logs]

## Hallazgos
- [hallazgo con evidencia]

## Recomendación
- [acción concreta]

## Riesgos
- [riesgo residual]

## Validación
- [comandos, tests, screenshots, fuentes]

## Handoff
- [qué necesita el siguiente agente o humano]
```

## Evaluación

Cada agente se evalúa por:

- fidelidad al spec;
- precisión técnica;
- protección de tenant/ownership;
- pruebas o evidencia adjunta;
- claridad de riesgos;
- ausencia de scope creep;
- capacidad de handoff.

## Definición de terminado para una ejecución agentic

- `WorkItem` completo.
- Agentes asignados y reportes consolidados.
- `DecisionPackage` emitido si el riesgo es L2+.
- Validaciones registradas.
- Riesgos residuales y rollback claros.
- Humano aprobó cualquier acción L2+ antes de merge o producción.
