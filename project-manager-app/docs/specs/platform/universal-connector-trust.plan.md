# Plan — Universal Connector Trust Contract v1

**Spec:** `platform.universal-connector-trust`  
**ADR:** ADR-042  
**Receive:** `universal-connector-trust.receive.md`

## Objetivo
Llevar el trust boundary desde contrato hasta producción sin crear una arquitectura paralela y manteniendo Policy, Approval, Tool Registry y Business Kernel como autoridades canónicas.

## Fases

### F1 — Gobernanza y ownership
- Consolidar artefactos dentro de `project-manager-app/`.
- Eliminar contratos/documentos duplicados fuera del workspace.
- Exportar el módulo desde el owner acordado por ADR-042.
- Indexar spec y ejecutar validación estricta.

### F2 — Enforcement P0
- Tenant/connection/envelope match.
- Capability + scopes.
- Delegation subset, expiry y risk budget.
- Connector status ACTIVE; deny SUSPENDED/REVOKED/QUARANTINED.
- READ_ONLY bloquea operaciones con efectos de escritura, incluido sync-write.
- Policy deny y Approval required.
- Trust level mínimo por capability.

### F3 — Conformance
- Unit tests de cada deny code y allow path.
- Tests de prompt-injection/data-is-not-authority.
- Secret scan.
- Idempotency x10 y recovery/checkpoint.
- Webhook replay/authenticity y blast-radius.

### F4 — Evidence package
Generar contract-version, requirement-matrix, conformance, tenant-isolation, authz, agent-security, secret-scan, recovery, threat-model, exceptions y provenance.

### F5 — Integración gradual
- Adaptar primero una capability read-only real.
- Canary por tenant/conexión.
- Writes permanecen deshabilitados hasta conformance P0/P1.

### F6 — Release
- `pnpm spec:index`.
- `pnpm spec:validate:strict`.
- typecheck/build/tests/CI verdes.
- Review sin blockers.
- Merge a main.
- Railway deploy ligado al SHA de merge.
- Health + provenance + smoke funcional.
- Actualizar evidencia y estado VERIFIED únicamente después de producción.

## Rollback
Ante cross-tenant, secret leak, Policy/Approval bypass o anomalía de mutaciones: `DISABLE_WRITES`/`SUSPEND_CONNECTION`/`DISABLE_AGENT_ACCESS`/`EMERGENCY_STOP`; preservar evidencia y no usar rutas legacy menos gobernadas como fallback.
