---
id: "ui.localization-architecture"
title: "Internacionalización ES/EN — arquitectura compatible con Next.js App Router"
sdd_version: "2.0"
domain: "ui"
version: "0.1"
status: "REVIEW"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_STARTED"
feature_flags: []
production_evidence: []
privacyCritical: true
auditLog: false
sse: false
fsmTransicion: "N/A — translation must not modify business state"
paymentGovernance: "N/A — must not alter payment logic or claims"
related_files:
  - apps/web/package.json
  - apps/web/lib/language-context.tsx
  - apps/web/app/layout.tsx
  - apps/web/app/(app)/layout.tsx
  - apps/web/app/(app)/client/jobs/new/page.tsx
  - apps/web/app/lib/buildops-i18n.ts
  - apps/web/app/contributors/ContributorsShell.tsx
  - apps/web/middleware.ts
  - apps/web/next.config.ts
  - apps/api/src/modules/prometeo/prometeo.controller.ts
related_tests:
  - tests/unit/contributor-i18n-keys.test.ts
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-10-18"
---

# SEMSE UI localization architecture: ES/EN (AUDIT + proposal)

> REVIEW is not approval to replace libraries, release new translations, turn on provider calls, or add public routes. This file describes a proposal reconciled with live repository source at commit `38d7cb3a`. It is not production evidence.

## Verified as-is (source inspection)

- `@semse/web` uses Next.js **15.5.27**, React 19, and the App Router; client components coexist with server-renderable routes. It is **not** a conventional standalone React SPA.
- `apps/web/lib/language-context.tsx` already exposes `LanguageProvider`, `useLanguage()`, `language`, `setLanguage` and `t(string)`. Flat ES and EN maps contain **759 unique entries each** at the audited commit, with equal key sets and no duplicate keys found by static key extraction. This measures dictionary parity, **not page coverage**.
- Current fallback is `T[language][key] ?? T.en[key] ?? key` (English and then a raw technical key), despite Spanish being the initial UI state. `semse-language` is persisted in browser localStorage after mount, not resolved per request or from an authenticated account preference. The root HTML starts `lang="es"`.
- BuildOps, navigation, offers, contributors and other screens use the existing API; an immediate provider swap would break callers. The job-posting wizard (`apps/web/app/(app)/client/jobs/new/page.tsx`) still uses untranslated step labels, and money formatting uses `en-US` independently of the UI language.
- Public metadata/OG currently contains Spanish text, `og:locale = es_MX`, and `robots: { index: false }`. **Multilingual public SEO is a separate explicitly gated decision**, not an automatic requirement of this phase.
- Existing open, not-merged i18n PRs #968, #969, #970 and #973 modify related UI files and/or the flat dictionary. Their content must be reconciled before rewriting keys. #973 concerns Prometeo and must respect ongoing security issue #974 and P0 integration PR #987.

## Target decision

**No second translation system for the same screens.** Perform a small compatibility spike comparing:

1. **Preferred candidate:** `next-intl` on Next.js App Router, with per-request server locale and bundled versioned JSON; validate Next 15 / React 19, Server and Client Components, current middleware/authorization boundaries, and build output on this repository.
2. **Lower-risk fallback:** retain the existing `useLanguage` adapter, extract its dictionaries to versioned ES/EN module JSON and strengthen SSR/CI/preferences without replacing the runtime immediately.
3. `react-i18next` is not the default for `@semse/web`; consider it only for independently developed React-only apps, not as a second global provider layered over Next.

Choose **one** primary localization runtime after measuring the pilot. Preserve compatibility for existing `t("nav.dashboard")` and similar key callers during migration via an explicit adapter; do not silently change message syntax or dynamic business-status keys.

## Language contract

- Supported UI languages for v1: `es` and `en`; choose `es` for the declared product fallback (requires an approved migration of existing English fallback behavior).
- Resolve authenticated language before initial private SSR render, without reading `localStorage` on the server. Proposed order: explicit valid route language when supported; saved account preference; validated device/browser preference; Spanish fallback. Define cookie/account synchronization and avoid cross-tenant caching or hydration flicker.
- Treat `uiLanguage`, `formatLocale`, `timeZone`, `measurementSystem`, `marketCountry`, and transaction currency as independent fields. Changing language must not change money, stored timestamps, financial precision, project identifiers, role, business status, or contractual meaning.
- Root `html.lang`, accessible labels, browser metadata and client hydration must agree with the chosen locale. Locale switching preserves route, form drafts and authenticated session state.
- Do not introduce `/es` and `/en` public routes, canonical or hreflang until SEO policy and `robots: noindex` are explicitly reconciled.

