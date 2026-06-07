# P7 Civilization Layer — UI Audit y Estrategia de Reutilización
**Fecha:** 2026-05-25  
**Scope:** Auditoría completa de UI existente SEMSE para máxima reutilización en P7  
**Principio rector:** Prometeo emerge de SEMSE — no se construye aparte.

---

## 1. Inventario de UI Existente Reutilizable

### Componentes standalone (`components/`)

| Componente | Propósito actual | Reutilizable para P7 | Clasificación |
|------------|-----------------|----------------------|---------------|
| `ObserverPanel.tsx` | Snapshot infra/ops/intel | **Extiende** con sección `behavioralHealth` | EXTENDABLE |
| `RecommendationsPanel.tsx` | Lista recomendaciones MCA con draft PR | **Reutilizar directo** para "MCA Advice" en governance | READY_TO_REUSE |
| `SimulationPanel.tsx` | Simula patches con impacto | Panel de simulación de propuestas governance | EXTENDABLE |
| `CrowdDecisionBadge.tsx` | Badge de decisión escrow | **Patrón exacto** para `GovernanceTierBadge` | READY_TO_REUSE |
| `BuildOpsProjectHealthPanel.tsx` | Health de proyecto con ring+signals | **Patrón** para `ReputationHealthPanel` | READY_TO_REUSE |
| `MilestoneGovernancePanel.tsx` | Governance de pago por milestone | **Patrón** para propuestas DAO — misma estructura risk/blocker | READY_TO_REUSE |
| `EvidenceReviewAdminCard.tsx` | Card de revisión con status | **Patrón** para ProposalCard con voting | EXTENDABLE |
| `NotificationBell.tsx` | Bell SSE | Sin cambio — reutilizar para alertas governance | READY_TO_REUSE |
| `WorkerEvidenceSummary.tsx` | Resumen de evidencia del worker | **Patrón** para `CitizenContributionSummary` | EXTENDABLE |

### Primitivos UI (`components/ui/`)

| Primitivo | Estado | Uso en P7 |
|-----------|--------|-----------|
| `Badge` (variant: success/info/warn/error/brand) | ✅ Listo | `GovernanceTierBadge` — mapear observer→default, participant→info, contributor→brand, steward→success |
| `Card` / `MetricCard` | ✅ Listo | Todas las cards de P7 |
| `button.tsx` | ✅ Listo | Botones vote/propose |
| `skeleton.tsx` | ✅ Listo | Loading states |
| `empty-state.tsx` | ✅ Listo | Estado vacío sin propuestas |
| `error-state.tsx` | ✅ Listo | Error handling |

### Páginas admin existentes reutilizables

| Página | Reutilizable para | Cambio mínimo |
|--------|-------------------|---------------|
| `/admin/trust` | Trust Passport viewer | Agregar sección "Credencial Portable" con token + DID |
| `/admin/consciousness` | Ya tiene MODULE_REGISTRY + maturity | Agregar P1-P5 al MODULE_REGISTRY del backend |
| `/admin/ecosystem` | `MetricCard` + `RingProgress` + `FlowDiagram` | **Patrón** para Governance Dashboard — copiar MetricCard/Ring |
| `/admin/mission-control` | `OperationalSignal` feed pattern | **Patrón** para Governance Feed — misma estructura de items scrollables |
| `/admin/semse-x` | `GlowDot` + live feed + layer system | **Patrón visual** para Social Coordination Graph |
| `/admin/ops` | Observer + signals | Agregar tab "Behavioral" reutilizando ObserverPanel |

### Patrones visuales identificados

| Patrón | Usado en | Reutilizar en P7 |
|--------|----------|-----------------|
| `ScoreRing` SVG | ObserverPanel, ecosystem, consciousness | Trust Passport score, Governance score, Behavioral score |
| `AlertRow` expandible | ObserverPanel | GovernanceAlert, ProposalRisk |
| `MetricCard` (icon + number + sub) | ecosystem | GovernanceCreditsCard, ReputationCard |
| `RiskGroup` colapsable por severity | consciousness | ProposalRisk breakdown |
| `RecCard` expandible con PR draft | RecommendationsPanel | MCAAdviceCard para propuestas |
| `FlowDiagram` (steps + arrows) | ecosystem | Governance lifecycle: Propose→Vote→Close→Execute |
| `GlowDot` + ping animation | semse-x | Online indicators en Social Coordination Graph |
| Progress bar horizontal | trust, consciousness | VotingProgressBar (for/against/abstain) |

