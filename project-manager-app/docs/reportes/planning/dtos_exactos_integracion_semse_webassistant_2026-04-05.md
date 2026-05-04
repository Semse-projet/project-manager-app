# DTOs Exactos de Integración SEMSE + WebAssistant

Fecha: 2026-04-05

Documentos relacionados:

- [informe_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/informe_integracion_semse_webassistant_2026-04-05.md)
- [blueprint_detallado_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/planning/blueprint_detallado_integracion_semse_webassistant_2026-04-05.md)
- [backlog_ejecucion_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/planning/backlog_ejecucion_integracion_semse_webassistant_2026-04-05.md)

## Objetivo

Definir los DTOs exactos que deberían consolidarse en `packages/schemas` para soportar la integración entre:

- `SEMSE` como source of truth de dominio
- `WebAssistant` como workspace y capa de experiencia

## Estado actual del repo

Hoy el paquete ya tiene base útil en:

- [index.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/index.ts)
- [project.schema.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/project.schema.ts)
- [marketplace.schema.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/marketplace.schema.ts)
- [payment.schema.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/payment.schema.ts)
- [dispute.schema.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/dispute.schema.ts)
- [evidence.schema.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/evidence.schema.ts)
- [trust.schema.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/trust.schema.ts)
- [ops.schema.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/ops.schema.ts)
- [client.types.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/client.types.ts)
- [escrow-view.types.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/escrow-view.types.ts)

Brechas claras:

- faltan DTOs compuestos para UI de proyecto
- faltan views exactas para `Docs`, `AI`, `RAG`, `Field Ops`
- falta separación más limpia entre:
  - command DTOs
  - query DTOs
  - view DTOs
  - event DTOs

---

## 1. Organización recomendada de archivos en `packages/schemas/src`

Estructura propuesta:

```text
project.schema.ts
project.view.ts
document.schema.ts
document.view.ts
agent.schema.ts
agent.view.ts
rag.schema.ts
rag.view.ts
field-ops.schema.ts
field-ops.view.ts
payment.schema.ts
payment.view.ts
dispute.schema.ts
dispute.view.ts
common.api.ts
identity.view.ts
activity.view.ts
domain-events.schema.ts
index.ts
```

### Convención

- `*.schema.ts` = Zod + input/output de API
- `*.view.ts` = DTOs TS compartidos para frontend y composición
- `common.api.ts` = envelopes, pagination, errors

---

## 2. DTOs transversales

## 2.1 ApiMeta

```ts
export interface ApiMeta {
  requestId: string;
  version?: string;
  warnings?: string[];
  nextCursor?: string | null;
}
```

## 2.2 ApiErrorShape

```ts
export interface ApiErrorShape {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "VALIDATION_ERROR"
    | "CONFLICT"
    | "PRECONDITION_FAILED"
    | "DOMAIN_RULE_VIOLATION"
    | "RATE_LIMITED"
    | "UPSTREAM_UNAVAILABLE";
  message: string;
  requestId: string;
  details?: unknown;
}
```

## 2.3 ApiResponse

```ts
export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
}
```

## 2.4 ActorContextView

```ts
export interface ActorContextView {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
  sessionId?: string;
}
```

## 2.5 AllowedAction

```ts
export type AllowedAction =
  | "PROJECT_EDIT"
  | "PROJECT_CANCEL"
  | "DOC_EDIT"
  | "DOC_PUBLISH"
  | "AI_RUN"
  | "AI_EXECUTE_ACTION"
  | "FIELDLOG_CREATE"
  | "PAYMENT_APPROVE"
  | "PAYMENT_RELEASE"
  | "PAYMENT_REFUND"
  | "DISPUTE_OPEN"
  | "DISPUTE_ASSIGN"
  | "DISPUTE_RESOLVE";
```

## 2.6 EligibilityView

```ts
export interface EligibilityView {
  allowed: boolean;
  reasons: string[];
}
```

---

## 3. DTOs de identidad

## 3.1 UserIdentityView

```ts
export interface UserIdentityView {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  orgId: string;
  tenantId: string;
  roles: string[];
}
```

