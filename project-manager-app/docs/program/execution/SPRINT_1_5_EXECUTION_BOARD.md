# SPRINT_1_5_EXECUTION_BOARD

## Fecha
2026-03-15

## Objetivo del bloque
Cerrar una version demoable, entendible y estable del circuito visible actual de SEMSE.

## Regla de trabajo
Cada ticket debe:
- acercar la demo en <= 14 dias;
- poder cerrarse sin rehacer medio sistema;
- mejorar flujo, claridad o estabilidad visible;
- evitar expansion de scope.

---

# TABLERO

## COLUMNAS
- BACKLOG
- READY
- IN PROGRESS
- BLOCKED
- DONE

---

# TICKETS P0

## S1.5-T001 — Smoke del flujo visible
**Columna inicial:** READY  
**Objetivo:** detectar fallos reales del circuito visible, no suposiciones.  
**Alcance:**
- dashboard
- create job
- job detail
- create milestone
- evidence
- escrow
- release
- dispute create
- dispute resolve

**No tocar:**
- rediseños grandes de UI
- refactors amplios de backend
- nuevas features fuera del circuito visible

**Entregable:**
- script, checklist o harness reproducible
- lista priorizada de fallos reales
- resultado pass/fail por tramo

**Done criteria:**
- existe una forma repetible de correr el flujo visible
- se documentan los fallos encontrados
- se identifican P0/P1 de demo

**Lane sugerido:** QA / Smoke

---

## S1.5-T002 — Pulido de Job Detail
**Columna inicial:** READY  
**Objetivo:** volver claro y confiable el centro del shell comercial.  
**Alcance:**
- job summary
- milestones list
- acciones visibles
- labels y estados
- navegación a escrow/evidence/disputes

**No tocar:**
- intake avanzado completo
- nueva arquitectura de navegación global
- supply-side flows

**Entregable:**
- job detail más claro
- acciones agrupadas con mejor feedback
- estados visuales menos ambiguos

**Done criteria:**
- una persona nueva entiende qué está viendo sin explicación larga
- se distinguen mejor job, milestone, release y disputa

**Lane sugerido:** Product Shell

---

## S1.5-T003 — Release Feedback Cerrado
**Columna inicial:** READY  
**Objetivo:** que release no sea solo un botón, sino una acción comprensible.  
**Alcance:**
- loading state
- success state
- error state
- estado resultante del milestone
- refresco financiero visible si aplica

**No tocar:**
- rediseño total del ledger
- cambios financieros profundos no necesarios para la demo

**Entregable:**
- feedback visible de release
- claridad post-release
- menos ambigüedad entre approved y paid

**Done criteria:**
- el usuario entiende si release ocurrió, falló o quedó bloqueado
- la UI refleja mejor el resultado de la acción

**Lane sugerido:** Product Shell + Core Runtime

---

## S1.5-T004 — Disputes Visible Flow
**Columna inicial:** READY  
**Objetivo:** hacer que el camino de excepción sea navegable y demostrable.  
**Alcance:**
- open dispute
- list dispute
- resolve dispute
- estados claros
- filtrado básico si hace falta

**No tocar:**
- workflow de mediación complejo
- assignments avanzados
- centro de operaciones full disputes

**Entregable:**
- disputes visibles y entendibles desde job shell
- resolución visible
- mensajes más claros

**Done criteria:**
- una disputa puede abrirse y cerrarse desde producto
- el estado es visible y comprensible

**Lane sugerido:** Product Shell + Core Runtime

---

## S1.5-T005 — Demo Checklist
**Columna inicial:** READY  
**Objetivo:** tener una secuencia repetible para enseñar SEMSE sin improvisar.  
**Alcance:**
- precondiciones
- pasos
- rutas
- fallback plan
- errores conocidos

**No tocar:**
- docs estratégicos largos
- teoría de producto

**Entregable:**
- `SEMSE_DEMO_CHECKLIST.md`

**Done criteria:**
- existe un documento corto y usable para correr demo de 5-10 minutos

**Lane sugerido:** PM / Integración

---

## S1.5-T006 — Script de Arranque / Demo Runbook
**Columna inicial:** BACKLOG  
**Objetivo:** reducir fricción para levantar la build demostrable.  
**Alcance:**
- pasos de arranque
- variables/env mínimas
- seed/demo data si aplica
- comando o secuencia principal

