# Registro de progresión — Operational Intelligence (PR 0 y slices)

**Programa:** `prometeo.operational-intelligence-program` · **ADR:** [ADR-044](../../architecture/ADR-044-operational-intelligence-graph.md) (PROPOSED)
**Flujo:** paquete de handoff "SEMSE Operational Intelligence Package — 2026-10-04", recibido el 2026-10-15.
**Regla:** ningún paso avanza sin la aprobación explícita registrada aquí, con la revisión del repo aprobada.

## Roles

Designados por el owner el 2026-10-15.

| Rol | Quién | Puede aprobar |
|---|---|---|
| Aprobador de documentación y arquitectura | Owner del proyecto (@Samuelcastella) | Sí |
| Revisor de seguridad | Owner del proyecto (@Samuelcastella) | Sí, en su dominio |
| Revisor de usabilidad | Owner del proyecto (@Samuelcastella) | Sí, en su dominio |
| Autoridad de aprobación final | Owner del proyecto (@Samuelcastella) | Sí |
| Coordinador de progresión | Claude (sesión de Claude Code) | No: registra, coordina y escala |
| Responsable de cada slice | Claude (sesión de Claude Code) | No: prepara, implementa, valida y revierte |
| Revisión automática | Codex (connector de GitHub) y CI | No: aporta hallazgos, no aprueba |

## Estado por etapa

