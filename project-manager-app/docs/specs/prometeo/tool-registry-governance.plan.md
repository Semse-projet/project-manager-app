---
type: plan
feature: "F2 — Prometeo Tool Registry gobernado"
domain: "prometeo"
spec: "docs/specs/prometeo/tool-registry-governance.spec.md"
version: "1.0"
status: "APPROVED"
branch: "feat/f2-tool-registry-governance"
date: "2026-07-20"
---

# Plan técnico: F2 — Prometeo Tool Registry gobernado

## 1. Resumen técnico

**Spec:** [`tool-registry-governance.spec.md`](tool-registry-governance.spec.md)

**Estrategia:** insertar un policy engine delgado entre el controller y la
ejecución existente, sin tocar el shape de `PrometeoToolDescriptor` ni el
endpoint de escrow real. Cerrar primero enforcement + audit (F2-A/B), luego
habilitar write tools de bajo riesgo (F2-C), y por último conectar
`payments.propose_release` al gate híbrido (F2-D) como último paso porque es
el único de riesgo `critical`.

**Complejidad:** alta (toca permisos y pagos, aunque el volumen de código
nuevo es moderado).

**Riesgo principal:** que el policy engine nuevo divirja silenciosamente del
RBAC ya usado por Domain Events/Forge, o que el gate híbrido de pagos termine
duplicando/bypaseando los invariantes de `PaymentsService.release()`.

## 2. Constitution check

- [x] Spec APPROVED antes del plan (2026-07-20).
- [x] Decisiones críticas (pagos) confirmadas por el owner, no asumidas.
- [x] AuditLog: escritura de tools deja trazabilidad; lectura sigue el
      precedente de Product Intelligence (no audita cada invocación).
- [x] Privacy: inputs de tools no se loguean completos por defecto.
- [x] Tests antes del código (sección 6 de este plan).
- [x] Multi-tenant: el policy engine y el gate de aprobación son
      tenant-scoped, igual que Domain Events.
- [x] Payment Governance: `PaymentsService.release()` no se modifica; F2 es
      un gate previo, no un reemplazo.

## 3. Stack afectado

```yaml
backend:
  framework: NestJS + Fastify
  modules:
    - apps/api/src/modules/prometeo (existente, se extiende)
    - apps/api/src/modules/prometeo/tool-governance (nuevo)
  schemas:
    - packages/schemas/src/prometeo-runtime.schema.ts (ya define
      prometeoApprovalPolicySchema / prometeoProposedActionSchema; se
      consumen, no se rediseñan)
  prisma_changes: true

frontend:
  changes: none (fuera de alcance F2; el catálogo ya se consume vía BFF
    existente)

infrastructure:
  new_service: false
  new_provider: false
  new_env: []
```

## 4. Cambios de base de datos

Migración aditiva. Dos modelos nuevos, alineados con la decisión 3 (split
write/read) y la decisión 2 (proposed action):

```prisma
enum PrometeoProposedActionStatus {
  PROPOSED
  AWAITING_APPROVAL
  APPROVED
  REJECTED
  BLOCKED
  EXECUTED
}

model PrometeoProposedAction {
  id              String                        @id @default(cuid())
  tenantId        String
  orgId           String
  actorId         String
  namespace       String
  name            String
  approvalPolicy  String
  status          PrometeoProposedActionStatus  @default(PROPOSED)
  inputJson       Json
  requiredApprovals String[]
  approvedBy      String?
  approvedAt      DateTime?
  rejectedBy      String?
  rejectedAt      DateTime?
  rejectionReason String?
  executedAt      DateTime?
  resultJson      Json?
  createdAt       DateTime                      @default(now())
  updatedAt       DateTime                      @updatedAt

  @@index([tenantId, status, createdAt])
}

model PrometeoToolInvocationAudit {
  id           String   @id @default(cuid())
  tenantId     String
  actorId      String
  namespace    String
  name         String
  mode         String
  status       String
  blockedReason String?
  requestId    String
  occurredAt   DateTime @default(now())

  @@index([tenantId, occurredAt])
  @@index([tenantId, status, occurredAt])
}
```

Notas:

- `PrometeoProposedAction` cubre write/critical tools con
  `approvalPolicy != "none"` — es lo único que llega a `AuditLog` real vía
  `AuditService.append` en el momento de aprobar/rechazar/ejecutar (decisión
  3: writes sí van a AuditLog).
- `PrometeoToolInvocationAudit` es el modelo separado de bajo costo para
  invocaciones de lectura (decisión 3) — retención corta a definir en
  tasks.md, NO es `AuditLog`. Solo se escribe para: tools bloqueadas
  (`blockedReason`) y, si el volumen real en canary lo justifica, un muestreo
  del resto — el plan por defecto es escribir todas por ahora y revisar
  volumen antes de optimizar (no hacer retención prematura sin datos).
- ninguna tabla existente de Payments se toca.

## 5. Módulos y responsabilidades

### `apps/api/src/modules/prometeo/tool-governance/` (nuevo)

```text
tool-governance.policy.ts       — evaluatePrometeoToolPolicy(actor, descriptor) -> allow | deny | require_approval
tool-governance.repository.ts   — PrometeoProposedAction + PrometeoToolInvocationAudit CRUD
tool-governance.service.ts      — orquesta: policy -> adapter | proposed action
tool-governance.controller.ts   — POST /v1/prometeo/tools/invocations/:id/approve|reject
```

`evaluatePrometeoToolPolicy` (decisión 1):

