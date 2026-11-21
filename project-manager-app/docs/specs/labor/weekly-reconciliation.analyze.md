# Análisis de consistencia — `labor.weekly-reconciliation` (2026-11-21)

**Alcance:** spec v0.13 ↔ plan ↔ tareas ↔ constitución v1.1 ↔ `STATE_MACHINES.md` ↔ `EVENT_CATALOG.md` ↔ código en `main@86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f`. Es análisis documental; no ejecuta nada.

## Gaps que bloquean la aprobación

| ID | Gap | Evidencia | Tipo | Owner |
|---|---|---|---|---|
| A-01 | **`TimeEntry` cambia durante el plazo C3-17.** Plan 3 §9.4 dice que un cambio canónico deja el cotejo desactualizado y exige nueva revisión, pero las reglas aprobadas de C3-17 (R-C317-13…20) sólo prevén cambios del **parte**. No está definido si un cambio de `TimeEntry` (p. ej. una corrección BO-08 aprobada) invalida la constancia, reinicia el plazo o se ignora. | Plan 3 §9.4; spec §10.17.8 regla 4 | requiere decisión de producto | Dueño del producto |
| A-02 | **`packages/fsm` no existe.** La constitución fija «FSM explícito en `packages/fsm`» como decisión bloqueada; el paquete no está en `packages/`. Los estados del caso y de `LaborTimeCorrection` no están en `STATE_MACHINES.md`. | `ls packages`; `STATE_MACHINES.md` blob `559ff03d…` | requiere decisión de arquitectura | Owner de arquitectura |
| A-03 | **Eventos no catalogados.** `labor_correction.stale` y los eventos del caso (constancia, decisión, ajuste por vencimiento, reapertura) no existen en `EVENT_CATALOG.md`; `AGENTS.md` prohíbe inventarlos. | `EVENT_CATALOG.md` blob `3d206645…`, líneas 542–544 | bloqueado hasta incorporarlos por el proceso del catálogo | Owner de eventos |
| A-04 | **Art. VII y `TimeEvidence`.** El modelo existente no tiene `tenantId`. | `schema.prisma` | deuda heredada | Plan 6 |
| A-05 | **Art. III Evidence-first** vs. Evidence como referencia no decisoria (opción A de Plan 6). | spec §10.7; constitución Art. III | requiere confirmación | Dueño del producto + Plan 6 |
| A-06 | **Art. IV Payment Governance.** La base de facturación no libera fondos, pero alimenta la facturación. | spec §10.17 | requiere confirmación | Owner de Payments |
| A-07 | Gates técnicos ya conocidos: G01–G04, G06–G08, G10–G14, G19–G21, G23, G35 y B4-11/B4-12. | matriz de gates r5 | bloqueado | varios |

## Consistencia verificada

- Spec ↔ Plan 3: C3-01…C3-17, R-C317-01…20 y las reglas operativas coinciden con Plan 3 v75 §§9, 34–37.
- Spec ↔ tareas: cada prueba prevista de la spec tiene tarea en la Fase 1; ninguna tarea de código está marcada como hecha.
- Spec ↔ constitución: Art. I, II, V, VI, VII y XIII aparecen como no cumplidos y no se presentan como cumplidos. Art. VIII y X son coherentes.
- Lenguaje de estados: la spec no afirma implementación, CI, merge, deploy ni activación (todos `NOT_*`/`INACTIVE`).

## Resultado

**Con gaps.** La SDD no puede pasar a `REVIEW`/`APPROVED` hasta resolver A-01…A-03 y las decisiones de owners de A-05/A-06, además de los gates técnicos de A-07.
