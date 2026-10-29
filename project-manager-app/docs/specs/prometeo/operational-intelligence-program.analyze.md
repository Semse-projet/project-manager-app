# Análisis de consistencia — Operational Intelligence (`prometeo.operational-intelligence-program`)

Fecha: 2026-10-25. Entrada: spec padre (`REVIEW`), plan (`DRAFT`), tasks (`PENDING`), checklist, ADR-044 (`PROPOSED`), `.specify/memory/constitution.md`, `docs/foundation/DOMAIN_INVARIANTS.md`, acta de reconciliación.

## Resultado

Sin contradicciones abiertas entre spec padre, plan y tasks para lo transversal. Hay brechas que bloquean la aprobación de los slices; ninguna se cierra en este documento.

## Constitución e invariantes

| Principio | Estado |
|---|---|
| Tenant, permisos y autoridad vienen del núcleo | Cubierto por spec §14; los nombres de permiso se fijan en cada hijo |
| Cada módulo es dueño de su dominio; sin escrituras cruzadas | Cubierto: el grafo es lectura federada; el ledger solo registra decisiones ya autorizadas |
| Datos `confidential`/`restricted` no van a LLM externo (Art. VIII) | Declarado (`privacyCritical: true`, spec §15); el mecanismo concreto está pendiente en el hijo |
| Eventos solo del catálogo | **Brecha:** los eventos del ledger no están en `EVENT_CATALOG.md`; se agregan con el slice 2 |
| No inventar transiciones de estado | Cubierto: solo FSM propia del ledger; **brecha:** aún no está en `STATE_MACHINES.md` |
| Sin cascada destructiva | **Brecha:** el borrado del tenant frente al ledger append-only no está resuelto (hijo del slice 2) |

## Brechas abiertas por slice (del acta)

- Slice 1: contrato base sin permisos, allowlist ni topes (G-*, D-04, D-07, D-14). Prueba técnica de Graphify pendiente (B-05).
- Slice 2: FSM, evento, idempotencia con 409, `tenantId` en las referencias, catálogo cerrado de `decisionKind`, primer productor (L-*, D-11).
- Slice 3: reutilizar H05 por referencia (D-02); unión decisión → acción sin `correlationId` (Q-24).
- Slice 4: repo, dueño, versión de contrato e identidad del consumidor (O-*, D-13, B-04).

## Dependencias externas

- H05 (`prometeo.tool-call-audit-lineage`): metadatos reconciliados en #1043; B-03 (estado actual del flag en Railway) sigue abierto.
- `platform.semse-mcp-project-read` y ADR-045: la frontera se fija en spec §15.
- ADR-042 (Universal Connector): relación con la identidad del consumidor de Omniverse por decidir (D-13).

## Conclusión

El padre queda consistente en `REVIEW`. No cumple aún los criterios para `APPROVED`: faltan el ADR-044 aceptado y los specs hijos reescritos.
