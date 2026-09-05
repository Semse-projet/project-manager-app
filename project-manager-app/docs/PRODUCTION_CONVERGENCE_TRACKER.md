# Production Convergence Tracker

**Corte:** 2026-07-31
**Programa:** `platform.production-convergence-f3-f9`
**Base documental:** PR `#481`, merge `114cb9ca`

## Verdad desplegada

| Superficie | Estado |
|---|---|
| `origin/main` | `114cb9ca4007d32bf3fbbfc9c36d54b1e862236a` |
| F3 event merge | PR `#477`, `f1234291fc190c6611d3f2258630ac08315bd060` |
| API Railway | `575a82f1-ac99-4d60-a5d2-e6aeb645e096`, `114cb9ca`, `SUCCESS` |
| Web Railway | `3ffb51d5-6dd1-4fd3-afa2-b7c6b1cff489`, `114cb9ca`, `SUCCESS` |
| Worker Railway | `8fe3b3fc-c10a-4843-82cf-d4a2e79297ec`, `114cb9ca`, `SUCCESS` |
| Vision Railway | `bf804e3b-9a56-4b94-b1ad-6e6bcafd57cd`, `114cb9ca`, `SUCCESS` |
| Postgres/Redis | `SUCCESS`; migraciones/repair F3 reconciliados |
| Health API Railway | `/v1/health` = 200 |
| Health Web custom/Railway | `/api/semse/healthz` = 200 |
| `api.semseproject.com` | Railway sync `ACTIVE`; TLS estricto válido; `/v1/health` = 200 |

`114cb9ca` es descendiente de `f1234291`; contiene el hardening y la evidencia
SDD de F3 sin retirar su configuración canary.

## F3 — estado final del child

| Etapa | Estado | Evidencia |
|---|---|---|
| Spec | `VERIFIED`, scope canary | `operations.project-lifecycle-projection` |
| Código | `COMPLETE` | PR `#472`, repair `#473`, events/replay `#477` |
| CI | `PASS` | unit, API integration PostgreSQL, E2E, CodeQL, coverage |
| Merge | `MERGED` | `f1234291` para cierre event-driven |
| Deploy | `DEPLOYED` | workflow `30542950757`; cuatro servicios `SUCCESS` |
| Migraciones | `VERIFIED` | projection, Evidence clock y repair canónico |
| Activación | `CANARY` | sólo `tenant_default` |
| Snapshot | verificado | 1 fila, revisión estable, mismatch 0 |
| Eventos | verificados | 5 `PUBLISHED`, 5 `COMPLETED`, 0 failed/dead-letter |
| Replay | verificado | `no_op`, una proyección, sin error |

F3 no está promovido globalmente. Su gate child se cerró porque el scope
aprobado era un canary productivo y la metadata distingue `CANARY` de `ACTIVE`.

## Migraciones y drift F3

- `20260728000000_project_lifecycle_projection` conserva el SQL exacto y
  checksum
  `1616b63c7c44bfa0526e5ce2e4857565c9375b6c48eed5ed1b3a7389832f6699`.
- `20260729000000_evidence_updated_at_for_lifecycle_projection` agregó el reloj
  Evidence necesario para revision/CAS.
- El primer canary reveló que la migración canónica Evidence figuraba aplicada,
  pero faltaban nueve columnas tenant/context.
- El rollback por flags terminó en deployment `537892e7`; no se borró la tabla.
- `20260730010000_repair_evidence_canonical_schema` reparó de forma aditiva el
  drift sin reescribir historial.
- Producción terminó con nueve columnas contextuales, cuatro filas Evidence,
  cero `tenantId` nulos, dos FKs y tres índices.
- Canary de cálculo `85299c98` y persistencia `7450784e`: `SUCCESS`; client
  owner 200, PRO sin ownership financiero 403, tenant fuera de allowlist 404,
  revisión estable y mismatch 0.

## Event-driven canary

Contrato:

- evento `project.lifecycle-source-changed.v1`;
- consumer `project-lifecycle-projection.v1`;
- rebuild tenant-scoped;
- persistencia CAS;
- AuditLog y receipt idempotente;
- producer default-off y allowlists.

Resultado al cierre:

- outbox total observado: 5 `PUBLISHED`;
- outbox `PENDING/CLAIMED/FAILED/DEAD_LETTER`: 0;
- consumos `COMPLETED`: 5;
- consumos `FAILED/DEAD_LETTER`: 0;
- eventos automáticos:
  `d48cf482-4e38-4fd2-a222-5e558db3b41a`,
  `0b114154-f26b-4569-90e3-8cf8d79fce15`,
  `5173120d-f312-4d8e-880e-2d2adee8d3b8`.

Replay final:

```text
eventId:         5173120d-f312-4d8e-880e-2d2adee8d3b8
projectId:       cmrsjhzgh007nps01r6gnx090
outbox:          PUBLISHED
consumer:        COMPLETED
replayCount:     1
attempts:        1
duplicate:       true
effect:          no_op
lastError:       null
revision:        project-lifecycle.v1:0f8f7c9fb7c45d9fbd55bb733bb3b06e5265782b6113a1e622a675679a7d244d
```

