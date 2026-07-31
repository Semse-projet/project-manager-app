# Mapa de convergencia de producción SEMSE

**Corte:** 2026-07-31
**Base observada:** `main/production@114cb9ca`; F3 contenido en `f1234291` y activo en canary
**Programa:** `platform.production-convergence-f3-f9`

## 1. Tesis aterrizada

```text
Una identidad
  actúa en un contexto autorizado
  -> Policy decide
  -> el dominio propietario cambia estado
  -> la transacción publica un evento durable
  -> Evidence demuestra
  -> Ledger registra el efecto económico
  -> Trust conserva la consecuencia
  -> Prometeo interpreta con fuentes
  -> Mission Control atiende excepciones
```

Esto no es un nuevo mega-servicio. Es un contrato de coordinación entre
bounded contexts existentes.

## 2. Componentes compartidos

| Nodo de la síntesis | Implementación actual | Decisión | Child slice |
|---|---|---|---|
| Principal/Identity | `User`, `Tenant`, `Org`, `Membership`, `AuthSession`, `packages/auth`, módulos `auth/users/organizations` | Conservar; normalizar `PrincipalContext` | F4/F8 |
| Context/Workspace | `OperationalContextSnapshot`, `workspace`, `developer-runtime`, context bridge | Evolucionar a scope común de org/vertical/recurso/sesión | F4/F7 |
| Policy/Approval | Role/Permission, guards, `PolicyRule`, payment governance, Prometeo approvals | Adaptar a `PolicyInput/PolicyDecision`; no retirar policies locales al inicio | F4/F5 |
| Project/Operation | `Job/Bid/Contract/Project/Milestone`, `BuildOpsProject` | `Project` canónico; BuildOps se enlaza por promoción controlada | F3 |
| Tasks/Labor | `JobTask`, `BuildOpsTask`, `AgroFarmTask`, `TimeEntry`, Labor Engine | `JobTask` como tarea canónica; adapters por vertical | F8 |
| Events | `DomainOutboxEvent`, `DomainEventConsumption`, BullMQ worker, F1 ops/replay; F3 `project.lifecycle-source-changed.v1` verificado en canary | Expandir productor por productor; mantener `ProductEvent` separado | F3/F4/F8 |
| Evidence | `Evidence`, evidence gateway, Vision, `MilestoneEvidenceItem`, Agro evidence | Evolucionar mediante expand/contract a subject/review/custody común | F8 |
| Payments | `PaymentEscrow`, `PaymentTxn`, Stripe, payment governance | Conservar como provider/release orchestration; no llamarlo ledger | F3/F5 |
| Finance/Ledger | invoices, expenses, credit ledgers verticales | Crear double-entry compartido y postings idempotentes | F5 |
| Trust/Risk | ratings, trust, disputes, `RiskScore`, `ProjectRiskScore` | Conservar; versionar rulebook y explicaciones | F3/F4 |
| Knowledge | `packages/knowledge`, RAG, Graphify, repo/runtime knowledge | Conservar separado de Evidence; gobernar fuentes/evals | F7 |
| Agent execution | `AgentRun`, Prometeo missions, BrowserMission, Forge, autonomy | Unificar envelope, budgets, approval, verify y compensation | F4/F7/F8 |
| Communications | `CommunicationThread`, `Communication`, outbound delivery | Conservar bandeja común; completar outbox/retry | F4/F8 |
| Offline/receipts | Agro sync, móvil/offline, idempotencias verticales | Crear receipt común `(tenant, device, clientEventId)` | F8 |
| Physical/Linux nodes | browser/developer runtime y satélites parciales | Primero Node Agent + Registry; no crear distro Linux | Después de F9 |

## 3. Autoridad de escritura

| Hecho | Autoridad | Consumidores permitidos |
|---|---|---|
| Identidad/membership | Auth/Core | Context, Policy, UI |
| Job/Bid/Contract | Connect/Marketplace/Contracts | F3, Trust, Product Intelligence |
| Project/Milestone | Projects/BuildOps | F3, Evidence, Payments |
| Evidence/review | Evidence | F3, readiness, Trust, Vision |
| Escrow/release | Payments + Payment Governance | F3, Ledger, Trust |
| Expense/time/cost | Finance/Labor/Vertical | F3/F5 |
| Journal entry | Shared Ledger F5 | Reporting, Mission Control, Prometeo |
| Risk/trust/dispute | Trust/Governance | F3, Policy, Matching |
| Projection | F3 consumer | Web, Prometeo, Mission Control; nunca write authority |