---

## 2. Clasificación de Reutilización por Feature P7

### A. MCA Dashboard Público (Behavioral Health)

**Reuse %: 85%**

`ObserverPanel.tsx` ya tiene exactamente la estructura necesaria:
- `ScoreRing` → reutilizar para `behavioralScore`
- `AlertRow` → reutilizar para `BehavioralAlert` (trustRisk.critical, disputeSurge, etc.)
- Sección de stats cards → reutilizar para `users.verification`, `governance.openDisputes`, `market.activeJobs`

**Cambio mínimo necesario:**
1. Agregar `behavioralHealth?: BehavioralHealth` al tipo `ObserverSnap`
2. Agregar una sección collapsable al final del panel con 3 sub-cards:
   - Users (trust risk distribution)
   - Governance (dispute rate, surge)
   - Market (active, stale, completed)
3. La sección `alerts` ya existe — solo mapear `BehavioralAlert[]` al `Alert[]` existente

**Estimación: 2–3 horas** (extensión, no reescritura)

---

### B. Governance Feed (Propuestas vivas)

**Reuse %: 70%**

El patrón de `/admin/mission-control` ya tiene:
- Lista scrollable de `OperationalSignal` con severity colores
- Expandir/contraer por tipo
- Header con contadores

`RecommendationsPanel.tsx` ya tiene:
- `RecCard` con area, action, rationale, expand/collapse
- `PriorityBadge` (P1, P2...)

**Cambio mínimo:**
Crear `/admin/governance/page.tsx` usando:
- El mismo patrón fetch+display de mission-control
- Cards de propuesta inspiradas en `RecCard` pero con datos `GovernanceProposal`
- Una VotingProgressBar (nueva — 30 líneas) reutilizando el progress bar de trust page
- `MCAAdviceCard` = `AlertRow` con color basado en `mcaRisk`
- Botón "Votar" reutilizando patrón de `button.tsx`

**Estimación: 5–7 horas** (página nueva + ~3 componentes mínimos)

---

### C. Trust Passport UX (Credencial Portable)

**Reuse %: 60%**

`/admin/trust/page.tsx` ya existe con:
- `ScoreBar` horizontal — reutilizar para reputation signals
- Filtros de nivel — reutilizar concepto para tier filter
- Cards de entries

**Cambio mínimo:**
Agregar una sección en `/admin/trust/page.tsx` o en `/admin/users/page.tsx`:
- Card "Mi Credencial" con token display (monospace truncado) + copy button
- `ScoreRing` con el score del passport
- Tier badge usando `Badge` component (already perfect)
- Contributions table (6 filas: jobs, milestones, evidence, disputeRate, avgRating, totalRatings)
- Expiry countdown

**Estimación: 3–4 horas** (extensión de trust page existente)

---

### D. Governance Credits Badge/Tiers

**Reuse %: 95%**

`CrowdDecisionBadge.tsx` es **exactamente** el patrón:
- Badge inline con icon + label + sub-info
- Colores por estado
- Fetch de endpoint

Nuevo componente `GovernanceTierBadge.tsx`:
```
observer   → Badge variant="default"   icon=Eye
participant → Badge variant="info"      icon=Users
contributor → Badge variant="brand"     icon=Star
steward     → Badge variant="success"   icon=Shield
```
Usar `Badge` primitivo existente. 20 líneas de código.

**Estimación: 1 hora** (nuevo componente trivial)

---

### E. Behavioral Health Visualization

**Reuse %: 80%** (incluido en A)

Los 3 sub-paneles de `BehavioralHealth` mapean directamente a:
- `users` → igual que infra items en ObserverPanel (lista de métricas con color)
- `governance` → igual que `operationalHealth` en ObserverPanel
- `market` → igual que `intelligenceHealth` (stats cards 2×2)
- `alerts` → exactamente `Alert[]` con `AlertRow` existente