## Incidente de rol y reconciliación

Los dos primeros jobs recibieron 403 porque el Worker sólo tenía
`OPS_ADMIN,WORKER`; el endpoint interno exige `EVENT_CONSUMER` y
`domain-events:consume`.

Eventos afectados:

- `f893805f-6cd9-4ded-8a75-c3ee58dd4a37`
- `dab442a8-c747-45c2-9f5a-fef3869fd935`

Se agregó `EVENT_CONSUMER`, se desplegó el Worker corregido y ambos eventos se
procesaron una sola vez. Después se observaron tres consumos automáticos. No
quedaron errores de deployment ni receipts fallidos.

## Atomicidad declarada

- Evidence registra estado + `evidence.uploaded.v1` + invalidación F3 en la
  misma transacción.
- Project, Milestone, Dispute, Payment, Finance, Risk y promoción BuildOps
  emiten la invalidación F3 post-commit y son best-effort.
- Read-through, rebuild idempotente y eventos posteriores son la recuperación
  actual.
- La adopción de outbox transaccional por cada dominio permanece en el Event
  Backbone/hardening; no se declara como capacidad ya existente.

## Inventario de flags F3

API:

- `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED`
- `SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED`
- `SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS`
- `SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED`
- `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED`
- `SEMSE_EVENT_CONSUMERS_ENABLED`
- `SEMSE_EVENT_CONSUMER_ALLOWLIST`
- `SEMSE_EVENT_TYPE_ALLOWLIST`

Worker:

- `SEMSE_EVENT_CONSUMERS_ENABLED`
- `SEMSE_ROLES` con `EVENT_CONSUMER`

El scope sigue siendo `tenant_default`. No se documentan secretos ni variables
ajenas al flujo.

## Estado F0-F9

| Slice | Spec | Código | CI | Merge | Deploy | Activación | Nota |
|---|---|---|---|---|---|---|---|
| F0 Truth sync | completo | completo | n/a | `main` | verificado | n/a | Revalidado 2026-07-31 |
| F1 Event Backbone | `APPROVED` | parcial | histórico + F3 verde | `main` | desplegado | canary acotado | F1-F transversal pendiente |
| F2 Tool Registry | `APPROVED` | gobernanza completa | histórico | `main` | desplegado | parcial/no verificada | Video temporal pendiente |
| F3 Lifecycle Projection | `VERIFIED` SDD 2.0 | completo | PASS | `f1234291` | desplegado | `CANARY` | Gate child cerrado para `tenant_default` |
| F4 Mission Control 2.0 | `APPROVED` SDD 2.0 | no iniciado | — | — | — | `INACTIVE` | Spec/plan/tasks/analyze/checklist coherentes |
| F5 Shared Ledger | child spec pendiente | no iniciado | — | — | — | — | Después de F4 |
| F6 Agenda/Dispatch | child spec pendiente | no iniciado | — | — | — | — | Después de F5 |
| F7 Prometeo Multimodal | child spec pendiente | no iniciado | — | — | — | — | Después de F6 |
| F8 Domain Loops | child specs pendientes | no iniciado | — | — | — | — | BuildOps/Agro/Labor |
| F9 Hardening | child spec pendiente | no iniciado | — | — | — | — | SLO/DR/security/global rollout |

## Investigación externa aplicada

1. GitHub Spec Kit: ciclo constitution/specify/plan/tasks/analyze/implement y
   descomposición de programas en slices.
2. Prisma Migrate: historial versionado, migraciones aplicadas inmutables y
   `migrate deploy` para producción.
3. Railway: pre-deploy, deployment terminal y health antes de verificación
   funcional separada.
4. GitHub Actions: checks por SHA, environments y concurrency para separar CI
   de entrega.

Decisiones aplicadas: metadata separada por etapa, SQL histórico restaurado en
vez de duplicado, forward-fix aditivo, canary default-off, child specs
secuenciales y evidencia de activación separada del healthcheck.

## Backlog vinculante

- Habilitar registrar lock como hardening administrativo del dominio después de
  confirmar el procedimiento/rollback con el registrador. No afecta el DNS/TLS
  ya resuelto; la cronología está en
  [`runbooks/API_CUSTOM_DOMAIN_TLS_HANDOFF.md`](runbooks/API_CUSTOM_DOMAIN_TLS_HANDOFF.md).
- Medir ventana sostenida de P95, 5xx, lag, retries, DLQ y mismatch antes de
  promoción global F3.
- Completar F1-F transversal.
- Implementar Mission Control 2.0 sólo desde el child SDD F4 aprobado, con
  tests primero, migración aditiva, flags default-off y canary acotado.
- Configurar GitHub Environment `production` con protection/concurrency si no
  existe.
- Añadir uptime externo; health de Railway sólo cubre arranque.

## Descartado

- Abrir PostgreSQL permanentemente a Internet.
- Aplicar stashes completos.
- Un PR big-bang para F3-F9.
- Presentar `CANARY` como `ACTIVE`.
