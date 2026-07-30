# Production Convergence Tracker

**Corte:** 2026-07-30
**Programa:** `platform.production-convergence-f3-f9`
**Rama de trabajo:** `docs/f3-production-canary-evidence`

## Verdad desplegada

| Superficie | Estado |
|---|---|
| `origin/main` | `35f6bda3` |
| API Railway | `35f6bda3`, deployment `2b0cb689-5bf8-42c0-a86a-b6076a1be36d`, `SUCCESS` |
| Web Railway | `35f6bda3`, deployment `239ea013-84b5-48cc-90dd-eed3e76b2c99`, `SUCCESS` |
| Worker/Vision | `35f6bda3`, deployments `4e91525c` / `174e569e`, `SUCCESS` |
| Postgres/Redis | `SUCCESS`; repair F3 aplicado y auditado por red privada |
| `api.semseproject.com` | DNS propagado; certificado sigue validando propiedad y no coincide con el hostname |

## Drift F3 confirmado

- `_prisma_migrations` contiene
  `20260728000000_project_lifecycle_projection`, aplicada exitosamente el
  2026-07-28.
- Checksum PostgreSQL:
  `1616b63c7c44bfa0526e5ce2e4857565c9375b6c48eed5ed1b3a7389832f6699`.
- La tabla `ProjectLifecycleProjection` existe con índices/FKs esperados; partió
  con cero filas y conserva una única fila después del canary durable.
- `origin/main@39f6ecbd` no contiene modelo, migración ni código F3.
- Git conserva el SQL y WIP en stashes de seguridad; se rescata por archivo,
  no mediante `stash apply`.
- La rama `feat/production-convergence-f3` ya restaura el SQL exacto e
  implementa contrato, builder, endpoint, CAS, enlace BuildOps, BFF y paneles.
- La migración aditiva
  `20260729000000_evidence_updated_at_for_lifecycle_projection` fue aplicada y
  agrega el reloj requerido para ordenar cambios de validación.
- Canary autenticado de cálculo devolvió 500 porque la migración canónica de
  Evidence figura aplicada con checksum correcto, pero producción no conserva
  sus nueve columnas tenant/context. El rollback por flag terminó en
  `537892e7`; F3 vuelve a 404 y la tabla de proyección conserva cero filas.
- `20260730010000_repair_evidence_canonical_schema` repara ese drift de forma
  aditiva antes de reintentar el canary. El SQL exacto se ejecutó dos veces
  contra una tabla legacy en una transacción de PostgreSQL, verificó nueve
  columnas, backfill, FKs e índices y terminó con `ROLLBACK`.
- PR `#473` pasó CI/CodeQL/integración/E2E y fue fusionado como `35f6bda3`.
- La migración reparadora quedó aplicada una vez con checksum
  `3e0bf135554de41e44db8b8bd7d46deb22a93352219d96eeff395180b8197898`.
  Producción tiene nueve columnas contextuales, cuatro filas Evidence, cero
  `tenantId` nulos, dos FKs y tres índices.
- El canary de cálculo (`85299c98`) y el de persistencia (`7450784e`) terminaron
  `SUCCESS`. Cliente owner respondió 200 dos veces con revisión estable; PRO sin
  ownership financiero respondió 403 y tenant fuera de allowlist respondió 404.
- La proyección durable coincide en tenant, proyecto, `schemaVersion`, revisión
  y `sourceUpdatedAt`; filas = 1 y mismatch = 0.

## Inventario de flags

API existentes relacionados:

- `AUTONOMY_LOOPS_ENABLED`
- `PRODUCT_INTELLIGENCE_ENABLED`
- `SATELLITE_TOKENS_ENABLED`

Web existentes relacionados:

- `NEXT_PUBLIC_PRODUCT_INTELLIGENCE_ENABLED`
- `NEXT_PUBLIC_SEMSE_DEMO_LOGIN_ENABLED`
- `NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED`

Flags F3 desplegados y ejercitados en API:

- `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED`
- `SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED`
- `SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS`

Cálculo y persistencia están ON únicamente para el allowlist
`tenant_default`. Los valores de las demás variables no se imprimieron ni se
documentan aquí. El rollback previo terminó en `537892e7` y el forward-fix
canary quedó en `7450784e`.

## Estado F0-F9

| Slice | Spec | Código | CI | Merge | Deploy | Activación | Nota |
|---|---|---|---|---|---|---|---|
| F0 Truth sync | completo | completo | n/a | `main` | verificado | n/a | Revalidado 2026-07-28 |
| F1 Event Backbone | `APPROVED` | parcial | histórico | `main` | desplegado | no verificada | Falta canary/adopción |
| F2 Tool Registry | `APPROVED` | gobernanza completa | histórico | `main` | desplegado | parcial/no verificada | Video temporal pendiente |
| F3 Lifecycle Projection | `IMPLEMENTED` SDD 2.0 | implementado | CI/E2E verde | `35f6bda3` | desplegado | `CANARY` | Repair y canary durable verificados; faltan rebuild/event replay |
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
- F3 fusionado y desplegado con 20 pruebas focalizadas, 2,005 pruebas API y
  957 pruebas unitarias de repositorio sin fallas.
- PR `#472` validado en `19472b78`: CodeQL, quality gates, cobertura,
  integración, Operación Asistida, Autonomy Staged y E2E pasaron.
- PR `#473` validado en `96318d8f` y fusionado como `35f6bda3`; Railway Deploy
  y Production Health Gate `30509069492` terminaron en éxito.
- Repair Evidence, cálculo canary, persistencia canary, aislamiento tenant/org y
  revisión durable fueron comprobados contra producción.

### Backlog

- GitHub Environment `production` con protection/concurrency si no existe.
- Continuous uptime externo: Railway healthcheck sólo cubre el arranque.

### Descartado

- Abrir un proxy público permanente a PostgreSQL.
- Aplicar stashes completos.
- Un PR big-bang para F3-F9.
