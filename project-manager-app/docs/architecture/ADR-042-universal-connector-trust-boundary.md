# ADR-042 — Universal Connector Trust Boundary

- **Date:** 2026-10-06
- **Status:** ACCEPTED — owner authorized completion and productionization subject to SEMSE governance gates.
- **Spec:** `docs/specs/platform/universal-connector-trust.spec.md`
- **Analyze:** `docs/specs/platform/universal-connector-trust.analyze.md`
- **Receive:** `docs/specs/platform/universal-connector-trust.receive.md`
- **Affected:** connectors/integrations, `packages/shared`, Prometeo/tool execution, Policy, Approval, audit/evidence.
- **Related:** ADR-025 MCP External Tool Gateway; ADR-035 agent approval governance; ADR-036 Prometeo agent boundary; `specs/prometeo/tool-registry-governance.spec.md`; `specs/platform/admin-integration-trust-status.spec.md`.

## Contexto
SEMSE ya posee adapters e integraciones provider-specific y autoridades separadas de Policy/Approval. El Universal Connector no debe crear una segunda arquitectura ni permitir que un provider, webhook, dato recuperado o agente se convierta en autoridad.

Product promise: **Connect first. Preserve always. Migrate when the owner chooses.**

Un cliente puede operar en READ_ONLY, HYBRID, MANAGED_MIGRATION o FULL_CUTOVER sin cambiar la arquitectura del connector.

## Decisión
1. El Universal Connector es un **trust boundary provider-agnostic**, no un nuevo Business Kernel.
2. Los adapters existentes se conservan y se adaptan incrementalmente detrás del boundary.
3. `packages/shared/src/universal-connector` posee contratos neutrales y evaluación fail-closed reutilizable; no posee secretos ni reglas de negocio de cada dominio.
4. Policy y Approval siguen siendo autoridades externas/canónicas. El connector consume sus decisiones; no las redefine.
5. ADR-025/MCP y Tool Registry siguen siendo la puerta para herramientas externas de Prometeo. Universal Connector aporta contexto, scopes, tenant isolation, connector status, trust/risk constraints y evidencia; no reemplaza el registry.
6. Prometeo puede seleccionar una capability registrada dentro de autoridad delegada, pero nunca concederse scopes, auto-aprobar, alterar Policy o recibir credenciales del provider.
7. Datos externos, webhooks, documentos, tool outputs y outputs de IA son **datos, nunca autoridad**.
8. Toda operación es deny-by-default y debe demostrar actor, tenant, capability, scope, delegation cuando aplique, connector status, Policy y Approval cuando corresponda.
9. Read, write, delete, sync, migrate y execute se autorizan por operación; no existe “permiso de connector” global.
10. Writes requieren idempotencia, risk budget, blast radius y emergency controls.
11. Control plane y data plane permanecen separados.
12. Secretos sólo se representan mediante referencias opacas y nunca entran en Prometeo, canonical envelopes o logs.
13. Webhook authenticity no equivale a business authorization.
14. Delegation es no transitiva y no puede exceder autoridad del delegador.
15. La adopción legacy es gradual: READ_ONLY → HYBRID → MANAGED_MIGRATION → FULL_CUTOVER sólo por decisión del cliente.
16. Exactly-once no se asume; seguridad de replay se obtiene mediante idempotencia/dedupe, checkpoints, reconciliation y compensation.
17. Conflictos ambiguos se conservan; no se permite blind last-write-wins cuando falta autoridad suficiente.
18. Trust levels son UNVERIFIED → VERIFIED → CERTIFIED → HIGH_ASSURANCE. Certificación demuestra conformance; no concede permiso operativo por sí sola.
19. Trust puede decaer después de cambios de schema/fingerprint/version/risk, incidentes o comportamiento anómalo; la autorización debe reevaluarse.
20. Owner/operator puede pausar sync, deshabilitar writes, deshabilitar agent access, suspender o revocar conexión.

## Mandatory trust chain
`Identity → Tenant → Runtime Binding → Capability → Scope → Delegation → Trust/Risk → Policy → Approval → Execution → Evidence`

La cadena puede incluir controles adicionales, pero ninguno de los anteriores puede ser sustituido por datos del provider o por una decisión del agente.

## Release blockers
### P0
- cross-tenant disclosure/mutation
- privilege escalation
- provider-secret exposure
- Policy bypass
- critical Approval bypass
- agent authority escalation
- uncontrolled destructive operation

### P1
- incomplete lineage for sensitive action
- unsafe replay/recovery
- broken effective-access representation
- connector isolation failure
- invalid webhook trust
- missing containment behavior

P0 no admite waiver silencioso. P1 requiere excepción explícita si la gobernanza vigente permite una excepción.

## Receive-Driven Development / trazabilidad
Cada requisito debe cerrar:

`Requirement → Threat → Control → Enforcement Point → Test → Expected Result → Evidence`

Una cadena incompleta mantiene el requisito por debajo de EVIDENCED/CERTIFIED.

## Consecuencias
- No hay acceso directo del connector al Business Kernel para saltarse servicios canónicos.
- No hay provider secrets en Prometeo, envelopes o logs.
- Cambios materiales en tools o connector trust pueden invalidar autorización previa.
- Cross-tenant, secret leak y bypass Policy/Approval son release blockers.
- Se requiere conformance + evidence package por release.
- Existing integrations se adaptan detrás del boundary; no se copian a una arquitectura paralela.

## Rollout
1. Contratos + enforcement + conformance suite.
2. Adaptar primero operaciones read-only.
3. Canary por tenant/conexión.
4. Habilitar writes por capability tras evidencia P0/P1.
5. Expandir adapters incrementalmente, sin big-bang.

## Rollback / emergency
`DISABLE_WRITES`, `DISABLE_AGENT_ACCESS`, `SUSPEND_CONNECTION`, `EMERGENCY_STOP`.

Ante P0, suspender writes/conexión y preservar evidencia. Nunca degradar a un camino legacy menos gobernado.
