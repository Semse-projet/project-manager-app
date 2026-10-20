# ES/EN validation and authenticated acceptance

User requested and approved corrective implementation and catalog validation on 2026-10-20. This tooling does not adopt the proposed full i18n architecture or replace useLanguage.

Run from project-manager-app with pnpm 10.33.0 and installed locked dependencies:

- `pnpm i18n:test`: deliberate malformed/duplicate/type/critical-staleness fixtures.
- `pnpm i18n:validate`: exact ES/EN keys and ICU argument signatures in validation-config.json. Read-only AST parsing, no eval/application imports. Supports literal nested dictionaries and simple arrow-template interpolation. Reject other dynamic catalogs.
- `pnpm i18n:critical`: same structural checks plus human approval metadata tied to both exact texts and glossary version. A FAIL for CRITICAL_REVIEW_REQUIRED is an outstanding review, not a broken validator.

The current inventory covers global T and three invitation/offer COPY dictionaries, not every inline string, PDF, email, legal document or private translation in the application. Critical manifest covers 16 permission/legal/destructive/financial texts in those three flows. Expand coverage explicitly when migrating additional surfaces. Human approvals are assertions recorded with reviewer/date/evidence; protect their review through repository governance. A hash cannot verify the reviewer's identity or the translation's meaning.

Digest: SHA256 UTF-8 with CRLF normalized to LF. Do not modify reviewed hashes or reviewer identity merely to make a gate green. Source changes invalidate sourceHash and translationSourceHash; translated text changes invalidate targetHash; glossary version changes invalidate review. Existing critical entries remain inReview until a bilingual product/legal/security reviewer actually approves these exact strings. Contract approval is separate.

One exact empty-string exception is documented: en/global:ui.since, the legacy optional temporal prefix used alongside ui.ago. This does not exempt key presence, variables, malformed ICU, or other empty messages. Audit complete timestamp consumers before changing their grammar. The validator understands ICU syntax but does not install an ICU runtime or change interpolation in useLanguage.

Authenticated smoke follows automated validation on the same deployed SHA. Record environment, frontend/API provenance, role, org context presence, route, locale, viewport, expected/actual and evidence. Verify CLIENT, PRO, WORKER, OPS_ADMIN with independent authorized sessions; do not derive authority from a cosmetic role cookie. Check allowed and denied routes, loading/empty/error states, ES→EN→ES drafts and attachments, raw monetary values/currency/state, dates/timezone, and original ACL for any private translation/RAG. Use synthetic staging resources; no real payments, invitations, contracts or account/role changes without scope authorization. Never put tokens, cookies, passwords, PII or private content into reports/traces.

Separate PASS, FAIL, BLOCKED and NOT_RUN. One CLIENT desktop smoke does not establish a four-role/mobile matrix, raw-value invariants, or remediation not yet deployed. Catalog success does not establish linguistic/legal approval or runtime authorization.
