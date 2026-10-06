# Plan — Universal Connector Trust Contract v1

**Spec:** `platform.universal-connector-trust`  
**ADR:** ADR-042  
**Analyze:** `universal-connector-trust.analyze.md`  
**Receive:** `universal-connector-trust.receive.md`  
**Tasks:** `universal-connector-trust.tasks.md`  
**Checklist:** `universal-connector-trust.checklist.md`

## Objetivo
Llevar el trust boundary desde contrato hasta producción sin crear una arquitectura paralela y manteniendo Policy, Approval, Tool Registry y Business Kernel como autoridades canónicas.

## Principios de entrega
- Receive-Driven Development: ninguna afirmación de cierre existe sin la cadena Requirement → Threat → Control → Enforcement → Test → Expected Result → Evidence.
- Fail closed y least privilege.
- Datos externos son datos, nunca autoridad.
- Provider authentication no equivale a autorización de negocio.
- No se promete exactly-once; se usa idempotencia, dedupe, reconciliation y recovery.
- El control plane y el data plane permanecen separados.
- Los adapters no contienen Policy, Approval ni secretos expuestos a Prometeo.

## Fases

### F1 — Gobernanza y ownership
**Estado:** implementado documentalmente; validación automática pendiente.
- [x] Consolidar artefactos autoritativos dentro de `project-manager-app/`.
- [x] Definir ADR-042 como decisión arquitectónica.
- [x] Crear Spec, Analyze, Plan, Tasks, Receive y Checklist.
- [x] Exportar el módulo desde `@semse/shared`.
- [x] Consolidar/eliminar documento duplicado fuera del workspace.
- [ ] Regenerar `SPEC_INDEX.md`.
- [ ] Pasar `pnpm spec:validate:strict`.

### F2 — Enforcement P0
**Estado:** implementado; evidencia CI pendiente.
- [x] Actor/runtime/resource tenant match.
- [x] Connection/provider/runtime match.
- [x] Envelope tenant/connection/provider match.
- [x] Capability + exact operation + scopes.
- [x] Delegation subset, expiry, resource boundary y risk budget.
- [x] Sólo ACTIVE ejecuta.
- [x] READ_ONLY bloquea operaciones con efecto de escritura.
- [x] Policy deny y Approval required.
- [x] Trust level mínimo por capability.
- [x] Idempotency key obligatoria para writes.
- [x] Blast-radius limits.
- [x] DISABLE_WRITES, DISABLE_AGENT_ACCESS y EMERGENCY_STOP.

### F3 — Conformance
**Estado:** suite canónica creada; ejecución CI pendiente.
- [x] Unit tests de allow/deny principales con `node:test`.
- [x] Matriz non-ACTIVE.
- [x] Prompt-injection / data-is-not-authority.
- [x] Idempotency x10 y fingerprint mismatch.
- [x] Webhook bad signature + replay.
- [x] Blast-radius y emergency controls.
- [ ] Secret scan con evidencia del workflow.
- [ ] Recovery/checkpoint persistente en un adapter real.
- [ ] Compensation/reconciliation sobre una integración concreta.
- [ ] Canary de un capability read-only real.

### F4 — Evidence package
**Estado:** estructura definida; evidencia de ejecución pendiente.
El release debe producir: `contract-version.json`, `requirement-matrix.json`, `conformance-results.json`, `tenant-isolation-results.json`, `authz-results.json`, `agent-security-results.json`, `secret-scan-results.json`, `recovery-results.json`, `threat-model-version.json`, `exceptions.json` y `provenance.json`.

Los documentos de diseño no sustituyen estos resultados ejecutables.

### F5 — Integración gradual
**Estado:** pendiente después del CI contractual.
1. Adaptar primero una capability read-only real.
2. Activar por tenant/conexión canary.
3. Observar health, denies, retries, dedupe y anomalías.
4. Mantener writes deshabilitados hasta P0/P1 con evidencia.
5. Habilitar writes capability-by-capability, nunca por provider completo.

### F6 — Release
**Estado:** pendiente.
1. `pnpm spec:index`.
2. `pnpm spec:validate:strict`.
3. typecheck/build/unit tests/secret scan.
4. CI verde sobre el HEAD exacto.
5. Reconciliar con `main` y volver a ejecutar CI si cambia el SHA.
6. Resolver review blockers.
7. Merge a `main`.
8. Railway deploy ligado al merge SHA.
9. Health + runtime provenance + smoke/canary.
10. Actualizar `production_evidence`, delivery metadata y estado sólo después de producción.

## Rollback y containment
Ante cross-tenant, secret leak, Policy/Approval bypass, tool trust invalidado o anomalía de mutaciones:
- `DISABLE_WRITES`
- `DISABLE_AGENT_ACCESS`
- `SUSPEND_CONNECTION`
- `EMERGENCY_STOP`

Preservar evidencia. Nunca degradar a una ruta legacy menos gobernada como fallback.

## Criterio de finalización
El paquete está documentalmente completo cuando Spec + ADR + Analyze + Plan + Tasks + Receive + Checklist son coherentes y no existe una segunda fuente autoritativa. El feature sólo está VERIFIED/CERTIFIED cuando CI, merge, deploy y canary aportan evidencia sobre el SHA de release.
