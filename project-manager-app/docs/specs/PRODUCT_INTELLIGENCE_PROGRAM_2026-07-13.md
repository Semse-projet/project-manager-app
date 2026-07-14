# SEMSE Product Intelligence — Programa SDD 2026-07-13

**Estado:** PI-00 COMPLETADO (#300, spec APPROVED). PI-01 COMPLETADO (guard + baseline + CI). Siguiente: PI-02.
**Rama base de trabajo:** `docs/product-intelligence-pi00` → `feat/pi01-prisma-contract-guard`
**Decisión rectora:** SEMSE necesita ver la brecha entre "el servicio responde" y "el usuario logró su objetivo". Los tests no ven el recorrido del usuario: PRs #285 (17 handlers BFF sin Bearer) y #286 (modelo ausente en schema.prisma) llegaron a producción con 1778 tests verdes. Product Intelligence es la capa de telemetría de producto que cierra ese hueco, gobernada por el ciclo OBSERVE→ANALYZE→SUGGEST→APPROVE→APPLY de la Constitución.

> Este documento es la fuente de verdad del programa Y el archivo de estado del loop de ejecución.
> Cada iteración lee este documento, ejecuta la siguiente tarea sin marcar, y actualiza el checklist en el mismo commit.

---

## Specs que gobiernan este programa

| Fase | Spec | Estado |
|------|------|--------|
| PI-00 | `docs/specs/platform/product-intelligence.spec.md` | APPROVED (2026-07-13) |
| PI-01 | (guard técnico, sección PI-01) | DONE |
| PI-02+ | se derivan de la spec de plataforma al aprobarse | — |

---

## Principios (heredan de la Constitución SEMSE y `docs/SDD_GOVERNANCE.md`)

1. **ProductEvent ≠ DomainEvent.** La telemetría de producto (qué hizo el usuario en la UI) nunca se mezcla con los eventos operacionales del negocio (`domain-events`, outbox transaccional de F1). Buses, tablas y retención separados.
2. **Nada de intervenciones automáticas.** El pipeline termina en recomendaciones para aprobación humana (Mission Control). PI observa, analiza y sugiere; jamás aplica.
3. **Colisión de nombres prohibida.** Ya existe `apps/api/src/modules/analytics/` (analítica de negocio: predictive-analytics + dashboard). El módulo nuevo se llama `product-intelligence` y no toca ese código.
4. **Kill switches con default off en producción.** `PRODUCT_INTELLIGENCE_ENABLED`, `PI_INGEST_ENABLED`, `PI_ENGINES_ENABLED`. Sin la variable, el sistema se comporta como si PI no existiera.
5. **Privacidad por diseño.** Redacción agresiva en el SDK (nunca `fieldValue`, nunca prompts completos), clases de consentimiento `essential/standard/restricted`, retención 30 días identificable / 90 días agregada.
6. **Reutilizar antes de crear.** DomainEventBus, OperationalSignals, Observer/BehavioralObserver/Consciousness, Mission Control, RBAC, SSE y AuditLog ya existen y son los puntos de integración; no se duplican.
7. El material externo (pseudocódigo de la spec de Poe) se usa como **spec funcional (~70%)**, no se copia como código.

---

## Auditoría contra el repo (validada 2026-07-11, re-verificada 2026-07-13)

### Existe y se reutiliza
| Pieza | Ubicación | Rol en PI |
|-------|-----------|-----------|
| DomainEventBus + schemas | `apps/api/src/modules/domain-events`, `packages/schemas` | referencia de patrón; PI NO publica aquí |
| OperationalSignals | `apps/api/src/modules/operational-intelligence/operational-signals.service.ts` | destino de señales de fricción/anomalía |
| Observer / BehavioralObserver / Consciousness / EvolutionEngine | `apps/api/src/modules/ops/` | consumidor: dimensión `experienceHealth` |
| Mission Control | admin UI | superficie de aprobación humana |
| RBAC / SSE / AuditLog | core | gobierno y tiempo real |

### No existe (gap real)
- Ningún SDK de analítica en el frontend (sin PostHog ni equivalente).
- Sin modelos Prisma `ProductEvent`, `ProductSession`, `FrictionSignal`, `ConsentRecord`.
- Sin instrumentación web de ningún flujo (auth, wizard, funnel económico).

---

## Arquitectura acordada

```
SDK @semse/product-events (web, batch, redacción en cliente)
  → POST /v1/product-intelligence/ingest (batch idempotente, kill switch)
    → Prisma: ProductEvent / ProductSession (retención 30d identificable)
      → Engines: Funnel · Friction · Anomaly (workers, kill switch)
        → OperationalSignal (operational-intelligence)
          → Observer (dimensión experienceHealth)
            → RecommendationEngine → Mission Control (aprobación humana)
```

---

## Fases

### PI-00 — Spec + auditoría (docs only) — COMPLETADO (PR #300)
- [x] PI-00.1 — Programa maestro (este documento).
- [x] PI-00.2 — `docs/specs/platform/product-intelligence.spec.md` (DRAFT) con contratos de ingesta, modelos y privacidad.
- [x] PI-00.3 — `pnpm spec:validate` + `pnpm spec:index` verdes. PR docs-only (#300).
- [x] PI-00.4 — Aprobación humana de la spec (DRAFT→APPROVED) — usuario, 2026-07-13.

### PI-01 — Guard `verify-prisma-runtime-contract`
Detecta drift código↔schema.prisma↔migraciones↔prod (la clase de bug de #286/#285 que motivó PI). Vale por sí solo aunque el resto del programa se postergue.
- [x] PI-01.1 — `scripts/verify-prisma-runtime-contract.mjs`: 3 niveles (code→schema, schema→migrations, schema→database con --db) + baseline `scripts/prisma-contract-baseline.json` que solo puede encogerse.
- [x] PI-01.2 — Paso en quality-gates tras las migraciones (`continue-on-error: true` hasta 2026-07-20, después bloqueante).

### PI-02 — SDK + contratos
- [ ] PI-02.1 — Schemas Zod en `packages/schemas/src/product-events.schema.ts` (evento, sesión, consentimiento, batch envelope con idempotency key).
- [ ] PI-02.2 — `packages/product-events` (SDK web): cola local, batch, redacción en cliente, respeto de consentimiento, no-op si kill switch apagado.

### PI-03 — Modelos Prisma
- [ ] PI-03.1 — `ProductEvent`, `ProductSession`, `FrictionSignal`, `ConsentRecord` en `schema.prisma` + migración.
- [ ] PI-03.2 — Job de retención (30d identificable / 90d agregada).

### PI-04 — Ingesta
- [ ] PI-04.1 — Módulo `product-intelligence` en API: `POST /v1/product-intelligence/ingest` batch idempotente, rate-limited, kill switch.
- [ ] PI-04.2 — BFF `/api/semse/product-intelligence/ingest` (público con consentimiento, anónimo permitido).

### PI-05 — Instrumentación P0: auth/registro/wizard
Primer flujo instrumentado por historial real de bugs (register perdía contexto — PR #296).
- [ ] PI-05.1 — Eventos: `auth.login_view`, `auth.register_view`, `auth.context_recovered`, `wizard.prefill_arrived`, `wizard.published`.
- [ ] PI-05.2 — Funnel landing→wizard→registro→job publicado visible en admin.

### PI-06 — Funnel económico
- [ ] PI-06.1 — Eventos job→bid→contract→evidence→payment.
- [ ] PI-06.2 — Métricas de conversión por etapa + tiempo entre etapas.

### PI-07 — Friction Engine
- [ ] PI-07.1 — Detección: rage clicks, loops de navegación, abandono de formulario, errores repetidos → `FrictionSignal`.

### PI-08 — Anomaly Engine → OperationalSignal
- [ ] PI-08.1 — Umbrales sobre funnels y fricción; emite OperationalSignal (severity, evidencia agregada).

### PI-09 — Observer / Consciousness
- [ ] PI-09.1 — Dimensión `experienceHealth` en Observer alimentada por señales PI.

### PI-10 — Mission Control UI
- [ ] PI-10.1 — Panel funnels + fricción + recomendaciones con aprobación humana.

### PI-11 — Verticales + hardening
- [ ] PI-11.1 — Instrumentar Agro y Prometeo chat.
- [ ] PI-11.2 — Auditoría de privacidad (verificar redacción real en payloads de prod) + cierre.

---

## Registro de decisiones

| Fecha | Decisión |
|-------|----------|
| 2026-07-11 | Material externo aceptado como base; pseudocódigo = spec funcional, no código. |
| 2026-07-11 | El módulo se llama `product-intelligence`; `analytics` existente no se toca. |
| 2026-07-13 | PI-00 arranca tras cerrar los P0 de la auditoría web (PRs #295–#298 + fix de dato en prod). |
| 2026-07-13 | Spec aprobada por el usuario (DRAFT→APPROVED). |
| 2026-07-13 | PI-01 detectó drift REAL preexistente en main: 6 accessors sin modelo (`changeOrder`, `drawRequest`, `evidenceLog`, `evidencePhoto`, `tradeMetric`, `weatherAlert`) — todos en código muerto jamás registrado en módulos NestJS, habilitado por el index signature `[delegate: string]: any` de PrismaService; y 3 tablas Lien* en prod (baseline P3005) sin migración. Documentado en `scripts/prisma-contract-baseline.json`; la lista solo puede encogerse. |