## Catalog migration contract

- Git-tracked, approved, release-versioned ES/EN JSON is the single source of truth, with domain namespaces. Draft target domains: `common`, `landing`, `auth`, `jobs`, `proposals`, `buildops`, `evidence`, `payments`, `trust`, `prometeo`, `validation`.
- During migration, maintain an immutable key mapping from flat `ui.*`, `page.*`, `status.*`, `buildops.*`, `contributors.*`, etc., to namespace paths. Avoid a forced wholesale rename until every caller is migrated.
- JSON stores only runtime messages; reviewer notes, glossary, semantic meaning, risk and approval hashes live in separate metadata. Message IDs describe domain meaning, not layout or English/Spanish prose.
- Do not concatenate translated sentence fragments; validate parameters, plurals/ICU syntax against the selected runtime, safe links and formatting, and do not render arbitrary translated HTML.
- The server must return stable domain error codes plus safe parameters; a presentation mapping localizes those codes. No translated message may alter the rules governing milestones, evidence, grants or payments.
- Display `escrow`/fund-protection wording only after legal/functional approval. The current site's marketing copy is not evidence of contractual escrow guarantees.

## Static vs dynamic translation boundary

- All ordinary buttons, labels, controls, status labels and error messages load **without runtime machine translation**. No DeepL or Google calls during render.
- Human-reviewed strings only in releases. Machine output is a backend/CI editorial draft with `new → machineDraft → inReview → approved` plus source-hash invalidation.
- User-provided project descriptions, chats, evidence documents and AI outputs are **separate versioned business data**. The optional future `Translate` action preserves the source, labels derived output and confirms object-level authorization before serving original or cached derivatives.
- Never send private Prometeo RAG fragments, evidence, personal data, payments or contracts to third-party translation providers without separately documented consent, policy review, tenant/org scope, residency and retention controls. Issue #974/PR #987 security clearance is a release dependency for translation touching Prometeo.
- Keep tenant/org-specific derived translations isolated; cache key must account for original content version/source hash, authorization scope, source and target language, provider/model and glossary version. Do not cache by plaintext equality across organizations.
- The provider benchmark (DeepL vs Google) is deferred; no provider credential, SDK, worker, backfill or external call is authorized by this REVIEW spec.

## Pilot and acceptance

**Proposed pilot:** full client job-posting wizard, not just one button. First execute a short Next App Router compatibility spike on an isolated branch; preserve current wizard drafts and server auth boundaries.

1. Record inventory for each role and route: static UI strings, server errors, `aria-label`, placeholders, emails/notifications, page metadata and untranslated business data. Baseline existing 759 ES/EN flat keys before any extraction.
2. Extract namespaces to a Git-owned source folder; introduce a compatibility adapter retaining existing `useLanguage` callers. Import the same approved resources on server and client without a mutable cross-request singleton.
3. Pilot wizard ES/EN labels, validation, error codes, status and confirmation. Switching locale cannot erase intake drafts, change posted price/currency, change authorization or expose raw keys.
4. Gate CI for duplicate JSON keys, identical semantic coverage, missing parameters, valid plural forms, unapproved/high-risk changes, unresolved raw keys, broken links, and consistency with `@semse/web` build.
5. Add SSR/hydration concurrency tests (distinct sessions es/en); navigation switch, protected session restoration, screen-reader labels, keyboard navigation, mobile text expansion and rollback to previous catalog version.
6. Pilot release only after all workflow strings reviewed in both languages, zero technical keys displayed, confirmed business-logic neutrality and successful clean rollback.

## Decisions awaiting approval

- **D1**: accept an isolated `next-intl` compatibility spike before adopting its runtime, or maintain the existing adapter only.
- **D2**: pilot the entire client job-posting wizard (`/client/jobs/new`), rather than starting with less critical navigation.
- **D3**: switch missing-message fallback from English to Spanish and define monitoring for missing keys.
- **D4**: specify authoritative authenticated account locale and safe cookie/device synchronization; this is not currently shown in the provider.
- **D5**: defer multilingual SEO while the site uses `robots: noindex`.
- **D6**: require legal/product approval for translated escrow, payment, dispute and contractual claims.
- **D7**: defer dynamic-content translation/providers until #974 restrictions, consent, access and audit are independently verified.

No application runtime changes, migrations, credentials, machine translation calls or production activation are in scope for this document-only PR.
