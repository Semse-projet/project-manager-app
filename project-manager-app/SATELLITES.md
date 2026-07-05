# SATELLITES.md — Registro operativo de satélites SEMSE

**Fuente de verdad del estado de cada satélite.** Gobernado por
`docs/specs/satellites/SAT-000-sdd-harness.spec.md` (FSM §3). Observer debe
coincidir con esta tabla (SAT-008); toda divergencia es señal de Consciousness.

**FSM:** `DRAFT → APPROVED → CONNECTED-STAGING → LIVE → SUSPENDED / ARCHIVED`

| Satélite | Spec | Estado | Token (id) | Scopes | Kill switch | Último heartbeat | Notas |
|---|---|---|---|---|---|---|---|
| semse-sdk (infra) | SAT-001 | APPROVED | — | — | `SATELLITE_TOKENS_ENABLED` | — | Prerrequisito de todos; SAT-000 también APPROVED |
| alexa | SAT-002 | DRAFT | — | `intake:write`, `intake:read` | `SATELLITE_ALEXA_ENABLED` | — | Lambda en `~/alexa-openai-skill` |
| mobile | SAT-003 | DRAFT | — | `jobs:*`, `milestones:read`, `events:subscribe` | `SATELLITE_MOBILE_ENABLED` | — | `~/labsemse/semse-mobile-app` |
| graphify | SAT-004 | DRAFT | — | `knowledge:read`, `events:subscribe` | `SATELLITE_GRAPHIFY_ENABLED` | — | Sidecar `semse-graphify` |
| storage | SAT-005 | DRAFT | — | `uploads:driver` (si HTTP) | `STORAGE_DRIVER` env | — | Unificar 2 copias locales |
| protools-embed | SAT-006 | DRAFT (LATENTE) | — | `tools:invoke` | `SATELLITE_PROTOOLS_ENABLED` | — | Token asumido público |
| webhooks (infra) | SAT-007 | DRAFT | — | — | `SATELLITE_WEBHOOKS_ENABLED` | — | Fase 3 |
| observer-nodes (infra) | SAT-008 | DRAFT | — | — | — | — | Fase 4 |

## Archivados (no se integran)

| Elemento | Ubicación | Motivo |
|---|---|---|
| labsemse_project | `~/app prototipos/labsemse_project` | Prototipo consolidado; matriz histórica |
| Entropía App / agent-runtime-starter | `~/nuevo proyecto` | Conceptos absorbidos por Autonomy Core |
| _satellites-archive (7 prototipos) | `~/labsemse/app semse/_satellites-archive` | Archivo histórico |
| labsemse-main | `~/labsemse-main` | Copia vieja del workspace; borrar tras verificación |
| app / app semse | `~/labsemse/app`, `~/labsemse/app semse/app` | LATENTE sin spec; candidatos a embed SAT-006 |

## Reglas

1. Cambiar el estado de un satélite = PR que edita esta tabla + evidencia del arnés (SAT-000 §2).
2. El secreto del token nunca aparece aquí; solo su id.
3. Revocar un token ⇒ actualizar esta tabla en el mismo cambio.
