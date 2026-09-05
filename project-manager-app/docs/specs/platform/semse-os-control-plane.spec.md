---
id: platform.semse-os-control-plane
title: "SEMSE OS Capability Control Plane"
domain: platform
status: APPROVED
owner: semse-core
risk: critical
related_files:
  - docs/architecture/SEMSE_OS_SDD_HARNESS_ALIGNMENT.md
  - docs/architecture/ADR-023-semse-os-capability-control-plane.md
  - docs/security/SEMSE_OS_CONTROL_PLANE_THREAT_MODEL.md
  - docs/specs/platform/semse-os-control-plane.contracts.md
  - docs/specs/platform/semse-os-control-plane.verification.md
  - docs/agents/work-items/SEMSE_OS_CONTROL_PLANE_REVIEW_2026-07-19.md
  - docs/agents/agent-runtime/decision-packages/SEMSE_OS_CONTROL_PLANE_REVIEW_2026-07-19.md
  - packages/forge/src
  - packages/agents/src
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
  - forge-supervisor
  - governance-auditor
last_verified: 2026-07-19
approval_scope: plan_only
approved_review_digest: dc1edb5973bf6b51b3ff6708ec21d9cae7cf314d5f42dab4b0b893afb630f6b0
---

# Spec: SEMSE OS Capability Control Plane

## 1. Problema

SEMSE dispone de módulos, agentes y runtimes, pero necesita un contrato único
para describir, activar, observar, actualizar y desactivar capacidades por
workspace sin acoplar intención humana directamente a Docker o al proveedor.

## 2. Resultado esperado

Un Control Plane declarativo recibe el estado deseado de una capability,
resuelve dependencias, evalúa políticas, produce un plan auditable y delega la
ejecución a un runtime adapter. Mission Control conserva el estado observado y
Prometeo opera exclusivamente mediante herramientas gobernadas.

## 3. No alcance

- Reescribir módulos existentes como microservicios.
- Introducir Kubernetes en el MVP.
- Mutar Railway, secretos, pagos o producción.
- Permitir que Prometeo ejecute shell o Docker directamente.
- Crear otro runtime paralelo a `packages/agents`.

## 4. Actores y autoridad

| Actor | Autoridad |
| --- | --- |
| Workspace Admin | Solicita cambios de capabilities permitidas |
| Prometeo | Interpreta intención y propone; no autoaprueba |
| Governance | Evalúa policy, riesgo, permisos y aprobación |
| Control Plane | Reconcilia estado deseado y observado |
| Runtime Adapter | Ejecuta un plan autorizado |
| Mission Control | Observa salud, costo, incidentes y auditoría |

## 5. Invariantes

1. Toda operación está ligada a un `workspaceId` verificado en servidor.
2. Estado deseado no equivale a estado observado.
3. Ningún adapter ejecuta sin decisión de policy registrada.
4. Prometeo usa handles o credenciales temporales, nunca secretos directos.
5. Una capability solo está activa después de health y readiness.
6. Operaciones críticas requieren aprobación y rollback explícitos.
7. MCP sirve a agentes; API/eventos siguen siendo contratos del sistema.
8. Docker es un adapter, no la fuente de verdad del Control Plane.

## 6. Recursos mínimos

`CapabilityDefinition`, `CapabilityVersion`, `CapabilityInstallation`,
`RuntimeTarget`, `Operation`, `DeploymentPlan`, `ObservedState`, `Approval` y
`AuditEntry`. Los contratos exactos se definirán después de aprobar el spec;
este documento no autoriza cambios de Prisma.

## 7. Lifecycle propuesto

```text
REQUESTED -> PLANNED -> AWAITING_APPROVAL -> APPLYING -> VERIFYING -> ACTIVE
APPLYING/VERIFYING -> DEGRADED -> ROLLING_BACK -> ROLLED_BACK
                                      \-> BLOCKED
ACTIVE -> SUSPENDING -> SUSPENDED
```

La incorporación al catálogo de FSM y eventos es requisito preimplementación.

## 8. Escenarios P1

### Activar capability

**DADO** un workspace válido y una capability compatible  
**CUANDO** un administrador autorizado solicita activarla  
**ENTONCES** se crea una operación idempotente, se resuelven dependencias y se
evalúa policy  
**Y** solo se delega ejecución tras las aprobaciones requeridas  
**Y** se marca `ACTIVE` únicamente al verificar health/readiness.

### Rechazar operación no autorizada

**DADO** un actor sin permiso o una policy denegatoria  
**CUANDO** intenta cambiar el estado deseado  
**ENTONCES** no se invoca ningún runtime adapter  
**Y** se registra la decisión sin exponer datos cross-tenant.

### Recuperar despliegue fallido

**DADO** un plan con rollback aprobado  
**CUANDO** falla readiness o se supera el error budget  
**ENTONCES** se detienen acciones descendientes, se conserva evidencia y se
ejecuta o propone rollback según el riesgo.

## 9. Contratos pendientes antes de aprobación

- [x] Schema candidato de capability y compatibilidad semántica.
- [x] FSM y eventos candidatos definidos para revisión.
- [x] API surface candidata, pendiente de schemas Zod en implementación.
- [x] Aislamiento multi-tenant y ownership definidos en threat model.
- [x] Contrato del adapter y threat model inicial.
- [x] Idempotencia, leases y reconciliación definidos.
- [x] SLO, telemetría y rollback iniciales definidos.
- [x] Matriz de tests unitarios, contratos y end-to-end definida.
- [ ] FSM y eventos aceptados en los catálogos canónicos.
- [ ] Revisión humana de Security, Governance y Domain Architecture.

## 10. Criterios de aprobación

- [ ] Domain Architect valida límites con Forge, Agents y módulos existentes.
- [ ] Security/Governance aprueban permisos, secretos y aislamiento.
- [ ] Se acuerdan FSM, eventos y schemas sin duplicar contratos.
- [ ] El plan define un MVP sin extracción masiva de microservicios.
- [ ] QA define pruebas de idempotencia, fallo parcial y cross-tenant.
- [ ] Owner humano cambia el estado a `APPROVED`.

## 11. Documentos de revisión

- Contratos: `semse-os-control-plane.contracts.md`.
- Verification matrix: `semse-os-control-plane.verification.md`.
- ADR: `docs/architecture/ADR-023-semse-os-capability-control-plane.md`.
- Threat model: `docs/security/SEMSE_OS_CONTROL_PLANE_THREAT_MODEL.md`.
- WorkItem: `docs/agents/work-items/SEMSE_OS_CONTROL_PLANE_REVIEW_2026-07-19.md`.
- DecisionPackage: `docs/agents/agent-runtime/decision-packages/SEMSE_OS_CONTROL_PLANE_REVIEW_2026-07-19.md`.

El spec fue aprobado por el owner humano sobre el digest de revisión
`dc1edb5973bf6b51b3ff6708ec21d9cae7cf314d5f42dab4b0b893afb630f6b0`.
La aprobación autoriza crear el plan técnico únicamente. No autoriza tasks,
implementación, migraciones, deploy ni producción.
