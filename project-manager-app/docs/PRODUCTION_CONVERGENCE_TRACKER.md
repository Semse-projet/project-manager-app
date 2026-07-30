# Production Convergence Tracker

**Corte:** 2026-07-29
**Programa:** `platform.production-convergence-f3-f9`
**Rama de trabajo:** `feat/production-convergence-f3`

## Verdad desplegada

| Superficie | Estado |
|---|---|
| `origin/main` | `39f6ecbd` |
| API Railway | `39f6ecbd`, deployment `89677ecd-439c-46d2-945f-4482042ff9f1`, `SUCCESS` |
| Web Railway | `39f6ecbd`, deployment `e377f738-a6b4-4de6-b95a-f60ed0b8d5d2`, `SUCCESS` |
| Worker/Postgres/Redis/Vision | `SUCCESS` al corte |
| `api.semseproject.com` | Dominio personalizado `ACTIVE` en Railway |

## Drift F3 confirmado

- `_prisma_migrations` contiene
  `20260728000000_project_lifecycle_projection`, aplicada exitosamente el
  2026-07-28.
- Checksum PostgreSQL:
  `1616b63c7c44bfa0526e5ce2e4857565c9375b6c48eed5ed1b3a7389832f6699`.
- La tabla `ProjectLifecycleProjection` existe con índices/FKs esperados y cero
  filas.
- `origin/main@39f6ecbd` no contiene modelo, migración ni código F3.
- Git conserva el SQL y WIP en stashes de seguridad; se rescata por archivo,
  no mediante `stash apply`.
- La rama `feat/production-convergence-f3` ya restaura el SQL exacto e
  implementa contrato, builder, endpoint, CAS, enlace BuildOps, BFF y paneles.
- La migración aditiva
  `20260729000000_evidence_updated_at_for_lifecycle_projection` está pendiente
  de deploy; agrega el reloj requerido para ordenar cambios de validación.

## Inventario de flags

API existentes relacionados:

- `AUTONOMY_LOOPS_ENABLED`
- `PRODUCT_INTELLIGENCE_ENABLED`
- `SATELLITE_TOKENS_ENABLED`

Web existentes relacionados:

- `NEXT_PUBLIC_PRODUCT_INTELLIGENCE_ENABLED`
- `NEXT_PUBLIC_SEMSE_DEMO_LOGIN_ENABLED`
- `NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED`

Flags F3 creados en API sin disparar deploy:

- `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED`
- `SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED`
- `SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS`

Los dos flags están OFF y el allowlist usa un sentinel deshabilitado hasta el
canary. Los valores de las demás variables no se imprimieron ni se documentan
aquí. El deployment API permaneció en `89677ecd-439c-46d2-945f-4482042ff9f1`.

## Estado F0-F9

| Slice | Spec | Código | CI | Merge | Deploy | Activación | Nota |
|---|---|---|---|---|---|---|---|
| F0 Truth sync | completo | completo | n/a | `main` | verificado | n/a | Revalidado 2026-07-28 |
| F1 Event Backbone | `APPROVED` | parcial | histórico | `main` | desplegado | no verificada | Falta canary/adopción |
| F2 Tool Registry | `APPROVED` | gobernanza completa | histórico | `main` | desplegado | parcial/no verificada | Video temporal pendiente |
| F3 Lifecycle Projection | `APPROVED` SDD 2.0 | implementado local | CI/E2E verde en `19472b78` | no fusionado | no desplegado | inactivo | Migración `Evidence.updatedAt` pendiente |
| F4 Mission Control 2.0 | child spec pendiente | no iniciado | — | — | — | — | Después de gate F3 |
| F5 Shared Ledger | child spec pendiente | no iniciado | — | — | — | — | Después de F4 |
| F6 Agenda/Dispatch | child spec pendiente | no iniciado | — | — | — | — | Después de F5 |
| F7 Prometeo Multimodal | child spec pendiente | no iniciado | — | — | — | — | Después de F6 |
| F8 Domain Loops | child specs pendientes | no iniciado | — | — | — | — | BuildOps/Agro/Labor |
| F9 Hardening | child spec pendiente | no iniciado | — | — | — | — | Cierre SLO/DR/security |

## Investigación externa

1. GitHub Spec Kit — ciclo constitution/specify/plan/tasks/implement y “spec of
   specs” para programas grandes.
2. Prisma Migrate — historial de migraciones en Git, no editar/eliminar
   migraciones aplicadas y usar `migrate deploy` en producción.
3. Railway — pre-deploy para migraciones, deployment terminal y healthcheck
   antes de tráfico.
4. GitHub Actions — environments/concurrency/deployment status para separar CI
   y entrega.

### Aplicado ahora

- Programa F3-F9 descompuesto en child specs.
- Metadata separada para código/CI/merge/deploy/activación.
- Restauración del SQL exacto en vez de una migración duplicada.
- Plan de pre-deploy + health + smoke/canary.
- Spec Kit/Spec-Driven alineado a SDD 2.0 con templates, checklist, índice y
  validador strict.
- Build kit portable en Windows/Linux para workspace, seeds y tests API.
- F3 implementado localmente con 20 pruebas focalizadas, 2,005 pruebas API y
  957 pruebas unitarias de repositorio sin fallas.
- PR `#472` validado en `19472b78`: CodeQL, quality gates, cobertura,
  integración, Operación Asistida, Autonomy Staged y E2E pasaron.

### Backlog

- GitHub Environment `production` con protection/concurrency si no existe.
- Continuous uptime externo: Railway healthcheck sólo cubre el arranque.

### Descartado

- Abrir un proxy público permanente a PostgreSQL.
- Aplicar stashes completos.
- Un PR big-bang para F3-F9.
