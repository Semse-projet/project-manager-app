---
name: semse-spec-kit-flow
description: How to actually run the SDD (Spec Kit) flow this repo requires before writing feature code — the 10-step sequence from AGENTS.md, which template to use, the SEMSE-specific mandatory fields, and the validation scripts (spec:validate, spec:index, spec:coverage). Use before implementing any new feature (not a bugfix from an already-approved spec), or when a spec's status blocks you (DRAFT/REVIEW).
---

# SEMSE Spec Kit (SDD) flow

## The rule this exists to operationalize

`project-manager-app/AGENTS.md` is explicit that "Generar código sin spec aprobado para el dominio" is forbidden, and spells out the wrong vs. right way to start a feature:

> NO HACER: "Implementa el endpoint de pagos"
> SÍ HACER: specify → plan → tasks → tests (T-002 antes de código) → implement → validar → checklist → CI/merge/deploy/activación separados → reporte.

This skill exists because that sequence is documented but nothing scaffolds it — a new agent has to know where the templates live and what the SEMSE-specific required fields are, which generic Spec Kit knowledge doesn't cover.

## Where things live

- Templates: `.specify/templates/overrides/semse-spec.md`, `semse-plan.md`, `semse-tasks.md`, `semse-checklist.md` — **use these, not generic Spec Kit templates**, because they carry SEMSE-only required frontmatter fields (see below).
- Governing principles: `.specify/memory/constitution.md` — read before any feature work per `AGENTS.md`. Note it uses an **F0-F9** phase numbering for architecture, which is a *different* scheme from the F0-F5 phases used elsewhere for product-knowledge planning — don't conflate the two if both come up in the same conversation.
- Output location: `docs/specs/[dominio]/[feature].spec.md` (and `.plan.md`/`.tasks.md`/`.checklist.md` siblings), where `[dominio]` is one of the nine bounded contexts (`platform | core | buildops | evidence | payments | trust | prometeo | agents | agro | labor | ui`, per the template's own `domain` enum comment).
- Master index: `docs/SPEC_INDEX.md`, regenerated with `pnpm spec:index` — **states are not duplicated by hand anywhere else**; `AGENTS.md` says explicitly not to maintain spec status prose in `AGENTS.md` itself because it drifts.

## SEMSE-specific required frontmatter (beyond generic Spec Kit)

The `semse-spec.md` template's frontmatter carries fields a plain Spec Kit spec doesn't have — don't skip them:

`status` (DRAFT/REVIEW/APPROVED/...), `risk`, plus a full **delivery-state block kept separate from `status` itself**: `code_status`, `ci_status`, `merge_status`, `deploy_status`, `activation_status`, `migration_status`, `feature_flags`, `production_evidence`, `related_files`/`related_tests`/`related_endpoints`/`related_events`/`related_agents`, `last_verified`. The template's own header comment states the reason: "un deploy no demuestra [activación]" — CI passing, merging, deploying, and actually being active in production are four different facts that must each be recorded, not inferred from each other. AGENTS.md's own governance rule echoes this: "no inferir activación desde código, merge, deploy o healthcheck."

There are also SEMSE-only spec fields beyond the standard Spec Kit anatomy: `privacyCritical` (routes to local Ollama), `auditLog` (required audit event), `sse` (real-time SSE emission), `fsmTransicion` (state-machine transition), `paymentGovernance` (escrow/payment impact).

## The governance gate on existing DRAFT specs

The three `docs/specs/ui/*-remediation.spec.md` files (`pro-flows`, `client-flows`, `admin-flows`) are all `status: DRAFT` as of this writing. Per `AGENTS.md`, an agent must not jump straight from a DRAFT spec to implementation — confirm the finding is still accurate, run `/speckit.plan` then `/speckit.tasks`, and for anything touching money/auth/cross-tenant data get explicit human sign-off before implementing (see `semse-audit-remediation` skill for the full governance gate and the 7 root-cause groupings it already worked out — don't re-derive those from scratch).

`admin-flows-remediation.spec.md` additionally cannot be promoted past DRAFT until someone gets a real `OPS_ADMIN` credential and repeats the live-verification pass already done for Client/Worker — its findings are code-only hypotheses until then.

## Validation

`pnpm spec:validate` / `pnpm spec:validate:strict` (`scripts/spec-validate.mjs`) — run whenever a `.spec.md` file changes; `--strict` is the stronger gate, used in this repo's own remediation work as a completion check. `pnpm spec:coverage` (`scripts/spec-coverage.mjs`) exists too but wasn't exercised in this session — check its output format before relying on it for a claim.

## Notas para futuros agentes / hallazgos abiertos

- No se investigó en esta sesión si existen los slash-commands reales de Spec Kit (`/speckit.plan`, `/speckit.tasks`, etc.) instalados en este entorno o si hay que "producir el mismo artefacto desde las plantillas SEMSE" a mano, como `AGENTS.md` dice que es aceptable cuando el comando no existe. Si el comando falla, no asumas que el flujo entero es inválido — usá las plantillas directamente.
- El `constitution.md` menciona una arquitectura F0-F9 sintetizada desde documentos de visión (`labosemse/vision_core.md`, etc.) que no se leyeron en esta sesión — si un spec nuevo necesita justificarse contra esa arquitectura de fases, leer la constitución completa primero, no asumir que F0-F9 mapea 1:1 con las fases F0-F5 del resto de la planificación de producto.
- Esta skill no reemplaza a `semse-audit-remediation` para el backlog ya existente — esa skill sigue siendo la fuente correcta para *ese* trabajo puntual. Esta skill es para features **nuevos** que todavía no tienen spec.
