# SEMSE AI Event Flow

## Flujo principal

```mermaid
flowchart LR
  A["Evento del dominio"] --> B["DomainEventBus"]
  B --> C["AgentTriggerRouter"]
  C --> D["AgentRun creado"]
  D --> E["Worker / Executor"]
  E --> F["Output JSON validado"]
  F --> G{"Impacto sensible?"}
  G -- "No" --> H["Recomendacion o autofill limitado"]
  G -- "Si" --> I["ECV + Human Review Gate"]
  I --> J["Ops / usuario revisa"]
  H --> K["UI / modulo de dominio"]
  J --> K
  K --> L["AuditLog"]
  K --> M["Operational Memory"]
  M --> N["Trust / Risk / Matching futuro"]
```

---

## Activadores principales

```mermaid
flowchart TB
  J1["job.created"] --> A1["pricing"]
  J1 --> A2["risk"]
  J2["job.assigned"] --> A3["job-planner"]
  J2 --> A2
  M1["milestone.submitted"] --> A4["evidence-coach"]
  P1["payment.release_requested"] --> A2
  D1["job.disputed"] --> A5["dispute"]
  D1 --> A2
  C1["job.completed"] --> A6["trust-match"]
```

---

## Superficies de producto

```mermaid
flowchart LR
  A["Planner / Pricing"] --> B["Crear Job"]
  C["Marta / Job Planner"] --> D["Contrato y Milestones"]
  E["Felix / Evidence Coach"] --> F["Entrega de Evidencia"]
  G["Escrow / Risk"] --> H["Revision y Pago"]
  I["Vesper / Trust Match"] --> J["Reputacion y Matching"]
  K["Ops / ECV"] --> L["Panel de Revision y Escalacion"]
```

---

## Regla de oro

La IA en SEMSE debe seguir este circuito:

**evento de dominio -> agente correcto -> output tipado -> validacion -> accion visible -> auditoria -> memoria**
