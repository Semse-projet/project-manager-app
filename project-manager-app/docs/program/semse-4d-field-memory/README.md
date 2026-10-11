# SEMSE Field Memory 4D — Canonical discovery handoff
**Prepared:** 2026-10-11
**Repo:** Semse-projet/project-manager-app
**Status:** DISCOVERY / PROPOSED BLUEPRINT, not a feature launch.
**Origin:** founder's 2026-10-11 voice discovery covering staffing, field supervision, worker time, multi-level crews, media evidence, hidden building services, construction memory and provider integrations.
**Base audit:** main SHA 4e4fd4f5818dd4c63ee25a69e49781cb2b62ec49 (targeted code/ADR checks; no CI or production execution in this review).

## Read in this order
1. [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) — problem, verbatim-context paraphrase, every agreed field workflow, product actors, 54 baseline requirements plus 15 organization/schedule extension requirements; open decisions.
2. [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) — exact existing modules found, reusable canonical boundaries, proposed crew + spatial + temporal data models, secured Prometeo and connector topology.
3. [ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md](ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md) — company owner accounts, worker invitations and memberships, crew-lead authority, multiple employers, smartphone/kiosk options and four 10-hour days (15 additional REQ IDs).
4. [COMPANY_INVITATIONS_DETAILED_SPEC.md](COMPANY_INVITATIONS_DETAILED_SPEC.md) — detailed SDD draft for personal, one-time invite links, contact verification, new-user registration without creating another Org, RBAC, proposed REST contracts, lifecycle, 22 acceptance cases, audit and security testing.
5. [MULTI_ORG_CONTEXT_SELECTOR_UX.md](MULTI_ORG_CONTEXT_SELECTOR_UX.md) — diseño del selector cuenta → organización o proyecto externo → obra → capacidad autorizada, protección de jornadas/evidencias y 12 casos de prueba CTX.
6. [WORKSPACE_REUSE_AND_CONNECTORS.md](WORKSPACE_REUSE_AND_CONNECTORS.md) — hallazgos AS-IS Workspace, tema/color corporativo, integración con pantalla administrativa y Universal Connector, rutas de BuildOps/Labor/Evidence, límites de seguridad, seis slices y 16 pruebas WSP.
7. [IMPLEMENTATION_AND_VERIFICATION.md](IMPLEMENTATION_AND_VERIFICATION.md) — phased engineering backlog W0–W6, candidate PR slices, verification scenarios, rollout and Definition of Done.

## Unbroken vision
A staffed electrician starts a site-dependent shift, is assigned a crew task by an authorized lead rather than forcing a GC to replace their own tool, records photos and video **before services are concealed**, and passes reviewed evidence through approved permissions. Six or eight months later another authorized crew asks Prometeo what existed behind a particular seventh-floor wall before drywall; Prometeo shows dated source-linked captures and drawings (or says it cannot know). A timeline can ultimately add 2D then BIM/3D spatial references and time-based 4D replay. Field time, drawings and evidence belong to canonical SEMSE services, not a generative model or third-party connector.

## Decision split
**Directly stated/endorsed in conversation:** company owner should manage an organization with linked workers (the precise invite approach is a recommendation, not yet approved); 40 weekly hours may be scheduled across four 10-hour days Monday–Thursday; both worker and crew lead use SEMSE; project-specific schedules controlled by administrator; target-hours notices to worker and supervisor; optional proximity arrival and actionable exit prompts; staffing employer distant from site; site supervisor retains own software; 5–20-person variable crews and multiple foremen; tasks last parts of day or several days; individual evidence is reviewed and handed to site; future search by exact place and historic time; Prometeo analyzes; leverage mature external tools and connectors; preserve full plan.

**Engineering proposals requiring human approval:** specific table/API names, default ASK permission mode, QR and manual plan pin, confidence labels, release sequencing, exact approval chain, IFC/BCF-first integration, retention/access policy, event schemas and target metrics.

**Verified code presence, not operational completion:** Labor Engine, field-ops timer, mobile proximity auto-start, JobTask/BuildOps task stacks, Evidence/Evidence Gateway and EXIF utilities, vision pipeline, multiple Prometeo APIs, Universal Connector contracts/enforcement code. The docs/architecture/ADR-042 name collision and incomplete connector CI/deploy metadata require follow-up.

## Source links within the repo
- [Labor ownership ADR](../../architecture/ADR-029-labor-engine-canonical-time-owner.md)
- [Evidence ownership ADR](../../architecture/ADR-028-evidence-gateway-adapter-role.md)
- [Agent/Copilot reachability ADR](../../architecture/ADR-038-prometeo-copilot-orchestration-reachability.md)
- [Universal Connector trust ADR](../../architecture/ADR-042-universal-connector-trust-boundary.md)
- [Connector trust spec](../../specs/platform/universal-connector-trust.spec.md)
- [Task unification spec](../../specs/tasks/task-unification-fase1.spec.md)
- [Evidence canonical spec](../../specs/evidence/evidence-canonical-fase1.spec.md)

## Handling by downstream implementers
- Do not delete/recreate existing domain owners or change payroll logic in a large untested migration.
- Do not make this folder the official production truth; before coding, split into approved SDD 2.0 child specs registered in SPEC_INDEX and get owner decisions on open policy questions.
- Keep new work behind feature flags, tests first and reviewed PRs. Preserve tenant separation and traceable evidence of CI, Railway and mobile canaries.
- External systems, LLM outputs and device-provided timestamps are untrusted inputs unless independently validated and permitted.
- This proposal is a living record: future corrections should cite which requirement or earlier assumption changed; never silently erase origin or disagreements.

## Next concrete engineering handoff
W0: validate active main, exact org-registration/invitation/membership routes and deployments, reconcile the domain-owner boundaries and create the first approved child spec for canonical labor + site-specific schedules + geofence exit action prompts (REQ-TIM-001 through REQ-TIM-012). Next W2 worker/crew tasks and W3 before-concealment evidence. Hold BIM viewer work until precise evidence/location provenance is reliable.

**Invitation design status:** detailed specification in COMPANY_INVITATIONS_DETAILED_SPEC.md is a DRAFT, not yet approved in canonical SDD 2.0, and must not be treated as existing endpoints or production functionality.

**Nuevo feedback del propietario:** el Workspace probado aún carece de acciones reales, sus colores no corresponden a SEMSE y debe incluir el conector desarrollado. La integración aprovecha el shell/Prometeo/navegación existentes; ver WORKSPACE_REUSE_AND_CONNECTORS.md. No afirmar Workspace o Connector funcional en producción.

**Seguimiento post-merge #857:** el selector contextual se documentó después de la fusión y se propone en un PR separado; no representa UI ni autorización desplegada.

**Preservation rule:** Every further issue/PR for this initiative must reference this folder and applicable REQ IDs; this prevents conversation context from being lost when assistants/tools change.
