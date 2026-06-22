# Arquitectura propuesta — SEMSE Pro Tools v2

## Estructura modular

```txt
semse-tools/
├── core/
│   ├── types.ts
│   ├── validation-engine.ts
│   ├── risk-engine.ts
│   ├── cost-engine.ts
│   ├── labor-engine.ts
│   ├── material-engine.ts
│   ├── milestone-engine.ts
│   ├── evidence-engine.ts
│   ├── quote-engine.ts
│   └── export-engine.ts
│
├── trades/
│   ├── concrete/
│   ├── carpentry/
│   ├── electrical/
│   ├── plumbing/
│   ├── painting/
│   ├── drywall/
│   ├── flooring/
│   ├── roofing/
│   └── hvac/
│
├── business/
│   ├── escrow-engine.ts
│   ├── dispute-engine.ts
│   ├── change-order-engine.ts
│   └── admin-review-engine.ts
│
└── ui/
    ├── SemseProToolsDashboard.tsx
    ├── ToolForm.tsx
    ├── ToolResultPanel.tsx
    ├── RiskBadge.tsx
    ├── QuoteSummary.tsx
    ├── MilestoneList.tsx
    └── EvidenceChecklist.tsx
```

## Principio arquitectónico

La UI solo captura datos y muestra resultados. Los cálculos deben vivir en motores puros, sin depender de React, DOM o HTML.

## Modelo común

Cada herramienta debe devolver un resultado estándar:

```ts
type SemseToolResult = {
  toolId: string;
  trade: string;
  projectType: string;
  mode: "client" | "professional" | "admin";
  inputs: Record<string, unknown>;
  validationIssues: ValidationIssue[];
  materials: MaterialItem[];
  labor: LaborEstimate;
  costs: CostSummary;
  risk: RiskResult;
  milestones: Milestone[];
  evidenceRequired: EvidenceItem[];
  warnings: string[];
  recommendations: string[];
  assumptions: string[];
  createdAt: string;
};
```

## Engines principales

- Validation Engine: evita datos inválidos.
- Risk Engine: calcula riesgo bajo, medio, alto o crítico.
- Cost Engine: calcula materiales, mano de obra, overhead, profit, fee SEMSE, impuestos y total.
- Labor Engine: estima horas, crew size, dificultad y urgencia.
- Material Engine: normaliza materiales.
- Milestone Engine: divide pagos según riesgo.
- Evidence Engine: define pruebas requeridas.
- Quote Engine: genera cotizaciones.
- Escrow Engine: define política de liberación de fondos.
- Dispute Prevention Engine: detecta señales tempranas de disputa.
- Change Order Engine: maneja cambios de alcance.
- Admin Review Engine: decide si un proyecto requiere revisión.

