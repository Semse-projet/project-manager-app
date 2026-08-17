---
id: "satellites.observer-nodes"
title: "SAT-008 — Satélites como nodos externos en Observer/Consciousness"
domain: "ops"
sdd_version: "2.0"
version: "1.1"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/ops/consciousness.service.ts
  - apps/api/src/modules/ops/consciousness.types.ts
  - apps/api/src/modules/ops/observer.service.ts
  - apps/api/src/modules/ops/ops.controller.ts
  - apps/web/components/semse/ObserverPanel.tsx
  - apps/api/src/modules/satellites/satellites.service.ts
  - packages/sdk/src/client.ts
  - packages/db/prisma/schema.prisma
  - apps/worker/src/modules/autonomy-loops/loops.scheduler.mjs
  - SATELLITES.md
related_tests: []
related_endpoints:
  - v1/ops/consciousness/index
  - v1/ops/observer/snapshot
related_events: []
related_agents: []
last_verified: "2026-08-17"
---

# Spec: Satélites en Observer/Consciousness

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

Este spec migra el contenido del documento SDD 1.x anterior al formato
SDD 2.0 y lo verifica contra el código real. **No se escribió código
nuevo.**

## 1. Problema y resultado

**Para quién:** `OPS_ADMIN` que vigila `ObserverPanel`
(`apps/web/components/semse/ObserverPanel.tsx`), la vista ya real de
Consciousness/Observer montada en `/admin`.

**Problema:** con SAT-001..007 SEMSE queda conectado a órganos externos que
pueden fallar en silencio (Lambda de Alexa, mobile app sin usar, graphify
sin ingesta, webhooks suspendidos). El espejo interno — Consciousness,
`apps/api/src/modules/ops/consciousness.service.ts`, ya real y consumido
por `ObserverPanel.tsx` — no los ve. **Verificado en esta sesión:** cero
menciones de "satellite" en todo `apps/api/src/modules/ops` (grep
exhaustivo) y ningún campo `sdkVersion` en el modelo `SatelliteToken`
(`packages/db/prisma/schema.prisma:388-401`). El estado declarado de cada
satélite hoy solo vive en `SATELLITES.md`, un archivo markdown editado a
mano en la raíz del repo, sin ningún servicio que lo lea ni lo contraste
con la realidad observada — el organismo no percibe sus extremidades, ni
siquiera puede confirmar si lo que dice de sí mismo es cierto.

**Resultado esperado:** `ObserverPanel` muestra una sección "Satélites" con
el estado real de al menos 2 nodos (nombre, `lastSeenAt`, `sdkVersion`,
divergencia vs `SATELLITES.md`); el índice de madurez de Consciousness
incorpora una dimensión de "conectividad satelital" calculada a partir de
señales reales, no de la tabla markdown por sí sola.

**Estado de partida honesto:** hoy, de los satélites listados en
`SATELLITES.md`, ninguno está en estado `LIVE` bajo el mecanismo de
satellite token (`alexa` está en `CONNECTED-STAGING`; `graphify` figura
`LIVE` pero por un mecanismo estructuralmente distinto — ver §2). Construir
esta observabilidad ahora es una apuesta a que los satélites lleguen a
`LIVE` pronto, no una respuesta a un incidente ya ocurrido — dato relevante
para priorización, aunque no bloquea la especificación técnica en sí (ver
§`Bloqueado por decisión de producto` para el bloqueo real).

## 2. Alcance

### Incluido

- Modelo `SatelliteNode` (persistencia a decidir, ver §7 — bloqueado).
- Heartbeat pasivo: derivar `lastSeenAt`/`sdkVersion` del `lastUsedAt` del
  satellite token (ya genérico y real,
  `apps/api/src/modules/satellites/satellites.service.ts:145-152`) más el
  header `x-semse-sdk-version` que el SDK **ya envía en cada request**
  (`packages/sdk/src/client.ts:105`, `SDK_VERSION = "0.1.0"`,
  `packages/sdk/src/client.ts:13`) — verificado: la API no lo lee ni lo
  persiste hoy (cero resultados al buscar `x-semse-sdk-version` o
  `sdkVersion` fuera de `packages/sdk`).
