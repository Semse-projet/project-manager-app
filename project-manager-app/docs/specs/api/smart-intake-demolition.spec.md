---
id: "api-smart-intake-demolition"
title: "Smart Intake Demolition Category"
domain: "smart-intake"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
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
  - "apps/api/src/modules/smart-intake/config/questions/demolition.questions.ts"
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

# Smart Intake — Demolition

> SDD 2.0 incremental spec. Existing Smart Intake historical API/UI specs retain their former status; this new category is not certified by those old assertions.

## 1. Problema y resultado
Homeowners describing demolition or removal work (interior finishes, non-structural walls, concrete, sheds and decks, structural walls) should receive a guided intake with hazard and permit awareness instead of being routed to painting, masonry or carpentry. Desired outcome: reliable bilingual detection, relevant questions, and a clearly qualified preliminary estimate with the risk flags below.

## 2. Alcance
**Included:** `demolition` category with EN/ES label, routing precedence, four optional questions (what is demolished, size, building age, and who handles debris), scoring profile, estimate size multiplier, risk flags (`structural_assessment_required`, `permit_likely_required`, `hazmat_testing_recommended`), and landing/catalog entry (`demolicion`).
**Excluded:** structural-engineering certification, asbestos/lead testing or abatement, permit or code advice, utility disconnection, contractor selection, payment or live pricing.

## 3. Actores, permisos, tenant y límites
- Public/anonymous visitor may submit a project description through the existing Smart Intake API; existing anonymous session/resource guards stay mandatory.
- Authenticated client may claim and publish only an owned intake, under existing authorization policy.
- Removing a possibly load-bearing wall or a whole structure requires professional structural assessment; the flag is a prompt, never an engineering conclusion.
- Pre-1980 buildings may contain asbestos or lead paint; the flag recommends testing and never states that hazardous material is or is not present.
- Utilities (gas, electric, water) must be handled by licensed parties; the intake does not authorize any disconnection.
- Client-facing ranges are estimates, not binding quotes, and do not independently authorize work.

## 4. Escenarios y criterios de aceptación
```gherkin
DADO "Demolition of an old shed in the yard"
CUANDO se detecta la categoría
ENTONCES `demolition` es la categoría resultante
Y se presentan las cuatro preguntas de la categoría
```
```gherkin
DADO "Necesito demoler un muro de concreto"
CUANDO se analizan palabras claves
ENTONCES `demolition` gana según el orden de detección definido
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
A remodel described mainly by its demolition ("gut the kitchen") routes to the remodel category when that room keyword is present; otherwise to demolition.

## 5. Contrato API/UI
Reuse existing Smart Intake create/analyze/answer/estimate endpoints and response envelopes; category enum `demolition`. Questions `demolition_type`, `demolition_scope`, `demolition_age`, `demolition_disposal` provide localized labels/options. Explicit selection ids: `demolicion`, `demolition`. UI handles loading, empty/unknown, invalid answer, degraded estimate and clear risk warnings in ES/EN. No new public endpoint.

## 6. FSM, eventos y derivación de estimados
Continue existing Smart Intake FSM; no special state created. Detection and scoring must be deterministic for the same canonical answers and version. Estimate uses the fixed-rate path with a size multiplier from the scope answer (small 0.5, medium 1.0, large 2.5). Risk flags are warnings pending field evaluation. No unauthorized state transitions or automatic job publication.

## 7. Datos y migración
No Prisma schema migration expected. Existing intakes and historical category IDs remain valid. Verify persisted enum acceptance and backward-compatible UI fallbacks.

## 8. Observabilidad, rollout y rollback
Monitor classification confusion versus neighboring categories, how often each risk flag is raised, question abandonment, estimate outliers and locale errors. Rollback removes the new category in a guarded deployment without corrupting previously persisted `demolition` records. No per-category flag is claimed to exist yet.

## 9. Tests requeridos
- [x] Detection of the category's phrases in EN/ES, precedence cases and explicit selection.
- [ ] Neighboring categories keep their own phrases.
- [ ] Scoring critical question threshold, ranges and risk warnings.
- [ ] Size-multiplier bounds.
- [ ] EN/ES wizard, unknown choice, old record, no silent job publishing and unauthorized claim tests.
- [ ] CI exact SHA plus UI/anonymous API smoke.

## 10. Implementación
Category registry/question file/SCORING_PROFILES/logic/types, landing and web catalog. Detection order: before `exterior_painting` and `masonry_concrete`, after `pressure_washing`, so "demoler un muro de concreto" is demolition rather than masonry and "tear down a wall" is not absorbed by painting's "wall"; bathroom and kitchen remodels keep precedence over demolition wording. Existing Smart Intake API spec remains baseline; this file is the increment.

## 11. Investigación externa
Permit, asbestos/lead testing and structural rules vary by jurisdiction and age of building; flags are advisory. Demolition pricing depends heavily on disposal fees, access and hazardous-material findings and needs market validation.

## 12. Gates
- [ ] Spec reviewed/APPROVED; [ ] coverage for detection/scoring/estimate/locale/policy; [ ] strict spec validation + spec index.
- [ ] CI/build/UI/API smoke green on exact SHA; [ ] category/version and rollback behavior verified.
- [ ] Only claim VERIFIED after merge/deploy/activation and traceable production evidence.