## 3.2 SessionView

```ts
export interface SessionView {
  actor: UserIdentityView;
  issuedAt: string;
  expiresAt?: string | null;
}
```

---

## 4. DTOs de Projects

## 4.1 ProjectSummary

Reemplaza gradualmente la forma mínima actual.

```ts
export interface ProjectSummary {
  id: string;
  tenantId: string;
  orgId: string;
  jobId?: string | null;
  name: string;
  slug: string;
  status: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
  assignedProOrgId?: string | null;
  trustLevel?: "low" | "medium" | "high";
  updatedAt: string;
}
```

## 4.2 ProjectView

```ts
export interface ProjectView {
  id: string;
  tenantId: string;
  orgId: string;
  name: string;
  slug: string;
  description?: string | null;
  status: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
  clientOrgId: string;
  ownerUserId: string;
  assignedProOrgId?: string | null;
  jobId?: string | null;
  budget?: {
    amount?: number | null;
    currency?: string | null;
    type?: "FIXED" | "TIME_AND_MATERIALS" | null;
  } | null;
  tags?: string[];
  blockedReason?: string | null;
  createdAt: string;
  updatedAt: string;
  allowedActions?: AllowedAction[];
}
```

## 4.3 ProjectWorkspaceView

DTO compuesto para la pantalla principal.

```ts
export interface ProjectWorkspaceView {
  project: ProjectView;
  jobs: JobCardView[];
  milestones: MilestoneView[];
  trust?: TrustSnapshotView | null;
  warnings: string[];
  recentActivity: ActivityItemView[];
}
```

## 4.4 JobCardView

```ts
export interface JobCardView {
  id: string;
  title: string;
  category?: string | null;
  status:
    | "DRAFT"
    | "PUBLISHED"
    | "RESERVED"
    | "ACCEPTED"
    | "IN_PROGRESS"
    | "REVIEW"
    | "DISPUTE"
    | "COMPLETED"
    | "CANCELLED";
  budgetType?: "FIXED" | "TIME_AND_MATERIALS" | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  updatedAt: string;
}
```

## 4.5 MilestoneView

```ts
export interface MilestoneView {
  id: string;
  jobId: string;
  projectId?: string | null;
  sequence: number;
  title: string;
  description?: string | null;
  amountCents: number;
  status: "DRAFT" | "AWAITING_REVIEW" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";
  evidenceCount: number;
  dueDate?: string | null;
  updatedAt: string;
}
```

---

## 5. DTOs de Docs

## 5.1 DocumentStatus

```ts
export type DocumentStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
```

## 5.2 DocumentType

```ts
export type DocumentType =
  | "brief"
  | "contract"
  | "scope"
  | "spec"
  | "worklog_report"
  | "incident_report"
  | "evidence_note"
  | "decision_memo"
  | "ops_note";
```

## 5.3 DocumentSummaryView

```ts
export interface DocumentSummaryView {
  id: string;
  projectId: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  publishedVersionId?: string | null;
  lastEditedAt: string;
  updatedByUserId: string;
}
```

## 5.4 DocumentView

```ts
export interface DocumentView {
  id: string;
  projectId: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  contentFormat: "markdown" | "html" | "json";
  content: string;
  summary?: string | null;
  tags?: string[];
  linkedEntities: LinkedEntityRef[];
  publishedVersionId?: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  allowedActions?: AllowedAction[];
}
```

## 5.5 DocumentVersionView

```ts
export interface DocumentVersionView {
  id: string;
  documentId: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED";
  contentFormat: "markdown" | "html" | "json";
  content: string;
  createdByUserId: string;
  createdAt: string;
  changelog?: string | null;
}
```

## 5.6 LinkedEntityRef

```ts
export interface LinkedEntityRef {
  entityType: "project" | "job" | "milestone" | "evidence" | "dispute" | "payment" | "worklog";
  entityId: string;
}
```

---

## 6. DTOs de AI

## 6.1 AgentRunView

Extiende el schema de input actual.

