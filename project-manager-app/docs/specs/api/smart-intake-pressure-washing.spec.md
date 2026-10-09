---
id: "api-smart-intake-pressure-washing"
title: "Smart Intake Pressure Washing Category"
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
  - "apps/api/src/modules/smart-intake/config/questions/pressure-washing.questions.ts"
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

# Smart Intake — Pressure Washing

> SDD 2.0 incremental spec. Existing Smart Intake historical API/UI specs retain their former status; this new category is not certified by those old assertions.

## 1. Problema y resultado
Homeowners asking for pressure or power washing (driveways, siding, decks, roofs) should receive a guided intake with surface-damage awareness instead of being routed to exterior painting, cleaning or masonry. Desired outcome: reliable bilingual detection, relevant questions, and a clearly qualified preliminary estimate with the risk flags below.

## 2. Alcance
**Included:** `pressure_washing` category with EN/ES label, routing precedence, four optional questions (surface, area size, dirt level, and water/power availability), scoring profile, estimate size multiplier, risk flags (`roof_soft_wash_required`, `stain_removal_uncertain`, `water_source_needed`), and landing/catalog entry (`lavado_presion`).
**Excluded:** chemical or environmental compliance advice, wastewater discharge rules, roof warranty guidance, contractor selection, payment or live pricing.

## 3. Actores, permisos, tenant y límites
- Public/anonymous visitor may submit a project description through the existing Smart Intake API; existing anonymous session/resource guards stay mandatory.
- Authenticated client may claim and publish only an owned intake, under existing authorization policy.
- High pressure can damage roofs, wood and some siding; the roof flag indicates a soft-wash method may be required, not that a specific method is approved.
- Oil, rust and graffiti stains may not come out completely; the flag sets expectations and never guarantees a result.
- Photos of the property may expose the home; follow standard PII redaction/access rules.
- Client-facing ranges are estimates, not binding quotes, and do not independently authorize work.

## 4. Escenarios y criterios de aceptación
```gherkin
DADO "Pressure wash the exterior of my house"
CUANDO se detecta la categoría
ENTONCES `pressure_washing` es la categoría resultante
Y se presentan las cuatro preguntas de la categoría
```
```gherkin
DADO "Lavado a presión de la fachada"
CUANDO se analizan palabras claves
ENTONCES `pressure_washing` gana según el orden de detección definido
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
"Pressure wash then paint the exterior" classifies as pressure washing; the painting can be raised as a follow-up job.

## 5. Contrato API/UI
Reuse existing Smart Intake create/analyze/answer/estimate endpoints and response envelopes; category enum `pressure_washing`. Questions `pw_surface`, `pw_scope`, `pw_condition`, `pw_water` provide localized labels/options. Explicit selection ids: `lavado`, `lavado_presion`, `pressure_washing`, `hidrolavado`. UI handles loading, empty/unknown, invalid answer, degraded estimate and clear risk warnings in ES/EN. No new public endpoint.

## 6. FSM, eventos y derivación de estimados
Continue existing Smart Intake FSM; no special state created. Detection and scoring must be deterministic for the same canonical answers and version. Estimate uses the fixed-rate path with a size multiplier from the scope answer (small 0.5, medium 1.0, large 2.2). Risk flags are warnings pending field evaluation. No unauthorized state transitions or automatic job publication.

## 7. Datos y migración
No Prisma schema migration expected. Existing intakes and historical category IDs remain valid. Verify persisted enum acceptance and backward-compatible UI fallbacks.

## 8. Observabilidad, rollout y rollback
Monitor classification confusion versus neighboring categories, how often each risk flag is raised, question abandonment, estimate outliers and locale errors. Rollback removes the new category in a guarded deployment without corrupting previously persisted `pressure_washing` records. No per-category flag is claimed to exist yet.

## 9. Tests requeridos
- [x] Detection of the category's phrases in EN/ES, precedence cases and explicit selection.
- [ ] Neighboring categories keep their own phrases.
- [ ] Scoring critical question threshold, ranges and risk warnings.
- [ ] Size-multiplier bounds.
- [ ] EN/ES wizard, unknown choice, old record, no silent job publishing and unauthorized claim tests.
- [ ] CI exact SHA plus UI/anonymous API smoke.

## 10. Implementación
Category registry/question file/SCORING_PROFILES/logic/types, landing and web catalog. Detection order: first among the new categories, before `demolition`, `exterior_painting` and `cleaning`, so "pressure wash the exterior" is not absorbed by exterior painting's "exterior" keyword and "power washing my concrete driveway" is not routed to masonry. Existing Smart Intake API spec remains baseline; this file is the increment.

## 11. Investigación externa
Wastewater, detergent and runoff rules vary by municipality. Pressure-washing pricing is usually per square foot or per job and varies by market; the static range needs validation.

## 12. Gates
- [ ] Spec reviewed/APPROVED; [ ] coverage for detection/scoring/estimate/locale/policy; [ ] strict spec validation + spec index.
- [ ] CI/build/UI/API smoke green on exact SHA; [ ] category/version and rollback behavior verified.
- [ ] Only claim VERIFIED after merge/deploy/activation and traceable production evidence.
