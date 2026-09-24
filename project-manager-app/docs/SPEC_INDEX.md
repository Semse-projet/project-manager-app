# SPEC_INDEX — SEMSEproject

**Actualización:** generada con `pnpm spec:index`
**Gobierno:** `docs/SDD_GOVERNANCE.md`
**Plantilla:** `.specify/templates/overrides/semse-spec.md`

> Si una capacidad no tiene spec indexado y `APPROVED`, no se implementa.
> `IMPLEMENTED` no equivale a fusionado/desplegado/activo. Para specs SDD 2.0
> esas etapas aparecen en columnas independientes.

## Fuentes arquitectónicas

1. [`architecture/CURRENT_ARCHITECTURE.md`](architecture/CURRENT_ARCHITECTURE.md)
2. [`SEMSE_CONTEXT.md`](SEMSE_CONTEXT.md)
3. [`architecture/IMPLEMENTATION_STATUS_MATRIX.md`](architecture/IMPLEMENTATION_STATUS_MATRIX.md)
4. [`SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md)
5. [`../ROADMAP.md`](../ROADMAP.md)

## Estados

| Estado | Uso |
|---|---|
| `DRAFT` | Requisitos incompletos; no implementar |
| `REVIEW` | En revisión/clarificación; no implementar |
| `APPROVED` | Contrato autorizado |
| `IMPLEMENTED` | Código y tests completos; entrega aún puede estar pendiente |
| `VERIFIED` | CI, merge, deploy y activación verificados |
| `DEPRECATED` | Sólo referencia histórica |

Las filas `legacy` en delivery metadata corresponden a specs SDD 1.x. Se
migran a SDD 2.0 cuando se modifican sustancialmente; no se inventa evidencia
retroactiva.

<!-- SPEC_INDEX:START -->
## Matriz SDD Generada

> Bloque generado por `pnpm spec:index`. Editar metadata en cada spec, no esta tabla.

| Spec ID | Domain | Spec | Code | CI | Merge | Deploy | Activation | Risk | Tests | Last Verified |
|---|---|---|---|---|---|---|---|---|---|---|
| [semse-agent-architecture](specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md) | agents | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [semse-forge-agent-harness](specs/agents/SEMSE_FORGE_AGENT_HARNESS.spec.md) | agents | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-07-17 |
| [agt-002-prometeo-core](specs/agents/prometeo-core.spec.md) | agents | IMPLEMENTED | COMPLETE | NOT_RUN | MERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-08-17 |
| [agt-001-verification-loop](specs/agents/verification-loop.spec.md) | agents | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-04 |
| [api-agents-runtime](specs/api/agents.spec.md) | agents | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [api-bff-auth-boundary](specs/api/bff-auth-boundary.spec.md) | auth | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-28 |
| [api-buildops](specs/api/buildops.spec.md) | buildops | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-08-13 |
| [api-change-orders](specs/api/change-orders.spec.md) | change-orders | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [api-communications](specs/api/communications.spec.md) | communications | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-07 |
| [api-consciousness-observer](specs/api/consciousness.spec.md) | ops | VERIFIED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-06-09 |
| [api-contract-lifecycle](specs/api/contracts.spec.md) | contracts | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [api-dispute-lifecycle](specs/api/disputes.spec.md) | disputes | VERIFIED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-07-17 |
| [api-evidence-upload-review](specs/api/evidence.spec.md) | evidence | VERIFIED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-06-09 |
| [api-field-ops](specs/api/field-ops.spec.md) | field-ops | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-07 |
| [api-smart-intake](specs/api/intake.spec.md) | smart-intake | VERIFIED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-06-09 |
| [api-job-lifecycle-bids](specs/api/jobs.spec.md) | jobs | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [api-matching](specs/api/matching.spec.md) | matching | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-07 |
| [api-milestone-lifecycle](specs/api/milestones.spec.md) | milestones | VERIFIED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-07-17 |
| [api-payments-escrow](specs/api/payments.spec.md) | payments | VERIFIED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-06-09 |
| [api-prometeo-copilot](specs/api/prometeo-copilot.spec.md) | prometeo | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-18 |
| [api-prometeo-orchestrator](specs/api/prometeo-orchestrator.spec.md) | prometeo | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-18 |
| [api-prometeo-rag-trade-knowledge](specs/api/prometeo.spec.md) | prometeo | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-12 |
| [api.rbac-explicit-boundary](specs/api/rbac-explicit-boundary.spec.md) | core | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-12 |
| [api.readiness](specs/api/readiness.spec.md) | platform | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-12 |
| [api-reservations](specs/api/reservations.spec.md) | reservations | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [api-sense-workspace](specs/api/sense-workspace.spec.md) | workspace | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | low | yes | 2026-07-18 |
| [aut-001-permanent-loops](specs/autonomy/permanent-loops.spec.md) | autonomy | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-04 |
| [communications.rename-fase2](specs/communications/communications-rename-fase2.spec.md) | communications | APPROVED | legacy | legacy | legacy | legacy | legacy | medium | no | 2026-07-19 |
| [core.account-center](specs/core/account-center.spec.md) | core | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-25 |
| [core.communications-canonical-model](specs/core/communications-canonical-model.spec.md) | core | APPROVED | legacy | legacy | legacy | legacy | legacy | medium | no | 2026-07-19 |
| [core.identity-attestation](specs/core/identity-attestation.spec.md) | core | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-08-29 |
| [core.knowledge-contributor-asr-openai-whisper](specs/core/knowledge-contributor-asr-openai-whisper.spec.md) | core | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-09-24 |
| [core.knowledge-contributor-demo-mission-guards](specs/core/knowledge-contributor-demo-mission-guards.spec.md) | core | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-09-24 |
| [core.knowledge-contributor-evidence-promotion](specs/core/knowledge-contributor-evidence-promotion.spec.md) | core | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-09-18 |
| [core.knowledge-contributor-human-review-workspace](specs/core/knowledge-contributor-human-review-workspace.spec.md) | core | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | low | yes | 2026-09-18 |
| [core.knowledge-contributor-rag-ingestion](specs/core/knowledge-contributor-rag-ingestion.spec.md) | core | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-09-19 |
| [core.knowledge-contributor-registry](specs/core/knowledge-contributor-registry.spec.md) | core | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | low | yes | 2026-09-18 |
| [core.knowledge-contributor-reward-hardening](specs/core/knowledge-contributor-reward-hardening.spec.md) | core | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-09-19 |
| [core.knowledge-contributor-transcript-observation](specs/core/knowledge-contributor-transcript-observation.spec.md) | core | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-09-17 |
| [core.org-membership-status](specs/core/org-membership-status.spec.md) | core | DRAFT | COMPLETE | PASS | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-09-18 |
| [core.originador-referral-program](specs/core/originador-referral-program.spec.md) | core | APPROVED | IN_PROGRESS | PASS | MERGED | DEPLOYED | INACTIVE | critical | yes | 2026-08-13 |
| [core.preferred-organization-context](specs/core/preferred-organization-context.spec.md) | core | DRAFT | NOT_STARTED | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | low | no | 2026-09-18 |
| [core.universal-identity-multi-role](specs/core/universal-identity-multi-role.spec.md) | core | APPROVED | IN_PROGRESS | PASS | MERGED | DEPLOYED | INACTIVE | high | yes | 2026-08-13 |
| [semse-creator-platform](specs/creator/SEMSE_CREATOR_PLATFORM.spec.md) | creator | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [evidence.canonical-fase1](specs/evidence/evidence-canonical-fase1.spec.md) | evidence | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-19 |
| [semse-forge-deployment-provider](specs/forge/SEMSE_FORGE_DEPLOYMENT_PROVIDER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-17 |
| [semse-forge-observation-provider](specs/forge/SEMSE_FORGE_OBSERVATION_PROVIDER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [semse-forge-patch-planner](specs/forge/SEMSE_FORGE_PATCH_PLANNER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [semse-forge-patch-writer](specs/forge/SEMSE_FORGE_PATCH_WRITER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [semse-forge-pr-package-provider](specs/forge/SEMSE_FORGE_PR_PACKAGE_PROVIDER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-18 |
| [semse-forge-rollback-provider](specs/forge/SEMSE_FORGE_ROLLBACK_PROVIDER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [semse-forge-runtime-integration](specs/forge/SEMSE_FORGE_RUNTIME_INTEGRATION.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [semse-forge-sandbox-provider](specs/forge/SEMSE_FORGE_SANDBOX_PROVIDER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [semse-forge-sdd](specs/forge/SEMSE_FORGE_SDD.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-07-17 |
| [semse-forge-security-review-provider](specs/forge/SEMSE_FORGE_SECURITY_REVIEW_PROVIDER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-07-17 |
| [semse-forge-tool-adapter](specs/forge/SEMSE_FORGE_TOOL_ADAPTER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [semse-forge-verification-provider](specs/forge/SEMSE_FORGE_VERIFICATION_PROVIDER.spec.md) | forge | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-18 |
| [fsm-agent-run-lifecycle](specs/fsm/agent-run-lifecycle.spec.md) | agents | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [fsm-buildops-plan-lifecycle](specs/fsm/buildops-lifecycle.spec.md) | buildops | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [fsm-escrow-lifecycle](specs/fsm/escrow-lifecycle.spec.md) | payments | VERIFIED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-06-09 |
| [forge-run-lifecycle](specs/fsm/forge-run-lifecycle.spec.md) | fsm | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [fsm-job-lifecycle](specs/fsm/job-lifecycle.spec.md) | jobs | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-17 |
| [fsm-milestone-lifecycle](specs/fsm/milestone-lifecycle.spec.md) | milestones | VERIFIED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-07-17 |
| [fsm-reservation-lifecycle](specs/fsm/reservation-lifecycle.spec.md) | reservations | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [labor.time-tracking-consolidation](specs/labor/time-tracking-consolidation.spec.md) | labor | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-19 |
| [operations.jobs-bids-event-projection](specs/operations/jobs-bids-event-projection.spec.md) | operations | IMPLEMENTED | COMPLETE | PASS | MERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-08-26 |
| [operations.mission-control-2](specs/operations/mission-control-2.spec.md) | operations | IMPLEMENTED | COMPLETE | PASS | MERGED | DEPLOYED | INACTIVE | critical | yes | 2026-08-12 |
| [operations.project-lifecycle-projection](specs/operations/project-lifecycle-projection.spec.md) | operations | VERIFIED | COMPLETE | PASS | MERGED | DEPLOYED | CANARY | critical | yes | 2026-07-31 |
| [platform.canonical-state-registry](specs/platform/canonical-state-registry.spec.md) | platform | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-08-28 |
| [platform.event-backbone-f1](specs/platform/event-backbone.spec.md) | platform | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-07-12 |
| [platform.product-intelligence](specs/platform/product-intelligence.spec.md) | platform | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-08-27 |
| [platform.production-convergence-f3-f9](specs/platform/production-convergence-program.spec.md) | platform | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | critical | yes | 2026-07-31 |
| [prometeo.agent-decision-retrieval](specs/prometeo/agent-decision-retrieval.spec.md) | prometeo | REVIEW | NOT_STARTED | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | no | 2026-08-17 |
| [prometeo.cache-control](specs/prometeo/cache-control.spec.md) | prometeo | REVIEW | NOT_STARTED | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | no | 2026-08-17 |
| [prometeo.live-sessions](specs/prometeo/live-sessions.spec.md) | prometeo | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | high | no | 2026-09-07 |
| [prometeo.model-gateway-unification](specs/prometeo/model-gateway-unification.spec.md) | prometeo | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-08-27 |
| [prometeo.tool-registry-governance-f2](specs/prometeo/tool-registry-governance.spec.md) | prometeo | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | no | 2026-07-20 |
| [prometeo.tool-result-multimodal](specs/prometeo/tool-result-multimodal.spec.md) | prometeo | IMPLEMENTED | COMPLETE | PASS | MERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-08-27 |
| [satellites.sdd-harness](specs/satellites/SAT-000-sdd-harness.spec.md) | agents | APPROVED | legacy | legacy | legacy | legacy | legacy | high | no | 2026-07-12 |
| [satellites.semse-sdk](specs/satellites/SAT-001-semse-sdk.spec.md) | api | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-08-27 |
| [satellites.alexa-voice](specs/satellites/SAT-002-alexa-voice-channel.spec.md) | communications | APPROVED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-07 |
| [satellites.mobile-app](specs/satellites/SAT-003-mobile-app-client.spec.md) | ui | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-07 |
| [satellites.graphify-knowledge](specs/satellites/SAT-004-graphify-knowledge.spec.md) | rag | APPROVED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-07 |
| [satellites.storage-driver](specs/satellites/SAT-005-storage-driver.spec.md) | evidence | DRAFT | NOT_STARTED | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-08-17 |
| [satellites.protools-embed](specs/satellites/SAT-006-protools-embed.spec.md) | tools | DRAFT | NOT_STARTED | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | low | no | 2026-08-17 |
| [satellites.outbound-webhooks](specs/satellites/SAT-007-outbound-webhooks.spec.md) | api | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-08-27 |
| [satellites.observer-nodes](specs/satellites/SAT-008-observer-satellite-nodes.spec.md) | ops | DRAFT | NOT_STARTED | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | no | 2026-08-17 |
| [tasks.task-unification-fase1](specs/tasks/task-unification-fase1.spec.md) | tasks | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-19 |
| [m1-1-material-pricing](specs/tools/fase-1/m1.1-material-pricing.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-06-09 |
| [m1-2-regional-costs](specs/tools/fase-1/m1.2-regional-costs.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-06-09 |
| [m1-3-stripe-escrow](specs/tools/fase-1/m1.3-stripe-escrow.spec.md) | payments | VERIFIED | legacy | legacy | legacy | legacy | legacy | critical | yes | 2026-06-09 |
| [m1-4-contracts](specs/tools/fase-1/m1.4-contracts.spec.md) | contracts | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [tools.lien-rights-management](specs/tools/fase-2/m2.1-lien-rights.spec.md) | legal | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-08-27 |
| [tools.anti-dispute-documentation](specs/tools/fase-2/m2.2-dispute-docs.spec.md) | evidence | APPROVED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-08-27 |
| [tools.weather-integration-alerts](specs/tools/fase-2/m2.3-weather.spec.md) | operations | APPROVED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-08-27 |
| [tools.multi-stage-releases](specs/tools/fase-3/m3.1-multi-stage-releases.spec.md) | payments | DEPRECATED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-19 |
| [m3-1-proactive-agents](specs/tools/fase-3/m3.1-proactive-agents.spec.md) | agents | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [m3-2-extended-metrics](specs/tools/fase-3/m3.2-extended-metrics.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-06-09 |
| [m3-3-labor-calibration](specs/tools/fase-3/m3.3-labor-calibration.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-06-09 |
| [m4-1-accounting](specs/tools/fase-4/m4.1-accounting.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [m4-2-geo-permits](specs/tools/fase-4/m4.2-geo-permits.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [m4-3-field-comms](specs/tools/fase-4/m4.3-field-comms.spec.md) | communications | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [m5-1-ml-risk](specs/tools/fase-5/m5.1-ml-risk.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [m5-2-public-api](specs/tools/fase-5/m5.2-public-api.spec.md) | api | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [m5-3-monetization](specs/tools/fase-5/m5.3-monetization.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [tools.materials-calculator](specs/tools/materials-calculator.spec.md) | tools | VERIFIED | legacy | legacy | legacy | legacy | legacy | low | yes | 2026-07-19 |
| [ui.admin-flows-remediation](specs/ui/admin-flows-remediation.spec.md) | ui | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | no | 2026-08-14 |
| [ui-admin-flows](specs/ui/admin-flows.spec.md) | ui | DEPRECATED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [ui.admin-modular-navigation](specs/ui/admin-modular-navigation.spec.md) | ui | VERIFIED | COMPLETE | PASS | MERGED | DEPLOYED | ACTIVE | medium | yes | 2026-08-02 |
| [ui.client-flows-remediation](specs/ui/client-flows-remediation.spec.md) | ui | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | no | 2026-08-14 |
| [ui-client-flows](specs/ui/client-flows.spec.md) | ui | DEPRECATED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [ui.demo-sandbox](specs/ui/demo-sandbox.spec.md) | ui | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-07-12 |
| [ui-smart-intake-flow](specs/ui/intake-flow.spec.md) | ui | VERIFIED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-06-09 |
| [ui.landing-personas](specs/ui/landing-personas.spec.md) | ui | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | low | yes | 2026-07-12 |
| [ui.mobile-admin-contractors](specs/ui/mobile-admin-contractors.spec.md) | ui | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | low | yes | 2026-08-26 |
| [ui.mobile-admin-dashboard](specs/ui/mobile-admin-dashboard.spec.md) | ui | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | low | yes | 2026-08-17 |
| [ui.mobile-admin-disputes-resolution](specs/ui/mobile-admin-disputes-resolution.spec.md) | ui | DRAFT | NOT_STARTED | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | critical | no | 2026-08-26 |
| [ui.mobile-admin-disputes](specs/ui/mobile-admin-disputes.spec.md) | ui | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-08-17 |
| [ui.mobile-admin-labor-overview](specs/ui/mobile-admin-labor-overview.spec.md) | ui | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-08-19 |
| [ui.mobile-admin-reputation](specs/ui/mobile-admin-reputation.spec.md) | ui | IMPLEMENTED | COMPLETE | PASS | MERGED | NOT_DEPLOYED | INACTIVE | low | yes | 2026-08-26 |
| [ui.mobile-admin-trust](specs/ui/mobile-admin-trust.spec.md) | ui | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | low | yes | 2026-08-26 |
| [ui.mobile-admin-users](specs/ui/mobile-admin-users.spec.md) | ui | IMPLEMENTED | COMPLETE | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | medium | yes | 2026-08-26 |
| [ui.mobile-client-tab](specs/ui/mobile-client-tab.spec.md) | ui | IMPLEMENTED | COMPLETE | PASS | MERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-08-05 |
| [ui.mobile-product-consolidation](specs/ui/mobile-product-consolidation.spec.md) | ui | APPROVED | IN_PROGRESS | NOT_RUN | UNMERGED | NOT_DEPLOYED | INACTIVE | high | yes | 2026-09-06 |
| [ui.pro-flows-remediation](specs/ui/pro-flows-remediation.spec.md) | ui | APPROVED | legacy | legacy | legacy | legacy | legacy | critical | no | 2026-08-14 |
| [ui-pro-flows](specs/ui/pro-flows.spec.md) | ui | DEPRECATED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |
| [ui.prometeo-multimodal-workspace-p3a](specs/ui/prometeo-multimodal-workspace.spec.md) | ui | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | medium | yes | 2026-07-16 |
| [ui-public-landing-operational-entry](specs/ui/public-landing-operational-entry.spec.md) | ui | VERIFIED | legacy | legacy | legacy | legacy | legacy | low | yes | 2026-06-10 |
| [ui.semse-hub](specs/ui/semse-hub.spec.md) | ui | IMPLEMENTED | legacy | legacy | legacy | legacy | legacy | low | yes | 2026-07-12 |
| [ui-work-os-navigation-decision-intelligence](specs/ui/work-os-navigation-decision-intelligence.spec.md) | ui | VERIFIED | legacy | legacy | legacy | legacy | legacy | high | yes | 2026-06-09 |

<!-- SPEC_INDEX:END -->

## Comandos

```text
pnpm spec:validate:strict
pnpm spec:index
pnpm spec:coverage
```

Editar metadata en cada spec, no la matriz generada.