```ts
export interface AgentRunView {
  id: string;
  projectId?: string | null;
  correlationId: string;
  agentType: "pricing" | "job-planner" | "evidence-coach" | "risk" | "dispute";
  triggerType: "manual" | "event" | "schedule";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  inputSummary?: string | null;
  outputSummary?: string | null;
  createdAt: string;
  completedAt?: string | null;
  deadLettered?: boolean;
}
```

## 6.2 CopilotMessageView

```ts
export interface CopilotMessageView {
  id: string;
  projectId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  citations?: CitationRef[];
  runId?: string | null;
}
```

## 6.3 CopilotActionView

```ts
export interface CopilotActionView {
  id: string;
  type:
    | "PROJECT_UPDATE"
    | "DOC_CREATE"
    | "DOC_PUBLISH"
    | "PAYMENT_APPROVE"
    | "PAYMENT_RELEASE"
    | "DISPUTE_CREATE"
    | "DISPUTE_RESOLVE"
    | "FIELDLOG_CREATE";
  label: string;
  payload: Record<string, unknown>;
  eligibility: EligibilityView;
  requiresApproval: boolean;
}
```

## 6.4 ProjectAgentContextView

```ts
export interface ProjectAgentContextView {
  project: ProjectSummary;
  jobs: JobCardView[];
  milestones: MilestoneView[];
  documents: DocumentSummaryView[];
  disputes: DisputeSummaryView[];
  payments: PaymentSummaryView[];
  trust?: TrustSnapshotView | null;
}
```

---

## 7. DTOs de RAG

## 7.1 CorpusVisibility

```ts
export type CorpusVisibility = "PRIVATE_PROJECT" | "TEAM" | "ORG" | "PUBLIC";
```

## 7.2 CorpusStatusView

```ts
export interface CorpusStatusView {
  projectId: string;
  status: "PENDING" | "INDEXING" | "READY" | "FAILED" | "STALE";
  lastIndexedAt?: string | null;
  indexedDocuments: number;
  indexedEvidence: number;
}
```

## 7.3 SearchQueryInput

```ts
export interface SearchQueryInput {
  query: string;
  topK?: number;
  filters?: {
    types?: ("document" | "evidence" | "worklog" | "dispute" | "contract")[];
    visibility?: CorpusVisibility[];
  };
}
```

## 7.4 SearchResultChunkView

```ts
export interface SearchResultChunkView {
  chunkId: string;
  sourceType: "document" | "evidence" | "worklog" | "dispute" | "contract";
  sourceId: string;
  sourceTitle?: string | null;
  excerpt: string;
  score: number;
  visibility: CorpusVisibility;
}
```

## 7.5 CitedAnswerView

```ts
export interface CitedAnswerView {
  answer: string;
  citations: CitationRef[];
}
```

## 7.6 CitationRef

```ts
export interface CitationRef {
  sourceType: "document" | "evidence" | "worklog" | "dispute" | "contract";
  sourceId: string;
  chunkId?: string | null;
  label: string;
}
```

---

## 8. DTOs de Field Ops

## 8.1 FieldUnitView

Basado en la estructura existente en frontend local.

```ts
export interface FieldUnitView {
  id: string;
  projectId: string;
  code: string;
  name?: string | null;
  address?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "ON_HOLD" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}
```

## 8.2 WorklogView

```ts
export interface WorklogView {
  id: string;
  projectId: string;
  fieldUnitId: string;
  date: string;
  doneToday: string;
  pendingNext: string;
  blockers?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
}
```

## 8.3 KnowledgeFactView

```ts
export interface KnowledgeFactView {
  id: string;
  projectId: string;
  worklogId?: string | null;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  visibility: "TEAM" | "ORG" | "PUBLIC";
  createdBy: string;
  createdAt: string;
}
```

## 8.4 ComplianceDocView

```ts
export interface ComplianceDocView {
  id: string;
  vendorId: string;
  type: string;
  status: "MISSING" | "PENDING" | "APPROVED" | "EXPIRED";
  fileUrl?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}
```

## 8.5 VendorView

