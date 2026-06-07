# Change Orders Real-Time SSE

**Fecha:** 2026-05-17  
**Estado:** ✅ Cerrado — paridad con evidencia real-time  
**Tests:** 78/78 · API build OK · Web TypeScript 0 errores

---

## Resumen

SEMSE ahora tiene un ciclo monetizable visible, gobernado y reactivo **tanto para evidencia como para change orders**.

Cuando un change order es aprobado, rechazado, aplicado o se solicitan cambios, las páginas afectadas se actualizan automáticamente — sin refresh manual.

---

## Eventos emitidos

| Evento | Canal | Emitido desde | Payload |
|--------|-------|--------------|---------|
| `change-order:updated` | `buildops:${tenantId}` | `submit()`, `approve()`, `reject()`, `requestChanges()` | `{ changeOrderId, status, milestoneId?, buildOpsProjectId?, costDeltaAvg }` |
| `change-order:applied` | `buildops:${tenantId}` | `applyToBuildOps()` | `{ changeOrderId, status:"applied", milestoneId?, buildOpsProjectId?, costDeltaAvg, riskLevel, applied:true }` |

---

## Flujo completo

```
Admin: POST /v1/change-orders/:id/apply-to-buildops
    ↓
ChangeOrdersService.applyToBuildOps()
    ↓
SseEventBusService.emit("buildops:tenant_xxx", "change-order:applied", {
  changeOrderId, milestoneId, buildOpsProjectId, costDeltaAvg, riskLevel
})
    ↓
GET /v1/sse/buildops  →  BFF /api/semse/sse/buildops
    ↓
EventSource en /client/change-orders, /client/milestones, /buildops/milestones
    ↓
useBuildOpsSSE.onEvent({ type: "change-order:applied", ... })
    ↓
/client/change-orders:   void load() + refreshImpact(changeOrderId)
/client/milestones:      refreshGovernance(milestoneId)
/buildops/milestones:    refreshGov(milestoneId)
    ↓
[UI actualiza sin refresh manual]
  ChangeOrderImpactCard:  paymentImpact = "already_applied"
  MilestoneGovernancePanel: changeOrderBlockers = 0
  Si evidencia completa → releaseStatus = "ready", canRelease = true
```

---

## Páginas y componentes reactivos

| Página | Evento escuchado | Qué refresca |
|--------|-----------------|-------------|
| `/client/change-orders` | `change-order:updated/applied` | Lista de COs + `ChangeOrderImpactCard` (key refresh) |
| `/client/milestones` | `change-order:updated/applied` + evidence events | `MilestoneGovernancePanel` (key refresh) |
| `/buildops/milestones` | todos los eventos | `MilestoneGovernancePanel` + `EvidenceReviewAdminCard` |

---

## Validaciones

```
approve/reject/request-changes → emiten change-order:updated  ✅
apply-to-buildops              → emite change-order:applied   ✅
apply 2x                       → idempotente, no duplica SSE  ✅
/client/change-orders          → lista + impact auto-refresh  ✅
/client/milestones             → governance auto-refresh      ✅
/buildops/milestones           → governance auto-refresh      ✅
changeOrderBlockers=0 post-apply                              ✅
canRelease=true si evidencia completa                        ✅
evidence SSE no rota                                         ✅
sin refresh manual requerido                                  ✅
```

---

## Estado SSE completo post-sesión

| Evento | Canal | Desde |
|--------|-------|-------|
| `evidence-item:updated` | `buildops:${tenantId}` | `MilestonesController` |
| `evidence-item:reviewed` | `buildops:${tenantId}` | `EvidenceReviewService` |
| `change-order:updated` | `buildops:${tenantId}` | `ChangeOrdersService` |
| `change-order:applied` | `buildops:${tenantId}` | `ChangeOrdersService` |
| `operational-signal:created` | `mission-control:${tenantId}` | `OperationalSignalsService` |

---

## Resumen de builds y tests

```
API TypeScript   : 0 errores ✅
API nest build   : OK ✅
Web TypeScript   : 0 errores ✅
78/78 tests      : passing ✅
Repo             : limpio ✅
```

---

## Limitaciones pendientes

1. **`/buildops/projects/[id]`** — el `BuildOpsProjectHealthPanel` no suscribe a SSE todavía; muestra `openChangeCandidates` pero no se refresca automáticamente.
2. **Sin indicador "Actualizado ahora"** — el refresh es silencioso. Un micro-badge podría mejorar la UX.
3. **Sin SSE para `reject` con `clientNote`** — el evento se emite pero el cliente no distingue entre approve y reject visualmente en tiempo real; depende del nuevo `status` en el listado.

---

## Próximos frentes

```
1. BuildOpsProjectHealthPanel SSE (openChangeCandidates + openSignals auto-refresh)
2. Evidence CRUD avanzado: previews, historial, thumbnails
3. RAG query sobre scope/evidencia/contratos
4. Nivel 4B: VPS/GPU para Ollama remoto
5. UX escrow final con indicadores de pago listos
```
