---
type: plan
feature: "Programa de convergencia de producción F3-F9"
domain: "platform"
spec: "docs/specs/platform/production-convergence-program.spec.md"
version: "2.0"
status: "APPROVED"
branch: "feat/production-convergence-f3"
date: "2026-07-28"
---

# Plan técnico: Programa de convergencia de producción F3-F9

## Snapshot de verdad

- `origin/main`: `39f6ecbd`.
- API y Web Railway: `39f6ecbd`, estado `SUCCESS`.
- F3: migración aplicada manualmente, tabla vacía, código ausente de `main`.
- SQL original F3: recuperado de stash Git; debe restaurarse sin editar.
- Flags F3: no existen todavía en Railway.
- Dominio API personalizado: DNS sincronizado; certificado aún no verificado al
  corte.

## Estrategia

1. Alinear SDD 2.0 y eliminar contradicciones de estado.
2. Reconciliar F3 con producción y desplegarlo mediante canary.
3. Actualizar la verdad arquitectónica.
4. Crear/aprobar el child spec siguiente sólo después del gate de salida.

Cada child usa rama/PR independiente después de F3. La documentación de programa
no autoriza mutaciones de base o activaciones de F4-F9.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Drift de migración F3 | Restaurar SQL exacto y comparar checksum |
| WIP obsoleto | Rescate selectivo contra `origin/main`, no stash apply |
| Big bang F3-F9 | Child specs y PRs secuenciales |
| Deploy confundido con activo | Metadata SDD 2.0 + canary autenticado |
| Flags sin inventario | Leer nombres de Railway sin exponer valores |
| Regresión cross-tenant | Tests de ownership y smoke autenticado |

## Investigación

- GitHub Spec Kit: usar spec de programa sólo para descomponer; cada slice
  recorre el ciclo completo.
- Prisma: historial de migraciones versionado y migraciones aplicadas
  inmutables.
- Railway: pre-deploy para migraciones; healthcheck antes de cambiar tráfico,
  seguido de verificación funcional separada.

## Gates

- `pnpm spec:validate:strict`.
- Tests del child slice.
- CI terminal.
- Merge y SHA.
- Deploy terminal por servicio.
- Canary/activación y evidencia.
