# ADR-042 — Universal Connector Trust Boundary

- **Date:** 2026-10-05
- **Status:** ACCEPTED — owner authorized completion and productionization of the Universal Connector subject to SEMSE governance gates.
- **Spec:** `docs/specs/platform/universal-connector-trust.spec.md`
- **Affected:** connectors/integrations, `packages/shared`, Prometeo/tool execution, Policy, Approval, audit/evidence.
- **Related:** ADR-025 MCP External Tool Gateway; ADR-035 agent approval governance; ADR-036 Prometeo agent boundary; `specs/prometeo/tool-registry-governance.spec.md`; `specs/platform/admin-integration-trust-status.spec.md`.

## Contexto
SEMSE ya posee adapters e integraciones provider-specific y autoridades separadas de Policy/Approval. El Universal Connector no debe crear una segunda arquitectura ni permitir que un provider, webhook, dato recuperado o agente se convierta en autoridad.

## Decisión
1. El Universal Connector es un **trust boundary provider-agnostic**, no un nuevo Business Kernel.
2. Los adapters existentes se conservan y se adaptan incrementalmente detrás del boundary.
3. `packages/shared/src/universal-connector` posee contratos neutrales y evaluación fail-closed reutilizable; no posee secretos ni reglas de negocio de cada dominio.
4. Policy y Approval siguen siendo autoridades externas/canónicas. El connector consume sus decisiones; no las redefine.
5. ADR-025/MCP y el Tool Registry siguen siendo la puerta para herramientas externas de Prometeo. Universal Connector aporta contexto, scopes, tenant isolation, connector status, trust/risk constraints y evidencia; no reemplaza el registry.
6. Prometeo puede seleccionar una capability registrada dentro de su autoridad delegada, pero nunca concederse scopes, auto-aprobar, alterar Policy o recibir credenciales del provider.
7. Datos externos, webhooks y outputs de IA son **datos, nunca autoridad**.
8. Toda operación es deny-by-default y debe demostrar actor, tenant, capability, scope, delegation cuando aplique, connector status, Policy y Approval cuando corresponda.
9. Operaciones de escritura están sujetas a read-only mode, idempotencia, blast radius y emergency controls.
10. La adopción de datos legacy es gradual: read-only → hybrid → managed migration → full cutover solo por decisión del cliente.

## Receive-Driven Development / trazabilidad
Cada requisito de seguridad debe cerrar esta cadena antes de producción:
`Requirement → Threat → Control → Enforcement Point → Test → Expected Result → Evidence`.
Una cadena incompleta mantiene el requisito en `IMPLEMENTED_UNVERIFIED` o `TESTED`; producción requiere evidencia suficiente para el gate aplicable.

## Consecuencias
- No hay acceso directo del connector al Business Kernel para saltarse servicios canónicos.
- No hay secretos de provider en Prometeo, envelopes o logs.
- Cambios de fingerprint/version/risk de tools pueden invalidar autorización previa.
- Cross-tenant, secret leak y bypass Policy/Approval son release blockers P0.
- Se requiere suite de conformance y evidence package por release.

## Rollout
1. Contratos + enforcement + tests.
2. Adaptar primero operaciones read-only.
3. Habilitar writes por capability y tenant tras conformance.
4. Canary y observabilidad de denies/anomalías.
5. Expandir adapters sin big-bang.

## Rollback / emergency
`DISABLE_WRITES`, `DISABLE_AGENT_ACCESS`, `SUSPEND_CONNECTION`, `EMERGENCY_STOP`. Ante P0, suspender writes/conexión y preservar evidencia; no degradar a un camino menos gobernado.
