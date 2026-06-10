# Roadmap de endurecimiento — SEMSE Pro Tools v2

## Iteración 1 — Core Engine

Crear:

- types.ts
- validation-engine.ts
- risk-engine.ts
- cost-engine.ts
- labor-engine.ts
- material-engine.ts
- milestone-engine.ts
- evidence-engine.ts

## Iteración 2 — Business Engines

Crear:

- quote-engine.ts
- escrow-engine.ts
- admin-review-engine.ts
- change-order-engine.ts
- dispute-prevention-engine.ts
- report-engine.ts
- export-engine.ts

## Iteración 3 — Trade Engines críticos

Crear y endurecer:

- electrical.engine.ts
- roofing.engine.ts
- concrete.engine.ts
- plumbing.engine.ts
- hvac.engine.ts

## Iteración 4 — Trade Engines de volumen

Crear y endurecer:

- painting.engine.ts
- drywall.engine.ts
- flooring.engine.ts
- carpentry.engine.ts

## Iteración 5 — UI React

Crear:

- SemseProToolsDashboard.tsx
- TradeToolShell.tsx
- ToolInputForm.tsx
- ToolResultPanel.tsx
- QuotePanel.tsx
- EvidencePanel.tsx
- MilestonePanel.tsx
- RiskPanel.tsx
- PrometeoAdvisorPanel.tsx

## Iteración 6 — Backend

Crear:

- tools.module.ts
- tools.service.ts
- quotes.module.ts
- escrow.module.ts
- evidence.module.ts
- admin-review.module.ts

## Prioridad recomendada

1. Core Engine.
2. Quote + Escrow Engine.
3. Evidence / Inspection Engine.
4. Electrical Engine.
5. Roofing Engine.
6. Concrete Engine.
7. Plumbing Engine.
8. HVAC Engine.
9. Painting / Drywall / Flooring / Carpentry.
10. Dashboard unificado.

## Definition of Done

Una herramienta queda endurecida cuando tiene:

1. Inputs tipados.
2. Validación.
3. Cálculo de materiales.
4. Cálculo de mano de obra.
5. Cálculo de costo.
6. Risk score.
7. Warnings.
8. Recommendations.
9. Evidence required.
10. Milestones.
11. Export JSON.
12. Reporte cliente/profesional/admin.
13. Tests.
14. Independencia del DOM.
15. Integración preparada para backend.

