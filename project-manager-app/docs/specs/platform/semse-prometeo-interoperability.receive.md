# Receive-Driven Development — SEMSE/Prometeo/Universal Connector/MCP

**Fecha:** 2026-10-15. **Spec:** `platform.semse-prometeo-interoperability`. **Estado:** diseño REVIEW, sin tests de implementación ni evidencia productiva en este paquete.

## Regla de evidencia

Toda capacidad sigue: **Requirement → Threat → Control → Enforcement point → Test → Expected result → Evidence → Activation scope**.

`NOT_IMPLEMENTED`: no hay implementación atribuible al slice. `IMPLEMENTED_UNVERIFIED`: código sin suite/evidencia aprobada. `TEST_AUTHORED`: test existente sin resultado de CI en HEAD. `TESTED`: suite pasó en SHA release. `EVIDENCED`: logs/capturas sanitizadas/SHAs disponibles. `CERTIFIED`: todos los gates incluyendo runtime+canary del ámbito aprobado.

El estado de una capa existente (ej. Universal Connector) no certifica su uso en una nueva tool MCP. Un PR fusionado no implica activación.

## Matriz de requisitos / test / evidencia

| ID | Requisito / amenaza | Control & enforcement | Test mínimo | Resultado esperado | Estado al 15-oct |
|---|---|---|---|---|---|
| INT-001 | No duplicar autoridad de negocio | API dominio; arquitecturas y owners | inspección de importaciones, rutas y persistencia | gateway sin acceso BD ni FSM propio | NOT_IMPLEMENTED en S1 |
| INT-002 | Lectura cross-tenant | auth + resource ownership pre-tool | tenant A lee recurso B | no contenido y respuesta homogénea | NOT_IMPLEMENTED en S1 |
| INT-003 | Exposición entre orgs del mismo tenant | membership vigente + org scope | usuario org A consulta B | deny sin leak | NOT_IMPLEMENTED en S1 |
| INT-004 | Privilegios por delegación excesiva | Tool Registry + Policy; capability/scope subset | conexión de servicio privilegiada, actor no | denied | NOT_IMPLEMENTED en S2 |
| INT-005 | Conexión no activa o revocada | status runtime ACTIVE-only en cada call | REVOKED con token aún válido | denied | NOT_IMPLEMENTED en nuevo MCP |
| INT-006 | Escritura vía lectura | read-mode manifest, API write reject | invocación write/sync/delete en S1 | ninguna mutación | NOT_IMPLEMENTED en S1 |
| INT-007 | Token/provider secret filtrado | secret reference + redaction | tracing y salida visible host | cero secretos y PII | NOT_IMPLEMENTED en S1 |
| INT-008 | Content injection | payload UNTRUSTED, no Policy from data | respuesta externa ordena autoapprove | aprobación sin cambio | NOT_IMPLEMENTED en S2 |
| INT-009 | SSRF/exfiltración | egress allowlist + DNS/redirect validation | IP privada/metadata/redirect | blocked y auditable | NOT_IMPLEMENTED en S2 |
| INT-010 | Pago sin permiso/Evidence fraudulenta | Payment Governance + Evidence authority | MCP solicita release sin gate | rechazo sin efecto | fuera MVP; test en child crítico |
| INT-011 | Reintentos con doble mutación | claim durable y fingerprint, outbox | repetir 10x, concurrente, restart | un efecto o conflicto | NOT_IMPLEMENTED en S5 |
| INT-012 | Operación sin auditoría | correlationId+auditRef, decision/actor | consulta autorizada | registro de la call | NOT_IMPLEMENTED en S1 |
| INT-013 | Interfaz no compatible | UI opcional y fallback textual | host sin soporte Apps | consulta usable sin widget | NOT_IMPLEMENTED en S3 |
| INT-014 | UI en otra org | backend authz sin confiar selector | org switch + cached view | datos anteriores ausentes | NOT_IMPLEMENTED en S4 |
| INT-015 | SDD drift vs Git/prod | reconciliation/CI/sha | PR #797, #859, ADR-025, ADR-042 | estados respaldados por recibos | INVESTIGATION_PENDING |
| INT-016 | Servidor externo no autorizado | ADR-025 gate + consent/scope | request sin aprobación de decisión | no componente habilitado | BLOCKED_BY_ADR-025 |

## Evidencia a recolectar por slice

- **S0:** SHA main; rutas/call graph/capability inventory; PR #797/#859; IDs ADR remediados; tabla por componente: SPEC/CODE/CI/MERGE/DEPLOY/ACTIVATION/E2E.
- **S1:** SHA tests contract+authz, API+MCP logs sanitizados, usuario A/B de tenants distintos y dos orgs, flag/canary, rollback, pantalla textual.
- **S2:** amendment ADR-025, manifest proveedor y scopes, test SSRF/confused deputy/revocation, resultados de red y auditable authorization.
- **S3:** host/version/entitlement probado, CSP/sandbox y resultado fallback en cliente no compatible.
- **S4:** membership/cambio org, revocación de acceso con token no vencido, persistencia del estado no cruzada.
- **S5:** approvalRef de humano, replay de idempotency, transacción/outbox, fault injection, kill switch y rollback.

## Criterios de rechazo automáticos

No cerrar slice si: falta owner o spec hija APPROVED; falta evidencia SHA; no se ejecutó CI terminal; sólo hay health 200; no hubo smoke autenticado; falla un test cross-tenant/org; el connector acepta cualquier estado distinto de ACTIVE; hay secretos en salida/log; data de proveedor decide policy; ocurren writes en READ_ONLY; no hay rollback o no se puede revocar.

## Trazabilidad documental

- Constitución: `.specify/memory/constitution.md`
- Regla SDD: `docs/SDD_GOVERNANCE.md`
- ADR-025 MCP aplazado (11-10-2026)
- ADR-042 Universal Connector Trust / ADR-042 Operational Intelligence Graph (ID collision)
- Contrato: `docs/specs/platform/universal-connector-trust.spec.md`
- Frontend reutilizable: `docs/program/semse-4d-field-memory/WORKSPACE_REUSE_AND_CONNECTORS.md`
- PR #797 y #859 (evidencia GitHub; no runtime)
