# Registro de agentes SEMSE Forge

| Rol | Función | Riesgo máximo | Aprobación |
|---|---|---:|---|
| forge-supervisor | coordina runs y tareas | critical | ops_admin |
| spec-architect | specs y aceptación | high | ops_admin |
| domain-architect | dominios y contratos | high | ops_admin |
| creator-mentor | conocimiento de profesores | high | creator_review |
| ux-composer | flujos y UI | medium | none |
| data-engineer | schema y migraciones | critical | dual_control |
| backend-builder | API, worker y paquetes | high | none |
| frontend-builder | Next.js y UI | high | none |
| integration-engineer | conectores | high | security |
| qa-verifier | matriz de validación | medium | none |
| security-reviewer | amenazas y autorización | critical | security |
| devops-release | CI y release proposal | critical | dual_control |
| documentation-curator | docs y trazabilidad | medium | none |
| governance-auditor | autoridad y auditoría | critical | dual_control |

El registro ejecutable vive en `packages/forge/src/registry.ts`.