La única data nueva es `tierDistribution` (reputation tiers) — se visualiza con 4 progress bars horizontales, patrón de consciousness page.

---

### F. Citizen Profile (DID + Passport)

**Reuse %: 50%**

No existe una "página de perfil de usuario" dedicada aún. Opciones:
1. Extender `/admin/users/page.tsx` — agregar modal/drawer por usuario con DID + passport
2. Crear nueva sub-ruta `/admin/users/[id]/page.tsx` — perfil completo

`WorkerEvidenceSummary.tsx` tiene el patrón base: nombre + métricas + summary.

**Estimación: 4–6 horas** (depende de si se hace modal o página)

---

### G. Agent Citizenship

**Reuse %: 40%**

`/admin/agents/page.tsx` ya lista agentes con estado/tipo. Extender con:
- `did:semse:agent-<id>` DID generado para cada agente
- Reputation score del agente (basado en tasks completadas)
- GovernanceTierBadge para cada agente

Requiere: `DID.service` extendido para emitir DIDs para agentes, no solo usuarios.  
**Estimación: 6–8 horas** (backend + frontend)

---

### H. Social Coordination Graph

**Reuse %: 20%**

El único patrón visual reutilizable es `GlowDot` de semse-x y los colores del sistema.  
El grafo en sí requiere una librería (D3.js o @react-sigma) o SVG manual.

Esto es el item de mayor esfuerzo y menor urgencia.

**Estimación: 1–2 días** (incluye datos + visualización)  
**Recomendación: No hacer en P7 inicial.** Hacer cuando governance tenga ≥10 propuestas reales.

---

## 3. Overlaps y Consolidaciones Detectadas

### Overlap: "Governance" duplicado en nombre

| Existente | Nueva (P4) | Diferencia |
|-----------|-----------|------------|
| `MilestoneGovernancePanel.tsx` | `GovernanceService` | Escrow/payment governance vs DAO voting |
| `/api/semse/milestones/[id]/payment-governance` | `/v1/governance/proposals` | Completamente distinto |
| `Payment Governance` en MODULE_REGISTRY | No registrado | P4 no existe en consciousness |

**Acción:** No consolidar — son sistemas distintos. Pero renombrar P4 visualmente como "DAO Governance" o "Prometeo Governance" para evitar confusión.

### Overlap: Trust / Trust Passport / Risk Scoring

| Existente | Nueva (P1) | Diferencia |
|-----------|-----------|------------|
| `TrustService.byJob()` | `TrustPassportService.issue()` | Por job/project vs por usuario portable |
| `/admin/trust` page | Extensión propuesta | Mismo espacio — extender, no duplicar |
| `/api/semse/ops/trust-overview` BFF | Sin BFF nuevo | Agregar `trust-passport` endpoint aquí |

**Acción:** Extender `/admin/trust` con tab "Pasaporte" en vez de crear nueva página.

### Overlap: Observer / Behavioral

| Existente | Nueva (P3) | Diferencia |
|-----------|-----------|------------|
| `ObserverPanel.tsx` — técnico | `BehavioralHealth` — humano | Complementarios, no duplicados |
| `/api/semse/ops/observer/snapshot` | `/v1/ops/behavioral` | Diferente endpoint |

**Acción:** Integrar `behavioralHealth` como sección dentro de `ObserverPanel` existente. Un observer completo.

### Consolidar MODULE_REGISTRY

`consciousness.service.ts` tiene 23 módulos. P1-P5 deberían ser 5 módulos nuevos:

```typescript
{ name: "Trust Passport",     hasBackend: true, hasFrontend: false, hasTests: true, ... }
{ name: "DID Identity",       hasBackend: true, hasFrontend: false, hasTests: true, ... }
{ name: "Behavioral Observer",hasBackend: true, hasFrontend: false, hasTests: true, ... }
{ name: "DAO Governance",     hasBackend: true, hasFrontend: false, hasTests: true, ... }
{ name: "Gov Credits",        hasBackend: true, hasFrontend: false, hasTests: true, ... }
```

