---
type: plan
feature: "Programa de convergencia de producción F3-F9"
domain: "platform"
spec: "docs/specs/platform/production-convergence-program.spec.md"
version: "2.0"
status: "APPROVED"
branch: "main"
date: "2026-07-30"
---

# Plan técnico: Programa de convergencia de producción F3-F9

## Snapshot de verdad

- `origin/main`: `35f6bda3`.
- API, Web, Worker y Vision Railway: `35f6bda3`, estado `SUCCESS`.
- F3: código y migraciones en `main`; repair Evidence y canary durable
  verificados.
- SQL original F3: restaurado sin editar y checksum histórico reconciliado.
- Flags F3: cálculo y persistencia activos sólo para `tenant_default`.
- Dominio API personalizado: DNS sincronizado; certificado aún no verificado al
  corte.

## Estrategia

1. Alinear SDD 2.0 y eliminar contradicciones de estado.
2. Reconciliar F3 con producción y desplegarlo mediante canary. Completado para
   cálculo/persistencia; pendiente rebuild/event replay.
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