Agentes, UI y proyecciones no escriben directamente tablas ajenas. Invocan la
API/tool del dominio propietario con policy y auditoría.

## 4. Referencia transversal

La convergencia necesita una referencia común sin reemplazar FKs fuertes:

```ts
type SemseResourceRef = {
  tenantId: string;
  orgId?: string;
  workspaceId?: string;
  domain:
    | "core"
    | "connect"
    | "buildops"
    | "agro"
    | "payments"
    | "trust"
    | "knowledge"
    | "ai"
    | "integrations";
  resourceType: string;
  resourceId: string;
  projectId?: string;
  farmId?: string;
  jobId?: string;
};
```

Se introduce por child spec cuando Evidence, Ledger, agentes o receipts lo
necesiten; no se agrega como tabla polimórfica gigante en F3.

## 5. Recorridos canónicos

### Construcción

```text
Job -> Bid -> Contract -> Project -> Milestone
    -> Evidence -> Approval -> Payment release
    -> Ledger posting -> Trust signal -> Knowledge
```

### Agro

```text
Farm ownership -> offline task/receipt -> inventory movement
    -> Evidence -> production/sale -> Ledger -> Trust/Prometeo
```

### Labor

```text
TimeEntry draft -> submitted -> approved
    -> cost posting -> paid/exported
```

Una hora registrada no es automáticamente costo aprobado o pago.

### BuildOps–Agro

```text
Farm need -> Job -> Marketplace -> BuildOps Project
    -> Evidence -> Payment -> Ledger dimensioned by farm/project
```

## 6. Planos de plataforma

```text
EXPERIENCIA
  Next.js Web/BFF | Mobile | Prometeo | future Node Agent

CONTROL
  Identity | Context | Policy | Mission Control

EJECUCIÓN
  Connect | BuildOps | Agro | Labor | Payments | Agents

DATOS/MEMORIA
  PostgreSQL | Redis/BullMQ | Object Storage
  Events | Evidence | Ledger | Trust | Knowledge
```

## 7. Secuencia F3-F9

| Slice | Qué conecta | Qué no absorbe |
|---|---|---|
| F3 Projection | Connect + Project + Evidence + Payments + Expense + Risk | No modifica dominios |
| F4 Mission Control | Events + queues + approvals + incidents + runbooks | No se vuelve dominio de negocio |
| F5 Ledger | Payments + Finance + BuildOps + Agro + Labor | No reemplaza Stripe |
| F6 Agenda | availability + reservations + field ops + integrations | No mezcla timezone/routing ad hoc en UI |
| F7 Prometeo | multimodal + tools + context + approvals + sources | No acceso Prisma/secretos |
| F8 Domain Loops | loops/retries/receipts por vertical | No autonomía crítica sin review |
| F9 Hardening | SLO/OTel/DR/security/canary/retention | No declara cierre sin drills |

F3 cerró su gate para `tenant_default`: el read model es reconstruible mediante
`project-lifecycle-projection.v1`, con CAS, receipt, duplicado y replay
verificados. El producer de Evidence es transaccional; los demás hooks F3 son
post-commit best-effort y no sustituyen la adopción gradual de outbox por cada
dominio propietario.

## 8. Decisiones bloqueadas

- No big-bang rewrite.
- No dual-write indefinido.
- No ProductEvent en la outbox de negocio.
- No Trust como sustituto de Policy.
- No AI score como aprobación.
- No sumar monedas diferentes.
- No secrets completos en Context Bridge.
- No borrar legacy antes de backfill/shadow/canary.
- No distribución Linux antes de Node Agent y Control Plane.

## 9. Evidencia y estado

El estado operativo vive en:

- `docs/PRODUCTION_CONVERGENCE_TRACKER.md`
- `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`
- `docs/SPEC_INDEX.md`

Este mapa define ownership y dirección; no prueba que un child slice esté
implementado o activo.
