# Prometeo Operational Context

Fecha: 2026-04-28
Estado: activo en `apps/api/src/modules/ai-models/context/operational-context.service.ts`

## Propósito

Prometeo no debe responder como chatbot genérico. Antes de contestar, construye un paquete de contexto operativo con datos reales del tenant y, si existe, del proyecto activo.

## Estructura

```ts
type SemseOperationalContext = {
  mode: "demo" | "local" | "live";
  user: { id: string; role: string; tenantId: string; orgId: string };
  activeProject: { id: string; title: string; status: string; jobId?: string } | null;
  jobs: { active: number; waitingProposals: number; completed: number; recent: Array<{ id: string; title: string; status: string }> };
  milestones: { active: number; pendingApproval: number; submitted: number };
  payments: { escrowFunded: number; escrowReleased: number; pendingRelease: number };
  evidences: { total: number; pendingReview: number; approved: number };
  disputes: { open: number; urgent: number };
  notifications: Array<{ id: string; type: string; body: string; createdAt: Date }>;
  systemHealth: { api: "ok" | "degraded"; worker: "ok" | "degraded"; redis: "ok" | "degraded" };
  generatedAt: string;
};
```

## Fuentes reales

- `job`
- `project`
- `milestone`
- `paymentEscrow`
- `evidence`
- `dispute`
- `notification`
- `userProfile`
- `operationalContextSnapshot`

## Reglas de alcance

- `CLIENT`: ve jobs filtrados por `clientOrgId`.
- `OPS_ADMIN` y roles no cliente: ven jobs del tenant completo.
- Si llega `projectId`, se agregan métricas de hitos, pagos, evidencias y disputas.
- Si no llega `projectId`, `activeProject` queda `null`.

## Modo de runtime

- `live`: `NODE_ENV=production`
- `local`: default fuera de producción
- `demo`: solo si `SEMSE_DEMO_MODE=true` o `SEMSE_RUNTIME_MODE=demo`

Esto evita marcar como demo una instancia local conectada a DB/API reales.

## Comportamiento sin proyecto

Si la intención requiere contexto de proyecto y no hay `projectId`, Prometeo responde con guardrail operativo:

- dice que no hay proyecto seleccionado
- ofrece mostrar trabajos recientes
- ofrece reporte general
- ofrece continuar con el agente especializado después de seleccionar proyecto

## Caché y snapshot

- caché in-memory: `60s`
- snapshot persistido: `operationalContextSnapshot`
- endpoint de lectura:
  - `GET /v1/ai-models/operational-context`
  - `GET /v1/ai-models/operational-context/latest`

## Limitaciones actuales

- `systemHealth` sigue cableado a `ok/ok/ok`; falta health real por Redis/worker/API.
- no hay SSE todavía; el contexto se refresca por request o polling.
- `notifications` depende del seed y del usuario autenticado; en admin puede venir vacío.