```ts
export interface VendorView {
  id: string;
  projectId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  compliance: ComplianceDocView[];
}
```

---

## 9. DTOs de Payments

## 9.1 PaymentSummaryView

```ts
export interface PaymentSummaryView {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  type: "DEPOSIT" | "RELEASE" | "HOLDBACK" | "FEE" | "REFUND";
  status: "PENDING_FUNDING" | "FUNDED" | "HELD" | "APPROVAL_PENDING" | "RELEASED" | "REFUNDED" | "FAILED";
  amount: number;
  currency: string;
  provider?: string | null;
  providerRef?: string | null;
  createdAt: string;
}
```

## 9.2 EscrowSummaryView

Extiende el shape ya existente.

```ts
export interface EscrowSummaryView {
  escrowId?: string | null;
  projectId: string;
  jobId?: string | null;
  status: "active" | "closed" | "disputed";
  totalAmount: number;
  totalDeposited: number;
  totalReleased: number;
  available: number;
  currency: string;
}
```

## 9.3 MilestonePaymentStatusView

```ts
export interface MilestonePaymentStatusView {
  milestoneId: string;
  projectId: string;
  status: "UNFUNDED" | "FUNDED" | "APPROVAL_PENDING" | "RELEASED" | "BLOCKED" | "REFUNDED";
  reasons: string[];
  allowedActions: {
    approve: EligibilityView;
    release: EligibilityView;
    refund: EligibilityView;
  };
}
```

## 9.4 PaymentAuditEventView

```ts
export interface PaymentAuditEventView {
  id: string;
  paymentId: string;
  action: string;
  actorUserId: string;
  createdAt: string;
  notes?: string | null;
}
```

---

## 10. DTOs de Disputes

## 10.1 DisputeSummaryView

```ts
export interface DisputeSummaryView {
  id: string;
  projectId?: string | null;
  jobId?: string | null;
  milestoneId?: string | null;
  status: "OPEN" | "ASSIGNED" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  reason: string;
  openedById: string;
  createdAt: string;
  assigneeUserId?: string | null;
}
```

## 10.2 DisputeView

```ts
export interface DisputeView {
  id: string;
  projectId?: string | null;
  jobId?: string | null;
  milestoneId?: string | null;
  status: "OPEN" | "ASSIGNED" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  reason: string;
  resolution?: string | null;
  openedById: string;
  assigneeUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  allowedActions?: AllowedAction[];
}
```

## 10.3 DisputeTimelineEventView

```ts
export interface DisputeTimelineEventView {
  id: string;
  disputeId: string;
  type: "OPENED" | "ASSIGNED" | "COMMENTED" | "EVIDENCE_ADDED" | "STATUS_CHANGED" | "RESOLVED";
  actorUserId?: string | null;
  message: string;
  createdAt: string;
}
```

## 10.4 DisputeRelatedRecordsView

```ts
export interface DisputeRelatedRecordsView {
  documents: DocumentSummaryView[];
  evidence: EvidenceSummaryView[];
  payments: PaymentSummaryView[];
  worklogs: WorklogView[];
  milestones: MilestoneView[];
}
```

---

## 11. DTOs de Evidence

## 11.1 EvidenceSummaryView

```ts
export interface EvidenceSummaryView {
  id: string;
  projectId?: string | null;
  jobId?: string | null;
  milestoneId?: string | null;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT";
  key: string;
  url?: string | null;
  uploadedAt: string;
}
```

## 11.2 EvidenceView

```ts
export interface EvidenceView {
  id: string;
  projectId?: string | null;
  jobId?: string | null;
  milestoneId?: string | null;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT";
  key: string;
  url?: string | null;
  metadata?: Record<string, unknown>;
  uploadedByUserId?: string | null;
  uploadedAt: string;
}
```

---

## 12. DTOs de Trust y Activity

## 12.1 TrustSnapshotView

Se apoya en el schema ya existente.