```ts
function evaluatePrometeoToolPolicy(input: {
  actorRoles: string[];
  descriptor: PrometeoToolDescriptor;
}): { decision: "allow" | "deny" | "require_approval" } {
  const hasAll = input.descriptor.permissions.every((p) => hasPermission(input.actorRoles, p));
  if (!hasAll) return { decision: "deny" };
  if (input.descriptor.approvalPolicy === "none") return { decision: "allow" };
  return { decision: "require_approval" };
}
```

Sin estado propio de roles/permisos — consume `hasPermission()` de
`@semse/auth` (mismo paquete que usa `RbacGuard`), tal como recomendó la
investigación de la decisión 1. No se toca `packages/forge/src/policy.ts` ni
`packages/agents/src/governance.ts`.

### `PrometeoToolExecutionService` (existente, se extiende)

- `invokeReadTool` pasa primero por `evaluatePrometeoToolPolicy`; si
  `deny`, 403 antes de tocar el switch (cierra la brecha de la decisión
  original del spec: hoy no se verifica nada).
- nuevo `invokeWriteTool`: mismo flujo de policy; si `allow`, ejecuta
  directo (tools de bajo riesgo, `approvalPolicy: "none"` — hoy ninguna
  tiene ese valor salvo que se reclasifique en tasks.md); si
  `require_approval`, crea `PrometeoProposedAction` en `AWAITING_APPROVAL`
  y devuelve `status: "pending_approval"` sin ejecutar nada.
- catálogo (`GET /v1/prometeo/tools`) se extiende con `executable: boolean`
  (true solo si hay adapter/case wired), reemplazando la inferencia manual
  por tag `adapter_pending`.

### `payments.propose_release` (gate híbrido, decisión 2)

- al aprobar la `PrometeoProposedAction` de este namespace/tool
  específicamente, el service llama `POST /v1/milestones/:milestoneId/
  escrow/release` (el endpoint real, sin modificarlo) con la identidad del
  aprobador — no la del proponente original.
- `PaymentsService.release()` sigue siendo la única fuente de verdad sobre
  si el pago es válido ahora mismo; F2 no reimplementa ni cachea sus checks.

### Catálogo (`prometeo-tool-registry.ts`, edición mínima)

- las 5 tools `vision:run` sin case (decisión 4) se marcan explícitamente
  `adapter_pending: true` en el descriptor (campo nuevo, no un tag de texto)
  en vez de fallar silenciosamente en runtime.
- `vision.analyze_image` se reclasifica: sigue expuesta bajo `mode: "read"`
  cara al usuario (no cambia su UX), pero internamente su adapter se marca
  con un flag `hasSideEffect: true` para que el audit trail no lo trate como
  puramente idempotente — detalle a cerrar en tasks.md, no bloquea el resto.

## 6. Fases

### F2-A — Contratos y tests rojos

- tests de `evaluatePrometeoToolPolicy` (allow/deny/require_approval);
- tests de 403 en `invokeReadTool` sin el permiso declarado por la tool;
- migración Prisma draft + `prisma migrate diff` estático.

### F2-B — Enforcement de lectura + audit de lectura

- `invokeReadTool` gateado por policy;
- `PrometeoToolInvocationAudit` para bloqueos (mínimo) y, por defecto,
  todas las invocaciones (revisar volumen antes de reducir);
- catálogo expone `executable`/`adapter_pending` reales.

### F2-C — Write tools de bajo riesgo

- `invokeWriteTool` para tools con `approvalPolicy: "none"` (ninguna hoy;
  requiere decidir en tasks.md si alguna de las 7 write actuales se
  reclasifica, o si F2-C solo deja el mecanismo listo sin tools activas
  todavía);
- `PrometeoProposedAction` para `approvalPolicy: "confirm"`
  (`agro.create_task`, `time_tracker.*`) con ruta de aprobación genérica.

### F2-D — Gate híbrido de pagos

- `payments.propose_release` conectado al flujo `PrometeoProposedAction`;
- aprobar dispara la llamada real al endpoint de escrow, sin bypass;
- fault test: rechazo de la propuesta no debe dejar ningún estado a medio
  camino (ni en `PrometeoProposedAction` ni en Payments).

### F2-E — Validación y cierre

- `pnpm spec:validate:strict`;
- suite completa + tests nuevos;
- actualizar `SEMSE_API_SURFACE_V1.md`, `IMPLEMENTATION_STATUS_MATRIX.md`
  (fila Tool Registry: `PARCIAL` -> estado real verificado) y `ROADMAP.md`
  sección F2.

## 7. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| policy engine nuevo diverge de RBAC existente | baja | alto | reusa `hasPermission()` directo, no reimplementa |
| gate de pagos bypasea `PaymentsService.release()` | baja | crítico | F2-D no toca ese service; test explícito de que los invariantes siguen aplicando post-aprobación |
| `PrometeoToolInvocationAudit` crece sin control | media | medio | revisar volumen real en F2-E antes de definir retención definitiva; no optimizar sin datos |
| 3 policy engines (Forge/agents/F2) divergen con el tiempo | media | medio | fuera de alcance de F2 (spec sección 3); registrar como ítem de ADR futuro, no bloquea este corte |

## 8. Gate antes de tasks/implementación

- [x] Spec APPROVED (2026-07-20).
- [x] Decisión de pagos confirmada explícitamente por el owner.
- [x] Schema/migración conceptual identificados.
- [x] Tests preceden código (sección 6, cada fase empieza en rojo).
- [x] No se introduce infraestructura externa nueva.
