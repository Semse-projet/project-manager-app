---
type: checklist
feature: "weekly-reconciliation"
spec: "docs/specs/labor/weekly-reconciliation.spec.md"
version: "2.0"
date: "2026-11-21"
---

# Checklist — Conciliación semanal del Time Tracker (estado al 21-11-2026)

> `[x]` cumplido con evidencia documental · `[ ]` no cumplido · `[~]` parcial. Ningún punto marcado cumplido implica implementación, prueba ejecutada ni activación.

## Requisitos

- [~] Cada escenario P1 es verificable. Los casos de aceptación tienen prueba prevista (T-*), sin ejecutar. A-01 resuelto (R-C317-21). El cambio de `TimeEntry` después del ajuste está decidido por completo (G45 opción (b), R-C317-24; G45-R1/R2, R-C317-25/26).
- [x] El alcance y lo que queda fuera evitan ambigüedad: dentro del Time Tracker; sin app paralela; sin nómina, escrow ni pagos; OCR fuera del primer slice.
- [~] Los contratos API/UI/agente no se contradicen. Contrato lógico completo; sin endpoints elegidos. El intérprete de notas (§9.11) no tiene autoridad.
- [x] Decisiones de producto de C3-17 completas (C3-17, P-C317-01…09, 01b y 01c, G45 y G45-R1/R2; R-C317-01…26).

## Seguridad

- [ ] Los permisos se validan en backend. Las capabilities de captura, decisión y reapertura no existen (Plan 4). OPEN-SUP-04 (horas) decidido como producto (2026-11-23); conflictos K1–K6 pendientes; nada implementado.
- [ ] Tenant, organización, propiedad y alcance de recurso probados (T-R04/R05 sin ejecutar).
- [ ] Hay paso de aprobación para acciones críticas (decisión y reapertura con autoridad verificada). Evidencia de autoridad para reabrir solicitada a Plan 4: hoy no existe `case.reopen`.
- [~] Sin secretos ni PII en logs/evidencia. Minimización definida en la spec §10.13; sin implementar.
- [ ] Identidad de servicio verificable (G04).

## Datos y eventos

- [ ] La migración es reproducible y compatible (propuesta en el plan §4).
- [ ] Backfill, rollback o forward-fix definidos y aprobados.
- [ ] Estado y outbox atómicos (G07).
- [ ] Consumidores idempotentes y reejecutables (G12).
- [ ] CAS en todos los writers de TimeEntry (G10).
- [ ] Ubicación del FSM decidida (`packages/fsm` no existe).

## Evidencia y dinero

- [x] La evidencia no se confunde con aprobación automática (spec §10.7).
- [ ] Payment Governance: la base no emite facturas ni pagos (R-C317-23); **no se declara exenta**; falta la determinación del owner de Payments (A-06).
- [~] Evidence como respaldo de la decisión humana (R-C317-22); falta la confirmación del owner de Plan 6 (A-05).
- [x] Los cálculos excluyen propuestas y los 120 s sin causa del total confirmado (§10.16).
- [x] `TimeEntry` nunca se modifica desde la conciliación (C3-05, R-C317-02/17/20).

## Entrega (Art. XIII)

- [ ] Spec `APPROVED` · [ ] código · [ ] CI · [ ] merge · [ ] deploy · [ ] activación · [ ] migración · [ ] evidencia de producción.
