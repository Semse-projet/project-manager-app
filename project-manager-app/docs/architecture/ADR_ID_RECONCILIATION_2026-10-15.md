# Acta de reconciliación ADR-042 / ADR-044 — 2026-10-15

**Tipo:** corrección de identificadores documentales, no decisión de arquitectura ni autorización de implementación.
**Rama:** `docs/sdd-adr044-mcp-authz-reconciliation-20261015`
**Relacionado:** `platform.semse-prometeo-interoperability` (PR #939 fusionado) y `prometeo.operational-intelligence-program` (REVIEW).

## Colisión verificada
Dos ADR distintos usaban la identificación `ADR-042`:
1. `ADR-042-universal-connector-trust-boundary.md`: **ACCEPTED**, 2026-10-06, owner autorizado sujeto a gates SDD; mantiene número **042** y texto original.
2. `ADR-042-operational-intelligence-graph.md`: **PROPOSED**, 2026-10-04, nunca equivale a aprobación; corregido a `ADR-044-operational-intelligence-graph.md`, conservando propuesta íntegra e historia rastreable en Git.

`ADR-043-write-once-storage-originals.md` (ACCEPTED, 2026-10-11) conserva su número.

## Tabla canónica
| ID | Archivo actual | Decisión / estado | Antiguo archivo |
|---|---|---|---|
| ADR-042 | `docs/architecture/ADR-042-universal-connector-trust-boundary.md` | Universal Connector trust boundary / ACCEPTED | sin cambio |
| ADR-043 | `docs/architecture/ADR-043-write-once-storage-originals.md` | Write-once originales / ACCEPTED | sin cambio |
| ADR-044 | `docs/architecture/ADR-044-operational-intelligence-graph.md` | Operational Intelligence Graph / PROPOSED | `ADR-042-operational-intelligence-graph.md` |

## Referencias y reglas
- `prometeo.operational-intelligence-program` y su task register citan ADR-044; SDD permanece REVIEW y su entrega NO cambia.
- La arquitectura de Field Memory/4D cita ADR-042 para Universal Connector y ADR-044 para Operational Intelligence.
- El SDD rector documenta la resolución, sin reescribir el hallazgo histórico original.
- El antiguo archivo fue retirado de la rama y el cambio quedó fusionado en PR #940 (`62ce802a436554bd6dae95e3cd8958975e74c9df`). Permanece en la historia Git; no se borraron commits.
- Cualquier referencia externa previa al antiguo enlace debe actualizarse manualmente; el diff muestra procedencia y el mapping anterior permite recuperarla.
- No se crea un tercer Business Kernel, runtime de conexión, grafo o policy engine mediante esta renumeración.
- No cambiar `ADR-025` (MCP Client externo pospuesto); cualquier nueva excepción necesita decisión independiente.

## Verificación de cierre
- [x] PR #940 renumeró la propuesta operacional a ADR-044 y conservó el ADR-042 aceptado de Universal Connector; ver diff y merge SHA.
- [x] Referencias canónicas conocidas (programa Operational Intelligence y Field Memory SYSTEM_ARCHITECTURE) se actualizaron en #940; la mención histórica del antiguo nombre se conserva deliberadamente en esta acta. Nuevos documentos deben usar ADR-044.
- [x] GitHub Actions CI #940 `quality-gates`, `unit-coverage`, `e2e` PASS; validación SDD estricta comprobada en quality-gates.
- [x] PR #940 fusionado 2026-10-15, SHA `62ce802a436554bd6dae95e3cd8958975e74c9df`. Esto NO implica que ADR-044/ADR-045 estén ACCEPTED ni que MCP esté desplegado o activo; no hubo reviews humanos formales registrados.
