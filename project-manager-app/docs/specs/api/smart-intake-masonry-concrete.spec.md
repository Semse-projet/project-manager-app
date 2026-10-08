---
id: "api-smart-intake-masonry-concrete"
title: "Smart Intake Masonry and Concrete Category"
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
  - "apps/api/src/modules/smart-intake/config/questions/masonry-concrete.questions.ts"
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

# Smart Intake — Masonry and Concrete

> SDD 2.0 incremental spec. Existing Smart Intake historical API/UI specs retain their former status; this new category is not certified by those old assertions.

## 1. Problema y resultado
Homeowners describing concrete slabs, driveways, sidewalks, brick or block walls, pavers, retaining walls and chimneys should receive a guided intake instead of being routed to painting or generic carpentry. Desired outcome: reliable bilingual detection, relevant questions, and a clearly qualified preliminary estimate with structural and demolition risk flags.

## 2. Alcance
**Included:** `masonry_concrete` category with EN/ES label, routing precedence, four optional questions (type of work, job size, site condition, truck/equipment access), scoring profile, estimate size multiplier, risk flags (`engineering_review_likely`, `demolition_required`, `special_equipment_required`), and landing/catalog entry (`albanileria`).
**Excluded:** structural-engineering certification, permit or code advice, soil/geotechnical assessment, contractor selection, payment or live material pricing.

## 3. Actores, permisos, tenant y límites
- Public/anonymous visitor may submit a project description through the existing Smart Intake API; existing anonymous session/resource guards stay mandatory.
- Authenticated client may claim and publish only an owned intake, under existing authorization policy.
- Retaining walls, foundations and chimneys are structural: the flag is a prompt for professional review, never an engineering conclusion or a permit determination.
- Free text and photos may expose the property layout; follow standard PII redaction/access rules.
- Client-facing ranges are estimates, not binding quotes, and do not independently authorize work.

## 4. Escenarios y criterios de aceptación
```gherkin
DADO "I want to pour a new concrete driveway"
CUANDO se detecta la categoría
ENTONCES `masonry_concrete` es la categoría resultante
Y se presentan preguntas de tipo, tamaño, estado del sitio y acceso
```
```gherkin
DADO "Build a retaining wall in the backyard"
CUANDO se analizan palabras claves
ENTONCES `masonry_concrete` gana antes de `interior_painting` (cuya palabra "wall" lo absorbería)
```
```gherkin
DADO que el cliente marca muro de contención, cimentación o chimenea
CUANDO se califica el intake
ENTONCES `engineering_review_likely` aparece como aviso por verificar
Y nunca se presenta como conclusión de ingeniería ni como permiso
```
- [ ] No regressions en pintura, drywall, pisos, cocina, baño, carpintería y el resto.
- [ ] Inputs EN/ES, "no estoy seguro", valores OTHER, vacío y typo no generan crashes.
- [ ] La keyword "losa" NO se usa (en algunos países significa baldosa y chocaría con pisos).

### Limitación conocida
`masonry_concrete` se evalúa antes de `interior_painting`, por lo que una descripción como "pintar un muro de concreto" se clasifica como albañilería aunque sea un trabajo de pintura. El cliente puede corregirlo con la selección explícita de categoría. Mitigación futura: detección sensible a verbos de acción.

## 5. Contrato API/UI
Reuse existing Smart Intake create/analyze/answer/estimate endpoints and response envelopes; category enum `masonry_concrete`. Questions `masonry_type`, `masonry_scope`, `masonry_condition`, `masonry_access` provide localized labels/options. Explicit selection ids: `albanileria`, `masonry`, `concreto`, `concrete`. UI handles loading, empty/unknown, invalid answer, degraded estimate and clear risk warnings in ES/EN. No new public endpoint.

## 6. FSM, eventos y derivación de estimados
Continue existing Smart Intake FSM; no special state created. Detection and scoring must be deterministic for the same canonical answers and version. Estimate uses the fixed-rate path with a size multiplier from `masonry_scope` (small 0.5, medium 1.0, large 2.5). Risk flags are warnings pending field evaluation. No unauthorized state transitions or automatic job publication.

## 7. Datos y migración
No Prisma schema migration expected. Existing intakes and historical category IDs remain valid. Verify persisted enum acceptance and backward-compatible UI fallbacks.

## 8. Observabilidad, rollout y rollback
Monitor classification confusion versus painting (see known limitation), how often structural/demolition flags are raised, question abandonment, estimate outliers and locale errors. Rollback removes the new category in a guarded deployment without corrupting previously persisted `masonry_concrete` records. No per-category flag is claimed to exist yet.

## 9. Tests requeridos
- [x] Detection of concrete/brick/retaining-wall phrases in EN/ES and explicit selection.
- [ ] Painting, flooring and drywall keep precedence for their own phrases.
- [ ] Scoring critical question threshold, ranges and structural/demolition/pump warnings.
- [ ] Size-multiplier bounds.
- [ ] EN/ES wizard, unknown choice, old record, no silent job publishing and unauthorized claim tests.
- [ ] CI exact SHA plus UI/anonymous API smoke.

## 10. Implementación
Category registry/question file/SCORING_PROFILES/logic/types, landing and web catalog. Existing Smart Intake API spec remains baseline; this file is the increment.

## 11. Investigación externa
Structural thresholds for retaining walls (height, surcharge), foundation work and chimney repair vary by jurisdiction and require licensed review; flags are advisory. Concrete and masonry pricing varies widely by market, access and season and needs validation, not solely static multipliers.

## 12. Gates
- [ ] Spec reviewed/APPROVED; [ ] coverage for detection/scoring/estimate/locale/policy; [ ] strict spec validation + spec index.
- [ ] CI/build/UI/API smoke green on exact SHA; [ ] category/version and rollback behavior verified.
- [ ] Only claim VERIFIED after merge/deploy/activation and traceable production evidence.
