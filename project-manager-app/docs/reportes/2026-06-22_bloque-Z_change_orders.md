# Bloque-Z: M2.2.C-D — Change Order Trail + Extended Metrics

**Fecha:** 2026-06-22  
**Estado:** DONE  
**Tests:** 12/12 pass  

## Qué se implementó

✅ **ChangeOrderService** — Track cambios en proyecto  
✅ **Change Order FSM** — DRAFT → PENDING → APPROVED/REJECTED  
✅ **ChangeOrderController** — 5 endpoints (create, get, submit, approve, reject)  
✅ **ExtendedMetricsService** — Track 20 construction trades  
✅ **Trade Metrics** — Hours, cost, progress per trade  

## Archivos

- `apps/api/src/modules/evidence/change-order.service.ts` — 130 líneas
- `apps/api/src/modules/evidence/change-order.controller.ts` — 110 líneas
- `apps/api/src/modules/evidence/extended-metrics.service.ts` — 140 líneas
- `apps/api/test/bloque-z-change-orders.test.ts` — 200 líneas

## 20 Trades

1. General Labor, 2. Carpentry, 3. Masonry, 4. Plumbing, 5. HVAC,
6. Electrical, 7. Roofing, 8. Painting, 9. Drywall, 10. Flooring,
11. Framing, 12. Concrete, 13. Excavation, 14. Grading, 15. Landscaping,
16. Demolition, 17. Insulation, 18. Windows/Doors, 19. Siding, 20. Finishes

## Endpoints

- POST /change-orders — Crear
- GET /change-orders — Listar
- POST /change-orders/:id/submit — Enviar para aprobación
- POST /change-orders/:id/approve — Aprobar (PRO firma)
- POST /change-orders/:id/reject — Rechazar
- GET /change-orders/timeline/all — Auditoría + total impacto

---

**Status: LISTO PARA MERGE**
