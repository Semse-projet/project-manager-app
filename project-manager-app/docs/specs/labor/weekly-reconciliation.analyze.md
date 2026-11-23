# Análisis de consistencia — `labor.weekly-reconciliation` (2026-11-21)

**Alcance:** spec v0.13 ↔ plan ↔ tareas ↔ constitución v1.1 ↔ `STATE_MACHINES.md` ↔ `EVENT_CATALOG.md` ↔ código en `main@86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f`. Es análisis documental; no ejecuta nada.

## Gaps que bloquean la aprobación

| ID | Gap | Evidencia | Tipo | Owner |
|---|---|---|---|---|
| A-01 | **`TimeEntry` cambia durante el plazo C3-17.** Plan 3 §9.4 dice que un cambio canónico deja el cotejo desactualizado y exige nueva revisión, pero las reglas aprobadas de C3-17 (R-C317-13…20) sólo prevén cambios del **parte**. No está definido si un cambio de `TimeEntry` (p. ej. una corrección BO-08 aprobada) invalida la constancia, reinicia el plazo o se ignora. | Plan 3 §9.4; spec §10.17.8 regla 4 | requiere decisión de producto | Dueño del producto **[21-11] Resuelto por decisión de producto: R-C317-21 (cotejo `STALE` terminal, cotejo nuevo y nueva notificación)** |
| A-02 | **`packages/fsm` no existe.** La constitución fija «FSM explícito en `packages/fsm`» como decisión bloqueada; el paquete no está en `packages/`. Los estados del caso y de `LaborTimeCorrection` no están en `STATE_MACHINES.md`. | `ls packages`; `STATE_MACHINES.md` blob `559ff03d…` | requiere decisión de arquitectura | Owner de arquitectura **[21-11] Sigue pendiente del owner de arquitectura; no se elige sin su aprobación** |
| A-03 | **Eventos no catalogados.** `labor_correction.stale` y los eventos del caso (constancia, decisión, ajuste por vencimiento, reapertura) no existen en `EVENT_CATALOG.md`; `AGENTS.md` prohíbe inventarlos. | `EVENT_CATALOG.md` blob `3d206645…`, líneas 542–544 | bloqueado hasta incorporarlos por el proceso del catálogo | Owner de eventos |
| A-04 | **Art. VII y `TimeEvidence`.** El modelo existente no tiene `tenantId`. | `schema.prisma` | deuda heredada | Plan 6 |
| A-05 | **Art. III Evidence-first** vs. Evidence como referencia no decisoria (opción A de Plan 6). | spec §10.7; constitución Art. III | requiere confirmación | Dueño del producto + Plan 6 **[21-11] Criterio de producto aprobado (R-C317-22); pendiente la confirmación del owner de Plan 6 (Art. III y custodia)** |
| A-06 | **Art. IV Payment Governance.** La base de facturación no libera fondos, pero alimenta la facturación. | spec §10.17 | requiere confirmación | Owner de Payments **[21-11] Pendiente del owner de Payments; no se declara exento del Art. IV (R-C317-23 sólo fija «no autoriza factura ni pago»)** |
| A-08 | **G45 — cambio de `TimeEntry` después del ajuste.** La propuesta (sin aprobar) deja la reapertura como opcional; Plan 3 §9.4 exige revisión nueva en «cualquier estado revisable». No está definido si el resultado por vencimiento es revisable. | spec §10.17.11; Plan 3 §9.4 | propuesta pendiente de aprobación | Dueño del producto **[22-11] Resuelto: el dueño eligió la opción (b), R-C317-24; ya no contradice §9.4. Quedan G45-R1 y G45-R2** |
| A-09 | **Autoridad para reabrir.** No existe `case.reopen` ni delegación en Labor; `org:labor:manage` sólo lo tienen CLIENT y OPS_ADMIN | `rbac.ts` blob `d344c29b…` | evidencia solicitada | Owner de Plan 4 |
| A-10 | **Contrato de etapa nueva**: concurrencia, idempotencia y auditoría de la reapertura | spec §10.11, B4-05 | contrato solicitado | Owner de Labor |
| A-07 | Gates técnicos ya conocidos: G01–G04, G06–G08, G10–G14, G19–G21, G23, G35 y B4-11/B4-12. | matriz de gates r5 | bloqueado | varios |

## Consistencia verificada

- Spec ↔ Plan 3: C3-01…C3-17, R-C317-01…20 y las reglas operativas coinciden con Plan 3 v75 §§9, 34–37.
- Spec ↔ tareas: cada prueba prevista de la spec tiene tarea en la Fase 1; ninguna tarea de código está marcada como hecha.
- Spec ↔ constitución: Art. I, II, V, VI, VII y XIII aparecen como no cumplidos y no se presentan como cumplidos. Art. VIII y X son coherentes.
- Lenguaje de estados: la spec no afirma implementación, CI, merge, deploy ni activación (todos `NOT_*`/`INACTIVE`).

## Resultado

**Con gaps.** La SDD no puede pasar a `REVIEW`/`APPROVED` hasta resolver A-01…A-03 y las decisiones de owners de A-05/A-06, además de los gates técnicos de A-07.

**Actualización 21-11:** A-01 está resuelto. Quedan abiertos A-02 (arquitectura), A-03 (eventos), A-04 (Plan 6), A-05 (confirmación de Plan 6), A-06 (Payments) y A-07, más la pregunta residual de un cambio de `TimeEntry` **después** del ajuste (spec §10.17.10). Sigue **con gaps**.

**Actualización 22-11:** se añaden A-08 (G45, propuesta pendiente), A-09 (autoridad para reabrir) y A-10 (contrato de etapa). Sigue **con gaps**.

**Actualización 22-11 (2):** A-08 está resuelto por decisión de producto (R-C317-24). Quedan las preguntas residuales G45-R1 (cómo se abre la revisión exigida) y G45-R2 (si su cotejo tiene un plazo C3-17), y los gates técnicos A-09/A-10. Sigue **con gaps**.

**Actualización 2026-11-22 (3):** G45-R1 y G45-R2 están resueltas por decisión de producto (R-C317-25, R-C317-26); G45 queda completo como decisión de producto. A-09 (Plan 4) se amplía: la autoridad debe cubrir también **iniciar** la revisión exigida. Siguen abiertos A-02…A-07, A-09 y A-10. Sigue **con gaps**.

**Revalidación 2026-11-23:** `origin/main` = `dbf64b7…` (#1054). No hay cambios en las rutas de Labor, TimeEntry, auditoría, autenticación ni esquema. `core.crew-supervisor-delegations` pasó a `APPROVED` (código `NOT_STARTED`); es la candidata a fuente de la delegación de supervisor para A-09/G46, pero no define acciones de conciliación y su OPEN-SUP-04 (nivel de acción, incluidas «horas») sigue abierto.

**Actualización 2026-11-23 (OPEN-SUP-04 horas):** la decisión del responsable del producto (`core.crew-supervisor-delegations` §3.1) introduce los conflictos **K1** (corrección del supervisor frente a C3-04 y a la decisión del 17-11) y **K2–K6** (revisor de propuestas, alcance de `org:labor:manage`, ámbitos de dueño, propias horas del supervisor, aprobación para pago y Payment Governance). Se documentan como decisiones pendientes y no se resuelven. Sigue **con gaps**.