| Etapa | Estado | Revisión del repo | Seguridad | Usabilidad | Aprobación | Bloquea el siguiente paso |
|---|---|---|---|---|---|---|
| 1. Reconciliar PR 0 | **APROBADA** (2026-11-07; efectiva al fusionar el PR de cierre, después de #1105, #1106, #1107, #1108, #1109, #1115, #1116 y #1117) | Commit de merge del PR de cierre | Dispuesta por D-04 a D-09 | Dispuesta por D-15 | Owner, 2026-11-07: acta aprobada y ADR-044 aceptado | No |
| 2. Preparar slice 1 — Unified Operational Graph Contract | NO INICIADA | — | — | — | — | Requiere aprobar el spec del slice 1 (hoy `REVIEW`) |
| 3–5. Slice 1: implementar, validar, aprobar | NO INICIADA | — | — | — | — | — |
| Slice 2 — Decision Ledger | NO INICIADA | — | — | — | — | Requiere el slice 1 aprobado (orden del paquete) |
| Slice 3 — Unified Query and Lineage | NO INICIADA | — | — | — | — | Requiere el slice 2 aprobado |
| Slice 4 — Omniverse Read-Only Projection Adapter | NO INICIADA | — | — | — | — | Requiere el slice 3 aprobado |

## Etapa 1 — detalle

- **Responsable:** coordinador de progresión. **Aprobador:** owner (documentación y arquitectura, seguridad, usabilidad).
- **Criterios de entrada:**
  - PR 0 disponible: #800, merge `05af598`, 2026-10-06. Cumplido.
  - Repo disponible y revisión registrada. Cumplido.
  - Registro de progresión con roles: este documento. Cumplido.
  - Acta de reconciliación creada: [`operational-intelligence-program.reconciliation.md`](operational-intelligence-program.reconciliation.md). Cumplido.
  - Ninguna implementación iniciada: no hay código del programa en `apps/` ni en `packages/`. Cumplido.
  - Paquete disponible: **no**. El ZIP recibido solo contiene un índice de 619 bytes; el owner enviará el paquete completo.
- **Bloqueos abiertos:**
  - Falta el paquete completo.
  - ~~Decisiones D-01 a D-16 del acta, sin resolver.~~ Resueltas el 2026-10-25: el owner aceptó las recomendaciones del acta en bloque (ver Historial). Falta aplicarlas en documentos (sección 6 del acta).
  - B-03: confirmar con evidencia de Railway el estado real de H05 (migración y flag).
  - B-05 (prueba técnica de Graphify): resuelto en #1105, pendiente de merge.
  - Decisiones de cada slice: resueltas el 2026-11-06 y registradas en la sección 14.1 de los specs (#1106 a #1109, pendientes de merge). Siguen **pendientes de dato**: valores numéricos y SLO, plazos de retención, tenant del canary y la versión de `graphifyy` en producción.
- **Escalamiento:** todo al owner, que ocupa los roles de arquitectura, seguridad, usabilidad y aprobación.
- **Cambios aplicados:** solo este registro y el acta. No se modificó ningún spec, ADR ni código.

## Historial

| Fecha (UTC) | Evento | Revisión | Registrado por |
|---|---|---|---|
| 2026-10-15 | Owner designa roles: él mismo en todos los de aprobación; Claude coordina y es responsable de slices | `6eae43c` | Coordinador |
| 2026-10-15 | Owner indica que enviará el paquete completo (el ZIP recibido solo trae el índice) | `6eae43c` | Coordinador |
| 2026-10-15 | Revisión de solo lectura de los 21 documentos de PR 0 contra el repo; acta creada en estado EN CURSO | `6eae43c` | Coordinador |
| 2026-10-25 | Owner acepta en bloque las recomendaciones del acta para D-01 a D-16, sin modificar ninguna. Consecuencias registradas: ADR-044 se completa y se acepta con fecha antes de aprobar cualquier slice (D-01); el Decision Ledger y el provider runtime referencian H05 sin copiarlo (D-02); la tool del grafo no se expone por MCP hasta que exista un spec hijo (D-10); el orden de slices se mantiene 1 → 2 → 3 → 4 (D-16). Esto no aprueba el acta, no acepta aún ADR-044 ni aprueba ningún slice | `06dfd7b` (acta: blob `d91fe22`, sin cambios en `origin/main` al 2026-11-06) | Coordinador |
| 2026-11-06 | Owner responde «aplica todo» al plan de respuestas del coordinador. **A1** orden de fusión recomendado: #1042 → #1043 → #1105 → #1044 → #1106 a #1109. **A2** aceptar ADR-044 con fecha cuando #1043 y #1105 estén fusionados: el coordinador prepara el cambio de estado en un PR aparte; **el ADR sigue `PROPOSED` hasta entonces**. **A3** el owner autorizó aprobar el acta cuando, además de fusionar los PR de A1, se cumplan los requisitos de su §10 (paquete comparado, sección 6 completa); la aprobación **no** se da por hecha con esos merges: se registra después, de forma explícita y con SHA. **A4** (lectura de Railway del flag de H05) queda a cargo del owner. Decisiones S1 a S4 (módulo `operational-lineage`, permisos `lineage:*`, solo Graphify en el slice 1, primer productor del ledger, división del slice 3, identidad de servicio del consumidor, etc.) registradas en la sección 14.1 de cada spec. Fijar la versión de `graphifyy` queda decidido pero sin PR hasta confirmar la versión en producción. Ninguna decisión de esta fila aprueba un slice | `main` en `faf8ae00`; plan de respuestas A1–A4 y S1–S4 del coordinador (conversación del 2026-11-06); specs con las resoluciones en las ramas de #1106 (`3bc169a6`), #1107 (`1777404a`), #1108 (`12b9a9a9`) y #1109 (`25a16206`), pendientes de merge | Coordinador |
| 2026-11-07 | Comparación del paquete con PR 0 (B-01) en [`operational-intelligence-program.package-comparison.md`](operational-intelligence-program.package-comparison.md). Hay dos versiones con el mismo nombre, ambas íntegras según su manifiesto: PR 0 = V1 más los ajustes documentados, verificado archivo por archivo, sin rutas ni endpoints perdidos. V2 es una revisión posterior; sus contradicciones ya las resolvieron decisiones del owner y cuatro aportes (B01-1 a B01-4) quedan pendientes de su decisión. **B-01 cerrado.** Esto no aprueba el acta | `main` en `1e487168`; PR 0 `05af598d`; ZIP V1 SHA-256 `c9552cfb…9911`; ZIP V2 SHA-256 `f14725d8…6c97` | Coordinador |
| 2026-11-07 | Owner aplica B01-1 a B01-4: nombres de métricas candidatos en los cuatro slices y en el padre; herramienta `lineage.query_graph` (adaptada desde `semse.graph.query` por el `split(".")` del gateway); backlog de V2 y `related_files` en el padre. No aprueba specs ni el acta | ramas de #1106 a #1109 y #1117 | Coordinador |
| 2026-11-07 | Owner pide responder y avanzar según las recomendaciones del coordinador: **aprueba el acta (A3) y acepta ADR-044 (A2)**. Ambas efectivas al fusionar el PR de cierre de la etapa 1, que va después de #1105, #1106, #1107, #1108, #1109, #1115, #1116 y #1117. Siguen abiertos B-03 y la versión de `graphifyy` en producción, sin bloquear esta etapa. Ningún slice queda aprobado | PR de cierre de la etapa 1 | Coordinador |
