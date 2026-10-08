---
id: "api-smart-intake-handyman"
title: "Smart Intake Handyman Category"
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
  - "apps/api/src/modules/smart-intake/config/questions/handyman.questions.ts"
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

# Smart Intake — Handyman

> SDD 2.0 incremental spec. Existing Smart Intake historical API/UI specs retain their former status; this new category is not certified by those old assertions.

## 1. Problema y resultado
Homeowners with small mixed jobs (assembling furniture, mounting a TV or shelves, minor repairs, a list of odd jobs) should receive a guided intake instead of being forced into a single-trade category. Desired outcome: reliable bilingual detection as a **fallback after every specific trade**, relevant questions, and a clearly qualified preliminary estimate.

## 2. Alcance
**Included:** `handyman` category with EN/ES label, lowest-priority routing precedence, four optional questions (type of tasks, amount of work, materials supply, access/urgency), scoring profile, estimate size multiplier, a `licensed_trade_possible` risk flag, and landing/catalog entry (`handyman`).
**Excluded:** performing or approving licensed electrical, gas or plumbing work, structural work, permit advice, contractor selection, payment or live pricing.

## 3. Actores, permisos, tenant y límites
- Public/anonymous visitor may submit a project description through the existing Smart Intake API; existing anonymous session/resource guards stay mandatory.
- Authenticated client may claim and publish only an owned intake, under existing authorization policy.
- A handyman job that turns out to need licensed work (electrical panel, gas, plumbing rough-in) must be flagged for a licensed professional, never silently scoped as handyman.
- Free text and photos may expose a home interior; follow standard PII redaction/access rules.
- Client-facing ranges are estimates, not binding quotes, and do not independently authorize work.

## 4. Escenarios y criterios de aceptación
```gherkin
DADO "need someone to mount a TV and assemble a dresser"
CUANDO se detecta la categoría
ENTONCES `handyman` es la categoría resultante
Y se presentan preguntas de tipo, cantidad de trabajo, materiales y acceso
```
```gherkin
DADO "fuga en la tubería del patio"
CUANDO se analizan palabras claves
ENTONCES `plumbing_repair` gana; `handyman` nunca roba oficios específicos
```
```gherkin
DADO que el cliente marca trabajo que podría requerir licencia
CUANDO se califica el intake
ENTONCES `licensed_trade_possible` aparece como aviso por verificar
Y nunca se presenta como confirmación de que se necesita o no licencia
```
- [ ] No regressions en carpintería, techos, A/C, cercas/decks, paisajismo y el resto de categorías.
- [ ] Inputs EN/ES, "no estoy seguro", valores OTHER, vacío y typo no generan crashes.
- [ ] `handyman` se evalúa al final de `DETECTION_ORDER`, después de `general_carpentry`.

## 5. Contrato API/UI
Reuse existing Smart Intake create/analyze/answer/estimate endpoints and response envelopes; category enum `handyman`. Questions `handyman_type`, `handyman_scope`, `handyman_materials`, `handyman_access` provide localized labels/options. Explicit selection ids: `handyman`, `manitas`, `mantenimiento`. UI handles loading, empty/unknown, invalid answer, degraded estimate and clear risk warnings in ES/EN. No new public endpoint.

## 6. FSM, eventos y derivación de estimados
Continue existing Smart Intake FSM; no special state created. Detection and scoring must be deterministic for the same canonical answers and version. Estimate uses the fixed-rate path with a size multiplier from `handyman_scope` (small 0.5, medium 1.0, large 2.0). Risk flags are warnings pending field evaluation. No unauthorized state transitions or automatic job publication.

## 7. Datos y migración
No Prisma schema migration expected. Existing intakes and historical category IDs remain valid. Verify persisted enum acceptance and backward-compatible UI fallbacks.

## 8. Observabilidad, rollout y rollback
Monitor classification confusion versus specific trades, how often `licensed_trade_possible` is raised, question abandonment, estimate outliers and locale errors. Rollback removes the new category in a guarded deployment without corrupting previously persisted `handyman` records. No per-category flag is claimed to exist yet.

## 9. Tests requeridos
- [ ] Detection of handyman phrases in EN/ES and explicit selection.
- [ ] Specific trades keep precedence over handyman (plumbing, electrical, carpentry, painting).
- [ ] Scoring critical question threshold, ranges and the licensed-trade warning.
- [ ] Size-multiplier bounds.
- [ ] EN/ES wizard, unknown choice, old record, no silent job publishing and unauthorized claim tests.
- [ ] CI exact SHA plus UI/anonymous API smoke.

## 10. Implementación
Category registry/question file/SCORING_PROFILES/logic/types, landing and web catalog. Existing Smart Intake API spec remains baseline; this file is the increment.

## 11. Investigación externa
Licensing thresholds for electrical, plumbing and gas work vary by jurisdiction; the flag is advisory and requires verified local rules. Hourly and per-task handyman rates vary widely by market and need validation, not solely static multipliers.

## 12. Gates
- [ ] Spec reviewed/APPROVED; [ ] coverage for detection/scoring/estimate/locale/policy; [ ] strict spec validation + spec index.
- [ ] CI/build/UI/API smoke green on exact SHA; [ ] category/version and rollback behavior verified.
- [ ] Only claim VERIFIED after merge/deploy/activation and traceable production evidence.