- Heartbeat activo (opcional): probe de un permanent-loop del worker
  (patrón real ya existente, `apps/worker/src/modules/autonomy-loops/loops.scheduler.mjs`,
  kill switch `AUTONOMY_LOOPS_ENABLED`) para satélites con salud propia
  (graphify `health()`, storage `health()`).
- Dimensión "conectividad satelital" en `SemseConsciousnessIndex`
  (`apps/api/src/modules/ops/consciousness.types.ts`).
- Sección "Satélites" en `ObserverPanel.tsx`.
- Job de reconciliación `SATELLITES.md` ↔ estado observado (reporta
  divergencias, no las corrige).

### Fuera de alcance

- Auto-remediación (autonomyLevel ≥ 2, no este spec).
- Alertas externas vía Communications Gateway (se decide aparte).
- El contenido de `webhooks: {active, suspended}` del modelo propuesto: SAT-007
  (`docs/specs/satellites/SAT-007-outbound-webhooks.spec.md`) sigue en
  `DRAFT` sin código (`satellites.outbound-webhooks | DRAFT` en
  `docs/SPEC_INDEX.md:113`). Ese campo queda como `null`/`0` hasta que
  SAT-007 exista; este spec no construye webhooks salientes ni inventa un
  evento de dominio para representarlos.
- Restricción absoluta v1, heredada sin cambios: **observar y reportar,
  nunca actuar sobre satélites** (mismo texto que el original §3).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `ops:dashboard:read` (ya otorgado y ya protege ambos endpoints extendidos — `apps/api/src/modules/ops/ops.controller.ts:498-499`, `:526-527`) | panel `/admin`, sin scoping adicional | Leer la dimensión de conectividad satelital y la sección "Satélites" del panel | Cambiar el estado de un satélite, revocar un token, forzar un heartbeat — este spec no expone ninguna acción de escritura |

- **Tenant boundary:** N/A — Consciousness es un panorama global de
  plataforma, no por tenant (igual que hoy).
- **Ownership/resource policy:** N/A — solo lectura agregada.
- **Step-up o aprobación humana:** ninguno — no hay escritura.
- **Datos `privacyCritical`:** ninguno — nombres de satélite, timestamps y
  versión de SDK no son datos de usuario.
