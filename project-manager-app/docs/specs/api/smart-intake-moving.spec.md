---
id: "api-smart-intake-moving"
title: "Smart Intake Moving Category"
domain: "smart-intake"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "low"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/smart-intake/config/category-registry.ts"
  - "apps/api/src/modules/smart-intake/config/questions/moving.questions.ts"
  - "apps/api/src/modules/smart-intake/config/scoring-profiles.ts"
  - "apps/api/src/modules/smart-intake/smart-intake.logic.ts"
  - "apps/api/src/modules/smart-intake/smart-intake.types.ts"
  - "apps/web/components/landing/landing-intake.tsx"
  - "apps/web/lib/job-intake.ts"
related_tests:
  - "apps/api/test/smart-intake-category-detection.test.ts"
  - "apps/api/test/smart-intake-estimate.test.ts"
  - "apps/api/test/smart-intake-scoring.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "NOT_VERIFIED"
---

# Smart Intake — Moving

> SDD 2.0 incremental spec. Existing Smart Intake historical API/UI specs retain their former status; this new category is not certified by those old assertions.

## 1. Problema y resultado
Homeowners and renters needing a move (full home, a few large items, loading/unloading help, packing) should receive a guided intake with distance and access awareness instead of being routed to handyman or cleaning. Desired outcome: reliable bilingual detection, relevant questions, and a clearly qualified preliminary estimate with the risk flags below.

## 2. Alcance
**Included:** `moving` category with EN/ES label, routing precedence, four optional questions (type of move, size, distance, and access/special items), scoring profile, estimate size multiplier, risk flags (`long_distance_pricing`, `specialty_handling_required`, `stairs_present`), and landing/catalog entry (`mudanzas`).
**Excluded:** carrier licensing/insurance verification, valuation or damage-claim coverage, inventory management, long-distance carrier quoting, storage, payment or live pricing.

## 3. Actores, permisos, tenant y límites
- Public/anonymous visitor may submit a project description through the existing Smart Intake API; existing anonymous session/resource guards stay mandatory.
- Authenticated client may claim and publish only an owned intake, under existing authorization policy.
- Long-distance and interstate moves are priced and regulated differently from local moves; the flag only signals that this range may not apply.
- Specialty items (piano, safe) may need specialized crews and equipment; the flag never certifies a mover's ability.
- Addresses and inventories are personal data; follow standard PII redaction/access rules.
- Client-facing ranges are estimates, not binding quotes, and do not independently authorize work.

## 4. Escenarios y criterios de aceptación
```gherkin
DADO "Looking for a moving company for a 2 bedroom"
CUANDO se detecta la categoría
ENTONCES `moving` es la categoría resultante
Y se presentan las cuatro preguntas de la categoría
```
```gherkin
DADO "Necesito una mudanza de apartamento este sabado"
CUANDO se analizan palabras claves
ENTONCES `moving` gana según el orden de detección definido
```
```gherkin
DADO una respuesta que activa un aviso de riesgo
CUANDO se califica el intake
ENTONCES el aviso aparece como advertencia por verificar
Y nunca se presenta como conclusión profesional, legal o garantía de resultado
```
- [ ] No regressions en el resto de categorías.
- [ ] Inputs EN/ES, "no estoy seguro", valores OTHER, vacío y typo no generan crashes.

### Limitación conocida
A message mixing a move and cleaning ("mudanza con limpieza") routes by keyword order and may need explicit category selection.

## 5. Contrato API/UI
Reuse existing Smart Intake create/analyze/answer/estimate endpoints and response envelopes; category enum `moving`. Questions `moving_type`, `moving_scope`, `moving_distance`, `moving_access` provide localized labels/options. Explicit selection ids: `mudanza`, `mudanzas`, `moving`. UI handles loading, empty/unknown, invalid answer, degraded estimate and clear risk warnings in ES/EN. No new public endpoint.

## 6. FSM, eventos y derivación de estimados
Continue existing Smart Intake FSM; no special state created. Detection and scoring must be deterministic for the same canonical answers and version. Estimate uses the fixed-rate path with a size multiplier from the scope answer (small 0.6, medium 1.0, large 2.2). Risk flags are warnings pending field evaluation. No unauthorized state transitions or automatic job publication.

## 7. Datos y migración
No Prisma schema migration expected. Existing intakes and historical category IDs remain valid. Verify persisted enum acceptance and backward-compatible UI fallbacks.

## 8. Observabilidad, rollout y rollback
Monitor classification confusion versus neighboring categories, how often each risk flag is raised, question abandonment, estimate outliers and locale errors. Rollback removes the new category in a guarded deployment without corrupting previously persisted `moving` records. No per-category flag is claimed to exist yet.

## 9. Tests requeridos
- [x] Detection of the category's phrases in EN/ES, precedence cases and explicit selection.
- [ ] Neighboring categories keep their own phrases.
- [ ] Scoring critical question threshold, ranges and risk warnings.
- [ ] Size-multiplier bounds.
- [ ] EN/ES wizard, unknown choice, old record, no silent job publishing and unauthorized claim tests.
- [ ] CI exact SHA plus UI/anonymous API smoke.

## 10. Implementación
Category registry/question file/SCORING_PROFILES/logic/types, landing and web catalog. Detection order: after `cleaning`, so "limpieza despues de la mudanza" stays cleaning; keywords are phrases ("moving company", "mudanza", "need movers") because bare "moving" matches inside "removing" and "movers" inside "removers". Existing Smart Intake API spec remains baseline; this file is the increment.

## 11. Investigación externa
Moving rates vary widely by region, season, crew size and hours; the flat range here is a static placeholder and needs market validation. Licensing and insurance requirements for movers vary by jurisdiction.

## 12. Gates
- [ ] Spec reviewed/APPROVED; [ ] coverage for detection/scoring/estimate/locale/policy; [ ] strict spec validation + spec index.
- [ ] CI/build/UI/API smoke green on exact SHA; [ ] category/version and rollback behavior verified.
- [ ] Only claim VERIFIED after merge/deploy/activation and traceable production evidence.
