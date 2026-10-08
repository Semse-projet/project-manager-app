---
id: "api-smart-intake-fencing-decks"
title: "Smart Intake Fencing and Decks Category"
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
  - "apps/api/src/modules/smart-intake/config/questions/fencing-decks.questions.ts"
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

# Smart Intake — Fencing and Decks

> SDD 2.0 incremental spec for PR #822. Existing Smart Intake historical API/UI specs retain their former status; this new category is not certified by those old assertions.

## 1. Problema y resultado
Homeowners describing fences, decks, pergolas and railings should receive the correct guided intake rather than being incorrectly routed to generic carpentry. Desired outcome: reliable bilingual category detection, relevant questions, and clearly qualified preliminary estimates and risk flags.

## 2. Alcance
**Included:** `fencing_decks` category with EN/ES label, routing precedence, four optional questions (work type, size, material, terrain/access), scoring profile, estimate size multiplier, risk flags, and landing/catalog entry.
**Excluded:** definitive permitting/legal advice, structural-engineering certification, contractor selection, payment or live material pricing.

## 3. Actores, permisos, tenant y límites
- Public/anonymous visitor may submit project description and non-sensitive construction details through existing Smart Intake API; existing anonymous session/resource guards stay mandatory.
- Authenticated client may claim and publish only owned intake, under existing authorization policy.
- Contractor/agent cannot silently change client responses or assert a building permit has been approved.
- Data about residence/location can be sensitive even if existing older spec treats general project text as non-critical; follow standard PII redaction/access rules for free text and photos.
- Client-facing ranges are estimates, not binding quotes, and do not independently authorize work.

## 4. Escenarios y criterios de aceptación
```gherkin
DADO "build a new deck in my backyard"
CUANDO se detecta la categoría
ENTONCES `fencing_decks` gana antes de `general_carpentry`
Y se presentan preguntas de tipo, tamaño, material y acceso
```
```gherkin
DADO "el baño está cerca de la cocina"
CUANDO se analizan palabras claves
ENTONCES "cerca" aislada NO provoca detección de cercas
```
```gherkin
DADO una pérgola estructural o demolición necesaria
CUANDO se califica el intake
ENTONCES `permit_likely_required` o `demolition_required` aparece como aviso por verificar
Y nunca se presenta como permiso concedido
```
- [ ] No regressions en `general_carpentry`, `roofing`, `landscaping` y el resto de categorías.
- [ ] Inputs EN/ES, "no estoy seguro", valores OTHER, vacío y typo no generan crashes.
- [ ] Tamaño usa unidades adecuadas: pies lineales para cercas; ft² para decks, sin tratar las unidades como equivalentes.

## 5. Contrato API/UI
Reuse existing Smart Intake create/analyze/answer/estimate endpoints and response envelopes; category enum `fencing_decks`. Questions `fencing_type`, `fencing_scope`, `fencing_material`, `fencing_site` provide localized labels/options. UI handles loading, empty/unknown, invalid answer, degraded estimate and clear risk warnings in ES/EN. No new public endpoint.

## 6. FSM, eventos y derivación de estimados
Continue existing Smart Intake FSM; no special state created. Category detection and scoring must be deterministic for same canonical answers and version, risk flags are warnings pending field evaluation. No unauthorized state transitions or automatic job publication.

## 7. Datos y migración
No Prisma schema migration expected. Existing intakes and historical category IDs remain valid. Version-aware category scoring prevents old records silently changing approved quotes; verify persisted enum acceptance and backward-compatible UI fallbacks.

## 8. Observabilidad, rollout y rollback
Monitor classification confusion versus carpentry, question abandonment, estimate outliers, locale errors and user feedback. Rollback disables/removes new category in a guarded deployment without corrupting previously persisted `fencing_decks` records; require migration/compatibility strategy if removal becomes necessary. No per-category flag is claimed to exist yet.

## 9. Tests requeridos
- [x] Keyword and precedence regression cases authored in PR #822.
- [ ] Scoring critical question threshold, ranges and warnings for structural/demolition cases.
- [ ] Size-multiplier bounds and ft/ft² interpretation.
- [ ] EN/ES wizard, unknown choice, old record, no silent job publishing and unauthorized claim tests.
- [ ] CI exact SHA plus UI/anonymous API smoke.

## 10. Implementación
Category registry/question file/SCORING_PROFILES/logic/types, landing and web catalog from PR #822. Existing Smart Intake API spec remains baseline; this file is the increment.

## 11. Investigación externa
Permits, structural codes and setback rules vary by jurisdiction; any permit flag is advisory and requires verified local rules before presenting specific legal conclusions. Estimate base ranges require market validation, not solely static multipliers.

## 12. Gates
- [ ] Spec reviewed/APPROVED; [ ] coverage for detection/scoring/estimate/locale/policy; [ ] strict spec validation + spec index.
- [ ] CI/build/UI/API smoke green on exact SHA; [ ] category/version and rollback behavior verified.
- [ ] Only claim VERIFIED after merge/deploy/activation and traceable production evidence.