- **Requisitos de auditoría:** ninguno nuevo — es observación pasiva, igual
  que el resto de Consciousness (`consciousness.types.ts` documenta
  explícitamente "MUST NOT modify any data, trigger payments, or touch
  infrastructure").

## 4. Escenarios y criterios de aceptación

### P1 — `OPS_ADMIN` detecta un satélite `STALE`

```gherkin
DADO un satélite con satellite token cuyo lastUsedAt supera 72h sin actividad
CUANDO OPS_ADMIN abre la sección "Satélites" de ObserverPanel
ENTONCES el nodo aparece marcado STALE (warning, no cambia ninguna FSM de negocio)
Y la dimensión "conectividad satelital" del índice de madurez baja de forma explicable
```

### P2 — Divergencia documento vs realidad

```gherkin
DADO que SATELLITES.md declara un satélite como LIVE
Y el heartbeat observado (pasivo o activo) lo marca STALE o sin señal
CUANDO corre el job de reconciliación
ENTONCES se reporta la divergencia como señal de primera clase en Consciousness
Y SATELLITES.md NO se edita automáticamente (solo reporta)
```

Casos borde:

- [ ] Satélite sin ningún heartbeat aún (nunca usado) — no debe contar como
      `STALE` con datos falsos; estado inicial explícito (`NEVER_SEEN` o
      equivalente), distinto de `STALE`.
- [ ] `graphify` no tiene satellite token (usa `existsSync` del grafo
      empaquetado en build-time, según `SATELLITES.md`, fila `graphify`) —
      el heartbeat pasivo basado en `lastUsedAt` **no lo cubre**; requiere
      el probe activo (§2) o queda fuera de la dimensión con estado
      explícito, no un falso `STALE`.
- [ ] Apagar `AUTONOMY_LOOPS_ENABLED` no debe romper el heartbeat pasivo
      (que no depende del worker) — solo desactiva el probe activo.
- [ ] Aislamiento: la sección "Satélites" no expone el secreto de ningún
      token, solo `id`/`name` (mismo patrón que `listTokens()`,
      `apps/api/src/modules/satellites/satellites.service.ts:90-110`).

## 5. Contratos

### API — `GET /v1/ops/consciousness/index` (extensión, no endpoint nuevo)

```yaml
auth: required
permissions: [ops:dashboard:read]   # ya vigente, sin cambio
input_schema: (sin cambios respecto al endpoint actual)
output_schema:
  # SemseConsciousnessIndex existente (apps/api/src/modules/ops/consciousness.types.ts)
  # + nuevo bloque:
  satelliteConnectivity:
    score: number            # 0-100, f(nodos LIVE con heartbeat fresco / total, webhooks suspendidos, divergencia doc)
    nodes: SatelliteNode[]
    divergences: { satellite: string; declared: string; observed: string }[]
errors:
  400/401/403/404/409: sin cambio respecto al endpoint actual
effects:
  audit_log: ninguno (solo lectura)
  domain_event: ninguno
  sse: no
  payment_governance: no
```

### API — `GET /v1/ops/observer/snapshot` (extensión)

```yaml
auth: required
permissions: [ops:dashboard:read]   # ya vigente
output_schema:
  # ObserverSnap existente (consumido por apps/web/components/semse/ObserverPanel.tsx)
  # + nuevo bloque:
  satellites: SatelliteNode[]
```

### Tipo `SatelliteNode` (nuevo, propuesto — persistencia bloqueada, ver §7)

```ts
interface SatelliteNode {
  name: string;                    // alexa | mobile | graphify | storage | protools-embed
  spec: string;                    // SAT-00X
  declaredState: 'DRAFT' | 'APPROVED' | 'CONNECTED-STAGING' | 'LIVE' | 'SUSPENDED' | 'ARCHIVED'; // desde SATELLITES.md
  observedState: 'FRESH' | 'STALE' | 'NEVER_SEEN' | 'NOT_APPLICABLE'; // derivado de heartbeat
  tokenId: string | null;          // null para graphify (sin satellite token)
  lastSeenAt: string | null;       // ISO8601
  sdkVersion: string | null;
  webhooks: { active: number; suspended: number } | null; // null hasta SAT-007
  latencyP95Ms: number | null;
}
```

### UI

```yaml
surfaces:
  - apps/web/components/semse/ObserverPanel.tsx (nueva sección "Satélites")
states:
  - loading
  - empty       # sin ningún satellite token emitido aún
  - ready
  - forbidden   # ops:dashboard:read ausente — ya cubierto por el guard existente del panel
  - degraded    # heartbeat activo caído, heartbeat pasivo sigue disponible
  - error
required_behavior:
  - badge de divergencia visible cuando declaredState != estado inferido de observedState
  - nunca mostrar el secreto del token, solo id/name
```

### Agente/Prometeo

N/A.

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: la FSM de satélite de `SAT-000 §3`
  (`DRAFT → APPROVED → CONNECTED-STAGING → LIVE → SUSPENDED/ARCHIVED`) se
  **lee**, no se muta — este spec es puramente observacional.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` — sin invariantes de
  negocio (jobs/milestones/escrow) afectadas.
- Eventos declarados: `docs/foundation/EVENT_CATALOG.md` no tiene ninguna
  entrada de transición de satélite hoy; no se inventa una aquí (prohibido
  por `AGENTS.md`). Si se decide emitir un evento al detectar divergencia,
  se agrega al catálogo antes de `implement`.
- Productor + outbox atómico / Consumidores + idempotencia / Replay/rebuild
  / DLQ: N/A — sin proyección de estado de negocio, solo lectura agregada.

## 7. Datos y migración

**Ver bloqueo de decisión abajo — esta sección no se puede completar sin
esa decisión.** Dos rutas mutuamente excluyentes:

- **Ruta A — `SATELLITES.md` sigue siendo la fuente humana.** El job de
  reconciliación parsea el markdown en runtime (requiere empaquetar el
  archivo en la imagen Docker de `apps/api`, similar a cómo el grafo de
  graphify se genera en build-time — `SATELLITES.md`, fila `graphify`) y lo
  compara contra el heartbeat observado. No hay migración Prisma nueva más
  allá de, quizás, una tabla de solo-caché del último snapshot parseado.
- **Ruta B — el estado declarado migra a Prisma.** Se extiende
  `SatelliteToken` (`packages/db/prisma/schema.prisma:388-401`) o se crea
  un modelo `SatelliteRegistry` con `declaredState`, `spec`; `SATELLITES.md`
  pasa a ser una vista **generada** (mismo patrón que
  `docs/SPEC_INDEX.md` con `pnpm spec:index`) en vez de editada a mano.
  Requiere migración Prisma real siguiendo el flujo estándar
  (`packages/db/prisma/schema.prisma` → `prisma migrate dev` → `pnpm db:generate`).

Ninguna de las dos se declara aquí como definitiva — ver bloqueo.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: score de conectividad satelital, conteo de nodos `STALE`.
- Logs/traces/correlation: mismo patrón que el resto de `ops` (`resolveRequestId`).
- Health/readiness: sin impacto en el readiness actual — la nueva dimensión
  es aditiva sobre `consciousness/index`, que ya existe y ya está en
  producción con `IMPLEMENTED`/similar en su propio historial.
- Feature flags: `CONSCIOUSNESS_SATELLITES_DIMENSION_ENABLED` (nuevo,
  propuesto — no implementado, por eso `feature_flags: []` en el
  frontmatter) para poder desactivar la dimensión sin deploy si el cálculo
  resulta ruidoso al activarse por primera vez. No hace falta un kill
  switch de "acción" porque este spec nunca actúa sobre satélites (§2).
- Plan de canary: activar la dimensión primero en un entorno de staging
  contra los nodos reales (`alexa`, `graphify`) antes de exponerla en
  `ObserverPanel` de producción.
- Evidencia de producción requerida: panel visible en Railway con al menos
  2 nodos reales reportando; evidencia pegada en `docs/reportes/`.
- Señal de rollback: apagar `CONSCIOUSNESS_SATELLITES_DIMENSION_ENABLED`
  retira la sección y el campo sin afectar el resto de Consciousness
  (aditivo, no reemplaza nada existente).
- Owner operativo: `semse-core`.

## 9. Tests requeridos

Arnés SAT-000 (`docs/specs/satellites/SAT-000-sdd-harness.spec.md` §2) —
ninguno de los 4 anillos existe hoy para este alcance (verificado: cero
menciones de "satellite" en `apps/api/src/modules/ops`, sin tests
relacionados en el árbol).

- [ ] **Anillo 1 (contrato):** cálculo de la dimensión testeado con
      fixtures — todo fresco, un nodo `STALE`, un webhook suspendido
      (cuando exista SAT-007), una divergencia documento↔realidad.
- [ ] **Anillo 2 (SDK):** el header `x-semse-sdk-version` está presente en
      toda llamada del SDK — **esta parte ya existe y ya tiene cobertura
      implícita** en `packages/sdk/src/client.ts:105`; falta el test
      explícito que lo verifique como contrato, no el código en sí.
- [ ] **Anillo 3 (E2E local):** llamada real vía SDK actualiza `lastSeenAt`;
      apagar (simular caída de) graphify ⇒ el probe activo marca `STALE`.
- [ ] **Anillo 4 (smoke Railway):** panel visible en Railway con ≥ 2 nodos
      reales reportando; evidencia en `docs/reportes/`.
- [ ] Unitarios del dominio/proyección (cálculo de `satelliteConnectivity.score`).
- [ ] Contrato API/BFF de la extensión de `consciousness/index` y `observer/snapshot`.
- [ ] Permiso denegado (sin `ops:dashboard:read`).
- [ ] UI loading/empty/forbidden/degraded/error de la nueva sección.
- [ ] El índice de madurez cambia de forma explicable (delta documentado)
      al activar la dimensión.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/ops/consciousness.service.ts` — cálculo de
  `satelliteConnectivity`.
- `apps/api/src/modules/ops/consciousness.types.ts` — nuevos tipos
  (`SatelliteNode`, extensión de `SemseConsciousnessIndex`).
- `apps/api/src/modules/ops/observer.service.ts` — extensión del snapshot.
- `apps/api/src/modules/ops/ops.controller.ts` — sin endpoint nuevo, ambos
  handlers existentes (`consciousness/index` línea 498, `observer/snapshot`
  línea 526) devuelven el campo adicional.
- `apps/api/src/modules/satellites/satellites.service.ts` — posible
  extensión de `verifyToken()` para capturar `x-semse-sdk-version` del
  header entrante (hoy solo actualiza `lastUsedAt`, líneas 145-152).

### Web

- `apps/web/components/semse/ObserverPanel.tsx` — nueva sección "Satélites".

### Worker/Packages/DB

- `apps/worker/src/modules/autonomy-loops/` — nuevo probe activo (patrón
  `loops.scheduler.mjs`), condicionado a `AUTONOMY_LOOPS_ENABLED`.
- `packages/db/prisma/schema.prisma` — migración según la ruta elegida en §7.

### Tests

- `apps/api/test/` — nuevo `consciousness-satellites.test.ts` (o similar).

## 11. Investigación externa

- No se realizó investigación externa en esta sesión. El trabajo fue 100%
  verificación de esta spec contra el código real del monorepo (grep/read
  de `apps/api/src/modules/ops`, `apps/api/src/modules/satellites`,
  `packages/sdk/src/client.ts`, `packages/db/prisma/schema.prisma`,
  `apps/web/components/semse/ObserverPanel.tsx`, `SATELLITES.md`).
- Aplicado ahora: N/A.
- Backlog: si se retoma, investigar patrones de "vista generada desde DB"
  ya usados en el propio repo (`pnpm spec:index` sobre `docs/SPEC_INDEX.md`)
  como precedente directo para la Ruta B de §7.
- Descartado: N/A.

## Bloqueado por decisión de producto

Este spec **no puede pasar a `APPROVED`** por una decisión de
arquitectura/producto que determina todo el modelo de datos (§7) y que no
es resoluble leyendo código:

**¿`SATELLITES.md` sigue siendo la fuente humana editada a mano, o el
estado declarado de cada satélite migra a Prisma y `SATELLITES.md` se
vuelve una vista generada?**

`docs/SOURCE_OF_TRUTH.md` establece como precedencia de datos
`packages/db/prisma/schema.prisma + migrations > SQL o modelos legacy`
(línea 75) — un servicio de producción leyendo y comparando contra un
archivo markdown suelto en la raíz del repo (Ruta A de §7) es
arquitectónicamente atípico frente a ese principio, y exige empaquetar el
archivo en la imagen Docker del API o exponerlo por algún canal interno. La
Ruta B (migrar el estado declarado a una tabla, generar `SATELLITES.md`
como vista) es más coherente con `SOURCE_OF_TRUTH.md` pero cambia el flujo
operativo que `SAT-000 §3` ya documenta ("`SATELLITES.md` es la fuente de
verdad del estado") — y ese flujo lo edita gente a mano en cada PR de
cambio de estado (`SATELLITES.md`, sección "Reglas", ítem 1). Decidir esto
es una llamada de producto/arquitectura sobre cuánta fricción operativa se
acepta a cambio de coherencia con el principio de origen de datos del
repositorio — no algo que este spec pueda resolver unilateralmente.

Mientras esta pregunta siga abierta, el spec permanece en `DRAFT`.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Bloqueo de producto (arriba) resuelto y documentado
- [ ] Sólo entonces `status: VERIFIED`
