---
type: tasks
feature: "account-center"
domain: "core"
plan: "docs/specs/core/account-center.plan.md"
version: "1.0"
status: "COMPLETED"
branch: "codex/semse-account-center"
date: "2026-07-25"
---

# Tareas: centro de cuenta y seguridad

## Fase 1 — Contrato

- [x] [T-001] Crear rama/worktree limpio desde `origin/main`.
- [x] [T-002] Aprobar spec, plan, tareas y checklist.
- [x] [T-003] Escribir tests del servicio y contrato antes del código.

## Fase 2 — Backend

- [x] [T-010] Crear schema Zod de cambio de contraseña.
- [x] [T-011] Implementar lectura segura de credencial por `userId`.
- [x] [T-012] Implementar cambio transaccional y revocación de otras sesiones.
- [x] [T-013] Implementar servicio, auditoría y endpoint con throttle.
- [x] [T-014] Ejecutar tests enfocados del backend.

## Fase 3 — Web

- [x] [T-020] Crear BFF privado.
- [x] [T-021] Crear helper tipado.
- [x] [T-022] Crear `AccountCenter` compartido.
- [x] [T-023] Montar rutas por rol y navegación.
- [x] [T-024] Alinear registro y reset con política de 15 caracteres.

## Fase 4 — Verificación y cierre

- [x] [T-030] Ejecutar contratos, tests, lint y builds.
- [x] [T-031] Aplicar revisión React a los TSX modificados.
- [x] [T-032] Actualizar superficie API, eventos e índice SDD.
- [x] [T-033] Crear reporte técnico con evidencia.

## Criterio de done

- [x] Todas las pruebas nuevas pasan.
- [x] API y web compilan.
- [x] Los tres roles acceden al mismo centro funcional.
- [x] No se registra ninguna contraseña.
- [x] El spec aparece en `docs/SPEC_INDEX.md`.
