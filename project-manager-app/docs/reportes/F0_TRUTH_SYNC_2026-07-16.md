# F0 — Sincronizacion de verdad del ecosistema

- **Fecha:** 2026-07-16
- **Alcance:** repositorio, contratos canónicos, `origin/main`, CI y produccion
  publicamente comprobable
- **Resultado:** arquitectura/documentacion sincronizadas; F1-E queda como
  siguiente incremento del Event Backbone

## 1. Snapshot reproducible

| Capa | Evidencia | Resultado |
| --- | --- | --- |
| Repositorio | `git fetch origin main` | fetch exitoso |
| `main` | `6a8b4a0de5ce8bce5c464aa8a7e6e268073dc22d` | PR #312, PI-06 |
| Checkout local | `agent/hotfix-product-events-docker@00d92d2` | limpio al iniciar; 5 commits detras y 4 delante de `origin/main` |
| CI | GitHub Actions run `29498615497` | exitoso para el SHA de `main` |
| Railway deploy | GitHub Actions run `29499372504` | deploy exact-SHA y health-check exitosos |
| Production health | GitHub Actions run `29499581467` | smoke exitoso |
| API publica | `GET /v1/health` | HTTP 200 |
| Web publica | `GET /` | HTTP 200 |
| Prometeo | `GET /v1/prometeo/tools` sin token | HTTP 401; ruta desplegada y protegida |
| Product Intelligence | `GET /v1/product-intelligence/funnel` sin token | HTTP 401; ruta desplegada y protegida |
| Funnel economico | `GET /v1/product-intelligence/funnel/economic` sin token | HTTP 401; ruta desplegada y protegida |

El deploy y los endpoints demuestran que el codigo del SHA esta en produccion.
No demuestran que cada feature flag o allowlist este activa.

## 2. Limitacion de Railway

`railway whoami` y `railway status` devolvieron `Unauthorized`. No se intento
login ni se modificaron variables. Por tanto quedan **no verificados**:

- `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED`;
- `SEMSE_EVENT_CONSUMERS_ENABLED`;
- allowlists de event type/consumer;
- `PRODUCT_INTELLIGENCE_ENABLED`;
- `NEXT_PUBLIC_PRODUCT_INTELLIGENCE_ENABLED`;
- topologia de servicios privados, storage provider y retencion por ambiente.

Los defaults documentados son seguros/off, pero el estado real del ambiente no
se infiere sin acceso autenticado.

## 3. Cambios de verdad desde F0 del 12 de julio

### Event Backbone

F1-A-F1-D estan en `main`:

- envelope v2 y `evidence.uploaded.v1`;
- `Evidence + outbox` en una transaccion;
- dispatcher con leases e ingreso BullMQ;
- worker cuyo job contiene solo `eventId`;
- consumer `evidence-readiness.v1` deny-by-default;
- effect, AuditLog y receipt atomicos;
- idempotencia probada con duplicados, concurrencia y crash/retry;
- dead letter durable para el slice.

No esta cerrado: F1-E debe entregar Ops/replay/RBAC/redaction/trace y F1-F el
canary con switches, SLO y evidencia de activacion.

### Product Intelligence

PI-00-PI-06 estan en `main`:

- `@semse/product-events` separado del Domain Event bus;
- contratos, modelos Prisma, ingesta idempotente y retencion;
- instrumentacion de login, registro y wizard;
- panel/funnel de experiencia;
- funnel economico derivado de Job, Bid, Contract y PaymentEscrow.

PI-07 Friction Engine es el siguiente incremento de ese programa. Activacion de
produccion no verificada.

### Estado sin cambio material

- Prometeo Runtime P2 y su Tool Registry siguen implementados/desplegados; write
  tools permanecen gobernadas/bloqueadas.
- `PaymentTxn` no es un ledger double-entry compartido.
- Mission Control, policy, observabilidad, storage, offline y DR siguen
  parciales.
- Project Lifecycle Projection, Shared Economic Ledger y video intelligence
  siguen pendientes como capacidades completas.

## 4. Deriva corregida

- Los documentos raiz ya no llaman `labsemse/` a este checkout.
- `AGENTS.md` ya no declara como `MISSING` specs que el indice SDD marca
  verificados.
- `SOURCE_OF_TRUTH.md` adopta la jerarquia oficial de seis niveles.
- Arquitectura, contexto, roadmap y matriz usan el mismo SHA/corte.
- Se agrego `packages/product-events` a la topologia documentada.
- F1 ya no aparece detenido en F1-B ni se declara completo.
- Product Intelligence ya no aparece solo como analytics fragmentado.

## 5. Archivos canónicos sincronizados

- `README.md`, `ROADMAP.md`, `SEMSE_CONTEXT.md` de la raiz Git;
- `project-manager-app/AGENTS.md` y `README.md`;
- `docs/SOURCE_OF_TRUTH.md`;
- `docs/architecture/CURRENT_ARCHITECTURE.md`;
- `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`;
- `docs/SEMSE_CONTEXT.md`;
- `ROADMAP.md` y `docs/SPEC_INDEX.md` de la raiz canónica.

Los blueprints/backlogs antiguos que ya tenian banner `SUPERSEDIDO` se
conservaron como historia; no se reescribieron.

## 6. Validacion documental

Resultados:

- `pnpm spec:index`: indice regenerado con 65 specs;
- `pnpm spec:validate -- --strict`: 65 specs, 0 errores, 0 warnings;
- `pnpm spec:coverage`: 60/65 con tests (92%), 45/65 VERIFIED (69%), 5 sin
  tests declarados y 10 de riesgo high/critical aun no VERIFIED;
- `git diff --check`: sin errores luego de normalizar whitespace;
- busqueda focalizada: sin referencias activas a `labsemse`, F1-B como fase
  vigente, specs P1 `MISSING`, ni snapshots SHA anteriores en los entrypoints
  canónicos;
- `pnpm spec:preflight`: **parcial por entorno local**. Pasaron validacion de
  workspace, builds de packages, Prisma generate y build API. Se interrumpio
  `next build` tras más de diez minutos sin avance visible. La shell ejecuta
  Node `20.11.1`, mientras el monorepo exige Node `>=22`; CI del SHA exacto de
  `main` permanece como evidencia completa y verde.

No se ejecutaron tests funcionales nuevos: F0 solo cambia documentacion e
indice generado.

## 7. Siguiente accion aprobada por el roadmap

F1-E — Ops, DLQ y replay:

1. tests tenant/RBAC/audit para replay;
2. list/detail de outbox con cursor y redaccion;
3. replay solo desde estado terminal fallido;
4. actor, reason, replay count y AuditLog;
5. trace outbox + receipts;
6. actualizacion de API surface y Event Catalog.

No activar consumers ni dispatcher en Railway como parte de F0.