**No tocar:**
- dockerización total si no es necesaria
- infraestructura nueva pesada

**Entregable:**
- runbook corto o script reproducible

**Done criteria:**
- cualquier colaborador puede arrancar la demo siguiendo pasos cortos

**Lane sugerido:** Demo Readiness

---

# TICKETS P1

## S1.5-T007 — Data Coherence del shell visible
**Columna inicial:** BACKLOG  
**Objetivo:** alinear shape de responses, labels y estados en UI.  
**Alcance:**
- nombres visibles
- status labels
- formatos básicos
- coherencia entre pantalla y runtime

**No tocar:**
- refactor masivo de schemas
- cambios de modelo no necesarios para la demo

**Entregable:**
- menos inconsistencias visibles
- labels más uniformes

**Done criteria:**
- el circuito visible usa lenguaje consistente y entendible

**Lane sugerido:** Data Coherence

---

## S1.5-T008 — Empty / Loading / Error States
**Columna inicial:** BACKLOG  
**Objetivo:** reducir sensación de app rota o incompleta.  
**Alcance:**
- dashboard
- job detail
- escrow
- evidence
- disputes

**No tocar:**
- rediseño visual completo
- animaciones complejas

**Entregable:**
- estados vacíos y de error más legibles

**Done criteria:**
- no quedan pantallas clave sin feedback básico de estado

**Lane sugerido:** Polish Controlado

---

## S1.5-T009 — Create Job sin inflar scope
**Columna inicial:** BACKLOG  
**Objetivo:** mejorar intake sin abrir una expansión peligrosa.  
**Alcance permitido:**
- estructura visual mejor
- validaciones más claras
- categorías/tipos básicos
- presupuesto/rango simple
- preview antes de crear

**No tocar:**
- intake avanzado completo
- matching sofisticado
- supply matching
- bookings profundos
- automation pesada

**Entregable:**
- create job más claro y usable

**Done criteria:**
- mejora visible sin cambiar el modelo principal del producto

**Lane sugerido:** Product Shell

---

## S1.5-T010 — Post-release state clarity
**Columna inicial:** BACKLOG  
**Objetivo:** dejar más claro el tramo approved -> paid / release outcome.  
**Alcance:**
- labels
- UI post-action
- milestone/payment visibility

**No tocar:**
- ledger completo si no es necesario
- pagos complejos multi-provider

**Entregable:**
- transición post-release más visible

**Done criteria:**
- después de release, el usuario entiende qué cambió realmente

**Lane sugerido:** Product Shell + Data Coherence

---

# TICKETS P2

## S1.5-T011 — Ledger visible por job
**Columna inicial:** BACKLOG
**Objetivo:** mostrar mejor el rastro financiero.
**Alcance:** lectura visible, no rediseño financiero profundo.
**No tocar:** providers complejos, reconciliación avanzada.
**Done criteria:** ledger básico visible por job.

---

## S1.5-T012 — Milestone timeline mejorada
**Columna inicial:** BACKLOG
**Objetivo:** hacer más comprensible la progresión del trabajo.
**Alcance:** visual timeline/list clarity.
**No tocar:** rediseño integral del front.
**Done criteria:** milestones más fáciles de leer y explicar.

---

# ORDEN RECOMENDADO DE EJECUCIÓN

## Ola 1
- S1.5-T001 Smoke del flujo visible
- S1.5-T002 Pulido de Job Detail
- S1.5-T003 Release Feedback Cerrado
- S1.5-T004 Disputes Visible Flow

## Ola 2
- S1.5-T005 Demo Checklist
- S1.5-T006 Script de Arranque / Demo Runbook
- S1.5-T007 Data Coherence del shell visible
- S1.5-T008 Empty / Loading / Error States

## Ola 3
- S1.5-T009 Create Job sin inflar scope
- S1.5-T010 Post-release state clarity

---

# REGLA DE CORTE

No abrir Sprint 2 hasta que:
- el circuito visible se recorra de punta a punta;
- exista smoke reproducible;
- exista checklist de demo;
- release y disputes puedan enseñarse con confianza.

---

# PREGUNTAS DE CIERRE POR SESIÓN

Al final de cada sesión responder:
1. qué quedó cerrado;
2. qué quedó parcial;
3. qué bloquea lo siguiente;
4. qué ticket pasa a READY / DONE.