```ts
export interface TrustSnapshotView {
  tenantId: string;
  scopeType: "job" | "project";
  scopeId: string;
  jobId: string;
  projectId?: string | null;
  score: number;
  level: "low" | "medium" | "high";
  flags: string[];
  reasons: {
    code: string;
    severity: "low" | "medium" | "high";
    message: string;
  }[];
  lastUpdatedAt: string;
}
```

## 12.2 ActivityItemView

```ts
export interface ActivityItemView {
  id: string;
  projectId: string;
  type: string;
  label: string;
  actorUserId?: string | null;
  createdAt: string;
  entityType?: string | null;
  entityId?: string | null;
}
```

---

## 13. Commands exactos recomendados

## 13.1 CreateDocumentInput

```ts
export interface CreateDocumentInput {
  projectId: string;
  type: DocumentType;
  title: string;
  contentFormat: "markdown" | "html" | "json";
  content: string;
}
```

## 13.2 PublishDocumentInput

```ts
export interface PublishDocumentInput {
  changelog?: string;
}
```

## 13.3 RunAgentInput

El actual `agentRunInputSchema` es válido, pero conviene extender payload tipado por caso.

```ts
export interface RunAgentInput {
  agentType: "pricing" | "job-planner" | "evidence-coach" | "risk" | "dispute";
  triggerType: "manual" | "event" | "schedule";
  correlationId: string;
  projectId?: string;
  payload: Record<string, unknown>;
}
```

## 13.4 CreateWorklogInput

```ts
export interface CreateWorklogInput {
  projectId: string;
  fieldUnitId: string;
  date: string;
  doneToday: string;
  pendingNext: string;
  blockers?: string;
  notes?: string;
}
```

## 13.5 ApprovePaymentInput

```ts
export interface ApprovePaymentInput {
  projectId: string;
  milestoneId: string;
  amount?: number;
}
```

## 13.6 ReleasePaymentInput

```ts
export interface ReleasePaymentInput {
  projectId: string;
  milestoneId: string;
  amount?: number;
  provider?: "mock" | "stripe" | "paypal" | "adyen" | "bank-transfer";
}
```

## 13.7 CreateDisputeInput

```ts
export interface CreateDisputeInput {
  projectId?: string;
  jobId?: string;
  milestoneId?: string;
  reason: string;
}
```

---

## 14. Priorización de DTOs

### P0

- `ApiMeta`
- `ApiResponse`
- `ApiErrorShape`
- `ProjectSummary`
- `ProjectView`
- `ProjectWorkspaceView`
- `DocumentSummaryView`
- `DocumentView`
- `DocumentVersionView`
- `AgentRunView`
- `CopilotMessageView`
- `CopilotActionView`

### P1

- `FieldUnitView`
- `WorklogView`
- `ComplianceDocView`
- `VendorView`
- `PaymentSummaryView`
- `EscrowSummaryView`
- `MilestonePaymentStatusView`
- `DisputeSummaryView`
- `DisputeView`
- `DisputeTimelineEventView`
- `EvidenceSummaryView`
- `TrustSnapshotView`
- `ActivityItemView`

### P2

- `CorpusStatusView`
- `SearchResultChunkView`
- `CitedAnswerView`
- `DisputeRelatedRecordsView`

---

## 15. Cambios concretos recomendados en `packages/schemas`

1. Mantener Zod para commands y queries.
2. Agregar archivos `*.view.ts` para DTOs compuestos de frontend.
3. Exportar todo desde [index.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/index.ts).
4. Evitar mezclar UI legacy types con DTOs canónicos nuevos.
5. Marcar `client.types.ts` como compatibilidad transicional, no como fuente futura principal.

---

## 16. Conclusión

La integración necesita una capa de DTOs más expresiva que la que existe hoy.

Hoy ya tienes:

- schemas de dominio útiles
- enums operativos valiosos
- una base fuerte para pagos, marketplace, disputas, trust y eventos

Lo que falta no es reinventar el dominio, sino:

- empaquetarlo en views consistentes
- separar inputs de outputs
- hacer DTOs compuestos pensados para `WebAssistant`

El siguiente paso natural después de estos DTOs es convertirlos en historias implementables y luego mapear cada pantalla de `WebAssistant` a esos contratos.
