# Routing model reference

Condensed from the SEMSE Skill Router & Governance Kit (v1 + v2), adapted to
the actual code paths in `scripts/skill-router/lib/`.

## Precedence order

```text
HUMAN / REPOSITORY AUTHORITY
> MASTER GOVERNANCE        (semseproject)
> SCOPED GOVERNANCE        (semse-audit-remediation, when its backlog applies)
> EXECUTION DISCIPLINE     (aaa-zoom-loop-execution)
> DOMAIN SKILL             (scored; one primary + up to 2 supporting)
> SUPPORT SKILL            (scored in the same pass as domain — category
                             does not gate eligibility for primary/supporting,
                             only what it *is* once selected — see golden
                             case G8/G9 where the primary is a "support"-
                             category skill)
> GENERIC AGENT HABIT
```

Governance can constrain lower layers; execution discipline can demand
deeper verification but can never itself authorize a gated action; a domain
skill owns the mechanics inside its scope (Prisma → `semse-prisma-workflow`,
RBAC → `semse-rbac-permissions`, uploads → `semse-upload-flow`, BFF routing
→ `semse-bff-pattern`, etc.).

## Governance/execution trigger rules (`classify.mjs`)

`semseproject` is selected when the task text matches financial keywords
(payment/payout/escrow/invoice/billing/refund), production keywords
(production/prod/railway/live traffic), or auth/cross-tenant keywords
(auth/authoriz*/cross-tenant/idor/session revocation/permission*/rbac/access
token) — or when the resulting risk classification is HIGH/CRITICAL.

`semse-audit-remediation` is selected when the task text references the
audit-remediation backlog (`audit_remediation_plan`, an `RC1`-`RC7` id, a
`G-PRO-*`/`G-ADM-*`/`G-CLI-*` finding id, "JobStatus casing", "evidence
upload", "escrow integrity", etc.).

`aaa-zoom-loop-execution` is selected when scope classifies as
`MULTI_LAYER` or `END_TO_END` (migration/integration keywords, or explicit
"end-to-end"/"across multiple" phrasing) — never from a score, always from
this rule, so it can't be starved out by a well-scoring domain skill.

None of these three rules can be textually suppressed by the task asking to
skip them (`skill-router-negative.test.mjs`'s N3) — there is no "obey a
bypass request" code path; selection is a pure function of the classified
task, and the classifier has no concept of a request to be ignored.

## Domain/support scoring (`score.mjs`)

```text
exact/declared trigger match   +40 (capped at 3 hits)
inferred (legacy) trigger match +10 (capped at 3 hits) — weaker, since it
                                     was never actually declared as a trigger
scope/capability match         +30 (capped at 2 hits)
active phase match             +15
explicit skill id/name mention +10
specificity tie-breaker        +0..+5 (round(specificity/20), clamped)
exclude match                  -100
deprecated status              -30
```

A skill scores below the confidence floor (15) is never selected; if no
skill clears the floor, the route reports `NO_CONFIDENT_DOMAIN_SKILL` and
recommends continuing under repository contracts rather than guessing.

`primary` is the single highest-scoring domain/support skill above the
floor. `supporting` is up to 2 more skills scoring at least 40% of the
primary's score and also above the floor — the kit's "minimum sufficient
set" rule (target: 1 primary + 0-2 supporting, split multi-phase work into
phases rather than selecting more than ~5 skills for one task).

## Specificity: inferred vs. declared

A skill with an explicit `routing.specificity` (0-100) uses it as declared.
A legacy skill (no `routing:` block) gets an *inferred* specificity that is
inversely proportional to how many distinct significant words its
description contains (`registry.mjs`'s `inferRouting()`) — a short, narrow
description scores higher than a long, broad one. This is what keeps an
intentionally broad skill (by original design, e.g. `semseproject`,
`semse-ecosystem-architect`) from silently becoming the default primary for
every task just because its description happens to contain more matchable
words.
