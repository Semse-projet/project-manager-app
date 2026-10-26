---
type: tasks
feature: "S1/D7 — Consentimiento OAuth delegado persistente"
domain: "platform"
plan: "docs/specs/platform/semse-mcp-delegated-consent.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "claude/new-session-jdxlw4"
date: "2026-10-26"
---

# Tareas: S1/D7 consentimiento delegado

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase A — Diseño (cerrada en #1049)

- [x] [T-001] Spec, decisiones Q1–Q6 y correcciones de revisión
- [x] [T-002] FSM reservada en `STATE_MACHINES.md` y fila de retención M-06
- [x] [T-003] DEC-PLATFORM-001 (revisión para mantenedor único)
- [~] [T-004] Viñeta de mantenedor único en `semseproject` §12 (la aplica el propietario a mano)

## Fase B — Persistencia apagada

- [x] [T-010] Modelo `McpDelegatedConsent` + migración aditiva
- [x] [T-011] Contratos Zod en `packages/schemas`
- [x] [T-012] Permiso `mcp:consents:revoke:tenant` para `OPS_ADMIN`
- [x] [T-013] Extraer `intersectSessionRoles` sin cambiar la semántica web
- [x] [T-014] Reglas puras: expiración (Q1/P2), roles sin override (Q2/P1), org del grant, retención
- [x] [T-015] Repositorio: aceptación con `FOR SHARE`, revocación CAS, anonimización por `terminalAt`
- [x] [T-016] Servicio interno sin ruta: `accept`, `authorizeRead`, `revokeOwn`, `revokeAsTenantOps`, `anonymizeDue`
- [x] [T-017] Pruebas unitarias (D7-04, 05b, 09, 10, 11, 17, 22, Q5, Q6)
- [x] [T-018] Pruebas de integración PostgreSQL (D7-01, 02, 03, 05, 05b, 06, 07, 08, 09, 13, 17, 19, 21, 22, 23, 24)
- [ ] [T-019] CI verde (incluido `API Integration`) sobre el SHA final
- [ ] [T-020] Controles de nivel 2: dos revisiones automatizadas, pausa de 24 h, autorrevisión del propietario

## Pendiente para fases siguientes

- [ ] [T-030] Worker que programe `anonymizeDue` (hoy solo existe el método)
- [ ] [T-031] Ampliación de retención por tenant y legal hold (requiere modelo de configuración)
- [ ] [T-032] Barrido de grants en el flujo de supresión de User/Org cuando exista (D7-20)
- [ ] [T-033] v1.1: admin de org (`mcp:consents:revoke:org`) y revocación masiva por cliente (D7-19b)
- [ ] [T-034] Fase C (requiere D2): módulo Nest, flag `MCP_S1_SERVER_ENABLED`, guard de recurso, `assertProjectInGrantOrg` en la lectura, D7-12/14
- [ ] [T-035] Fase D: canary y revisión humana externa (nivel 3)
- [ ] [T-036] Auditoría de aceptación/revocación/denegación (D7-15) cuando se defina el evento en `EVENT_CATALOG.md`
