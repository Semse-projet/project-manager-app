---
type: tasks
feature: "jev-decision-layer"
domain: "prometeo"
plan: "docs/specs/prometeo/jev-decision-layer.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "claude/google-docs-link-f39dr2"
date: "2026-09-24"
---

# Tareas: Jev Decision Layer

- [x] [T-001] Inspección: Jev inexistente en repo/Drive; router determinista, selección de modelo, gates y telemetría existentes mapeados.
- [x] [T-002] Punto de integración identificado (chat de Prometeo + recognize).
- [x] [T-003] Adapter/provider Jev (`jev.provider.ts`).
- [x] [T-004] Contratos estructurados (`decision.types.ts`), incluidos Evidence/ChangeOrder/ModelTier/Workflow solo como tipos.
- [x] [T-005] Feature flags + canary (`decision-flags.ts`), default OFF.
- [x] [T-006] Agent Router piloto (`agent-route` + `routing` en chat, shadow/assist).
- [x] [T-007] Vision Decision Gate (`gate` en recognize + UI).
- [x] [T-008] Fallback en todos los modos de fallo + invariantes.
- [x] [T-009] Telemetría `JevDecisionEvent` + migración + cierre de `outcome`.
- [x] [T-010] Tests (unit, controller, integración con DB) y smoke con Jev simulado.
- [x] [T-011] Typecheck / build / lint.
- [x] [T-012] Documentación y reporte.
- [ ] [T-013] Conectar con la API real de Jev (bloqueado: no documentada).
- [ ] [T-014] Activación canary en Railway (decisión humana).

## Wave 0 — cierre (handoff §34, §52–56)

- [x] [T-020] Contrato central DecisionRequest/DecisionResult; un solo servicio.
- [x] [T-021] Modo shadow/live por feature (Vision Gate pasa a shadow por defecto).
- [x] [T-022] Canary por tenant/usuario/rol/porcentaje.
- [x] [T-023] Circuit breaker por feature.
- [x] [T-024] Registro de invariantes + un test por invariante.
- [x] [T-025] Telemetría §55 (migración aditiva) + correlationId.
- [x] [T-026] Harness de evaluación + fixtures + `jev:eval`.
- [~] [T-027] Métricas de shadow reales — bloqueado: requiere API real de Jev + activación humana en shadow.
- [ ] [T-028] Wave 1 (Evidence / Change Order triage) — no iniciar hasta T-027 (§57).
