# SSE Real-Time Updates — Ciclo Monetizable

**Fecha:** 2026-05-17  
**Estado:** ✅ Cerrado  
**Tests:** 78/78 · API build OK · Web build OK

---

## Resumen ejecutivo

SEMSE ya no solo calcula, revisa y gobierna. **SEMSE ahora reacciona en tiempo real.**

Cuando admin/ops aprueba, rechaza o solicita reupload de evidencia, el cliente ve el cambio inmediatamente en `/client/milestones` sin refresh manual. Cuando la IA termina de revisar evidencia, el panel de governance se actualiza solo.

---

## Flujo SSE completo

```
[Admin] PATCH /v1/milestones/:id/evidence-items/:itemId  { status: "approved" }
    ↓
MilestonesController
    ↓
SseEventBusService.emit("buildops:tenant_xxx", "evidence-item:updated", {
  milestoneId, itemId, status, updatedAt
})
    ↓
GET /v1/sse/buildops  (EventStream)
    ↓
BFF GET /api/semse/sse/buildops  (proxy)
    ↓
EventSource("/api/semse/sse/buildops")  en /client/milestones
    ↓
useBuildOpsSSE.onEvent({ type: "evidence-item:updated", milestoneId, ... })
    ↓
refreshGovernance(milestoneId)  →  governanceKey++
    ↓
MilestoneGovernancePanel re-monta  →  re-fetch GET /payment-governance
    ↓
[Cliente] ve releaseStatus=ready, canRelease=true  —  sin refresh manual
```

---

## Eventos implementados

| Evento | Canal | Emitido desde | Payload |
|--------|-------|--------------|---------|
| `evidence-item:updated` | `buildops:${tenantId}` | `MilestonesController.updateEvidenceItem` | `{ milestoneId, itemId, status, updatedAt }` |
| `evidence-item:reviewed` | `buildops:${tenantId}` | `EvidenceReviewService.runReview` | `{ milestoneId, itemId, reviewStatus, riskLevel, reviewedAt }` |
| `operational-signal:created` | `mission-control:${tenantId}` | `OperationalSignalsService` (existente) | `{ id, type, severity, title, milestoneId? }` |
| `keepalive` | todos | `SseController` | `:keepalive` (filtrado en frontend) |

---

## Páginas afectadas

### `/client/milestones`
- **Hook:** `useBuildOpsSSE({ onEvent })`
- **Trigger:** `evidence-item:updated` o `evidence-item:reviewed`
- **Acción:** `refreshGovernance(milestoneId)` → key++ → `MilestoneGovernancePanel` re-monta

### `/admin/mission-control` (existente antes de esta sesión)
- Suscripción a `operational-signal:created` via SSE existente
- No modificada en esta sesión

---

## Componentes que refrescan

| Componente | Trigger SSE | Qué cambia |
|-----------|-------------|-----------|
| `MilestoneGovernancePanel` | `evidence-item:updated`, `evidence-item:reviewed` | releaseStatus, canRelease, blockers, nextBestAction |
| `EvidenceReviewAdminCard` | (refresh manual vía botón) | reviewNote, status por item |

---

## Infraestructura SSE existente (no modificada)

```
SseEventBusService     — bus interno (Subject RxJS)
SseController          — streams: plans, delegations, health, context, finance, mission-control, buildops
v1/sse/buildops        — channel: buildops:${tenantId}  ← reutilizado
v1/sse/mission-control — channel: mission-control:${tenantId}
```

---

## Nuevos archivos

| Archivo | Propósito |
|---------|----------|
| `apps/web/app/api/semse/sse/buildops/route.ts` | BFF proxy de `v1/sse/buildops` |
| `apps/web/hooks/useBuildOpsSSE.ts` | Hook React con reconnect y filtrado |
| `apps/api/test/sse-events.test.ts` | 7 tests de lógica SSE |

---

## Hook `useBuildOpsSSE`

```ts
useBuildOpsSSE({
  onEvent: (evt) => {
    if (evt.type === "evidence-item:updated" || evt.type === "evidence-item:reviewed") {
      refreshGovernance(evt.milestoneId);
    }
  },
  milestoneIds: ["ms_1", "ms_2"],  // optional filter
  enabled: true,
})
```

**Reconnect:** exponential backoff, max 5 reintentos, hasta 30s de espera.  
**Keepalive:** filtrado — no se propaga al `onEvent`.  
**Filtro:** si `milestoneIds` está definido, solo procesa eventos de esos milestones.

---

## Validaciones ejecutadas

```
API TypeScript      : 0 errores ✅
API nest build      : OK ✅
Web TypeScript      : 0 errores ✅
Web next build      : OK ✅
Tests               : 78/78 ✅
Sin mock data       : ✅
canRelease sin botón de pago automático : ✅
SSE no emite a tenants incorrectos : ✅
```

---

## Tests SSE (7/7)

| Test | Escenario |
|------|-----------|
| SSE.1 | `evidence-item:updated` emitido con canal correcto |
| SSE.2 | `evidence-item:reviewed` tiene payload completo |
| SSE.3 | Canal es per-tenant (no mezcla tenants) |
| SSE.4 | Campos requeridos del evento reviewed |
| SSE.5 | Filtrado por milestoneId en frontend |
| SSE.6 | Retry cap a 5 reintentos |
| SSE.7 | Keepalive filtrado en onEvent |

---

## Limitaciones pendientes

1. **`/buildops/milestones` sin SSE auto-refresh** — solo tiene refresh manual (botón en governance panel y evidence review card). El hook `useBuildOpsSSE` puede añadirse fácilmente.

2. **Sin indicador visual "Actualizado"** — el refresh es silencioso. Un micro-toast o badge "Actualizado ahora" podría mejorar la UX.

3. **Change orders no emiten SSE** — `ChangeOrdersService.applyToBuildOps` crea una `OperationalSignal` (que ya emite SSE a mission-control) pero no emite un evento específico `change_order:applied` al canal buildops. Se puede añadir en una iteración.

4. **Sin SSE en `/client/change-orders`** — la página de change orders del cliente no suscribe al hook todavía.

5. **Single-tab** — EventSource es per-tab. Si el usuario tiene múltiples tabs, cada una tiene su propia conexión SSE. No hay broadcast cross-tab.

---

## Próximos pasos recomendados

```
1. useBuildOpsSSE en /buildops/milestones (admin auto-refresh)
2. Evento change_order:applied → refresh de /client/change-orders
3. Micro-indicador "Actualizado" en panels que refrescan
4. Evidence CRUD más robusto: historial, thumbnail, reemplazos
5. RAG query sobre scope/evidencia/contratos
6. Nivel 4B: VPS/GPU para Ollama remoto
```