Esto es 10 líneas de código con impacto inmediato en el `ConsciousnessIndex.maturity.globalScore`.

---

## 4. Propuesta Arquitectura Visual P7

### Estructura de páginas recomendada (mínima)

```
/admin/
├── trust/          ← Extender existente (tab: Trust Scores | Trust Passport | DID)
├── consciousness/  ← Sin cambio página, solo backend MODULE_REGISTRY
├── ops/            ← Extender existente (tab: Observer | Behavioral | Recommendations)
└── governance/     ← Nueva página (propuestas, votación, resultados, créditos)
    └── [id]/       ← Detalle de propuesta con tally en tiempo real
```

**No crear:**
- `/admin/did/` — integrar en `/admin/trust/`
- `/admin/behavioral/` — integrar en `/admin/ops/`
- `/admin/credits/` — integrar en `/admin/trust/` o `/admin/governance/`
- `/admin/network/` — posponer (Social Coordination Graph)

### Nuevos componentes a crear (mínimos)

| Componente | Líneas est. | Reutiliza |
|------------|------------|-----------|
| `GovernanceTierBadge.tsx` | ~25 | Badge primitivo |
| `VotingProgressBar.tsx` | ~40 | Progress bar pattern de trust page |
| `ProposalCard.tsx` | ~80 | RecCard + AlertRow patterns |
| `TrustPassportCard.tsx` | ~60 | ScoreRing + MetricCard |
| `BehavioralHealthSection.tsx` | ~100 | AlertRow + MetricCard patterns |

**Total componentes nuevos:** 5 componentes, ~305 líneas

### Nuevas BFF routes a crear (mínimas)

| Route | Proxies a |
|-------|-----------|
| `/api/semse/ops/behavioral` | `GET /v1/ops/behavioral` |
| `/api/semse/governance/proposals` | `GET/POST /v1/governance/proposals` |
| `/api/semse/governance/proposals/[id]/vote` | `POST /v1/governance/proposals/:id/vote` |
| `/api/semse/governance/proposals/[id]/results` | `GET /v1/governance/proposals/:id/results` |
| `/api/semse/governance/credits/[userId]` | `GET /v1/governance/credits/:userId` |
| `/api/semse/trust/[userId]/passport` | `GET /v1/users/:userId/trust-passport` |
| `/api/semse/did/[userId]` | `GET /v1/did/:userId` |

**Total BFF routes:** 7 (cada una ~15 líneas — patrón estándar de `fetchSemseDataForRequest`)

---

## 5. Priorización Real — Impacto / Esfuerzo

### Quick Wins (1–3h)

| # | Feature | Horas | Componentes | Reutilización |
|---|---------|-------|-------------|---------------|
| 1 | MODULE_REGISTRY + 5 módulos P1-P5 | 0.5h | 0 nuevos | consciousness.service.ts — 10 líneas |
| 2 | `GovernanceTierBadge` | 1h | 1 nuevo (25 líneas) | Badge primitivo |
| 3 | BFF routes governance (7) | 2h | 0 nuevos | Patrón estándar existente |

### Medium Wins (4–8h)

| # | Feature | Horas | Componentes | Reutilización |
|---|---------|-------|-------------|---------------|
| 4 | ObserverPanel + `BehavioralHealthSection` | 3h | 1 nuevo (100 líneas) | ObserverPanel extendido |
| 5 | Trust page + `TrustPassportCard` tab | 3h | 1 nuevo (60 líneas) | trust/page.tsx extendida |
| 6 | `/admin/governance/page.tsx` | 6h | 2 nuevos (120 líneas) | RecCard + AlertRow patterns |

### Large Work (>1 día)

| # | Feature | Horas | Componentes | Notas |
|---|---------|-------|-------------|-------|
| 7 | Citizen Profile page | 6–8h | 2 nuevos | Modal o sub-ruta |
| 8 | Agent Citizenship | 8–10h | Backend + frontend | Requiere DID service extension |
| 9 | Social Coordination Graph | 16h+ | Librería grafo | Posponer hasta datos reales |

---

## 6. Resultado Final

### A. Tabla completa

| Feature | Existing UI | Reuse % | Work Needed | Priority |
|---------|-------------|---------|-------------|----------|
| MODULE_REGISTRY P1-P5 | consciousness.service.ts | 100% | 10 líneas backend | P0 — 30 min |
| Behavioral Health | ObserverPanel.tsx | 85% | Agregar 1 sección | P1 — 3h |
| Gov Credits Badge | Badge + CrowdDecisionBadge | 95% | 1 componente nuevo | P1 — 1h |
| Trust Passport UX | /admin/trust + ScoreRing | 60% | Extender página + 1 componente | P2 — 3h |
| DID Display | /admin/trust tab | 70% | Tab en trust page | P2 — 1h |
| Governance Feed | mission-control + RecCard | 70% | 1 página nueva + 2 componentes | P2 — 6h |
| BFF Routes x7 | fetchSemseDataForRequest pattern | 95% | 7 route files | P1 — 2h |
| Citizen Profile | users page + WorkerSummary | 50% | Modal o sub-ruta | P3 — 6h |
| Agent Citizenship | agents page + did.service | 40% | Backend + UI | P4 — 8h |
| Social Graph | GlowDot solamente | 20% | Librería grafo | P5 — posponer |

### B. Arquitectura visual recomendada

```
Páginas que existen y se extienden:
  /admin/trust          → + tab "Pasaporte" (TrustPassportCard + DID)
  /admin/ops            → + tab "Behavioral" (BehavioralHealthSection en ObserverPanel)
  /admin/consciousness  → sin cambio página (solo backend MODULE_REGISTRY)
  /admin/agents         → + GovernanceTierBadge por agente (P4)

Páginas nuevas mínimas:
  /admin/governance     → Feed de propuestas + voting + resultados + créditos

Páginas que NO se crean (contra-recomendación):
  /admin/did            → integrar en trust
  /admin/behavioral     → integrar en ops
  /admin/credits        → integrar en governance o trust
  /admin/network        → posponer
```

### C. Roadmap Frontend P7 — Orden exacto

```
Sprint 1 (3h total) — Invisible pero importante:
  1. MODULE_REGISTRY update backend (0.5h)
  2. BFF routes x7 (2h)
  3. GovernanceTierBadge componente (0.5h)

Sprint 2 (6h total) — Lo que hace "vivo" el sistema:
  4. BehavioralHealthSection + ObserverPanel extension (3h)
  5. TrustPassportCard + tab en /admin/trust (3h)

Sprint 3 (7h total) — Hace governance tangible:
  6. /admin/governance page con ProposalCard + VotingProgressBar (6h)
  7. GovernanceTierBadge en /admin/trust (1h)

Sprint 4 (8h+) — Completa el ciudadano:
  8. Citizen Profile /admin/users/[id] (6-8h)
  9. Agent Citizenship (posponer o reducir scope)
```

### D. Estimación total

| Sprint | Horas | Resultado visible |
|--------|-------|------------------|
| 1 | 3h | Consciousness maturity sube ~10 puntos. BFFs listos. |
| 2 | 6h | Observer muestra salud humana. Trust muestra pasaporte. |
| 3 | 7h | Governance es visible y votable. |
| 4 | 8h | Perfil de ciudadano Prometeo completo. |
| **Total** | **~24h** | **Prometeo visible y gobernable.** |

**Complejidad:** Media — todo reutiliza patrones existentes.  
**Riesgo:** Bajo — no hay cambios de schema ni dependencias nuevas.  
**Bloqueador previo:** Primero push + merge + `prisma migrate deploy`.

---

## Conclusión

El 75% de P7 ya existe como patrones de código en SEMSE. Lo que falta no es arquitectura nueva — es conectar los datos de P1-P6 a los componentes que ya saben cómo visualizar alertas, scores, feeds y badges.

El camino más rápido para que "Prometeo se sienta vivo":
1. MODULE_REGISTRY (30 min) — consciousness reconoce la nueva capa
2. BehavioralHealthSection en ObserverPanel (3h) — el primer espejo social
3. Governance page (6h) — la gobernanza es tangible
4. Trust Passport tab (3h) — la identidad es visible

Total para impacto máximo visible: **~12h de trabajo frontend real.**
