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
migration_status: "NOT_APPLICABLE"
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
  - docs/specs/ui/localization-architecture.pilot.md
  - docs/specs/ui/localization-architecture.plan.md
  - docs/specs/ui/localization-architecture.tasks.md
  - docs/specs/ui/localization-architecture.checklist.md
  - docs/specs/ui/localization-architecture.analyze.md
  - docs/architecture/ADR-047-semse-ui-localization-runtime.md
  - apps/web/lib/language-preference.ts
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
last_verified: "2026-10-27"
---


# Spec: Internacionalización ES/EN de SEMSE

> Contrato SDD 2.0 EN REVISIÓN. Las decisiones D1–D7 no están aprobadas. El alcance actual es DOCUMENTACIÓN; una futura implementación requiere contrato APPROVED, ADR del runtime y PR separados. Auditoría histórica y requisitos I18N-01..16 se conservan como anexo normativo propuesto.

## 1. Problema y resultado

**Para quién:** CLIENT, PRO, WORKER, OPS_ADMIN y usuarios públicos autorizados.

**Problema:** los catálogos ES/EN parciales o no conectados a las vistas producen mensajes sin traducir y formatos regionales inconsistentes; el asistente de publicación mezcla etiquetas en español, formateo USD fijo en en-US y borradores guardados independientemente del idioma.

**Resultado esperado:** paridad funcional comprobada por recorrido y por rol, 0 claves técnicas visibles, preservación de datos/permisos y proceso de aprobación de traducciones crítico, versionado y reversible.

## 2. Alcance

**Incluido:** inventario de textos UI y API de presentación; catálogos/esquemas semánticos ES/EN; compatibilidad con `useLanguage`; piloto de los cuatro pasos `/client/jobs/new`; SSR/hidratación; pseudolocalización; validadores AST/JSON, source digest y parámetros; formatos de moneda/fecha; revisión bilingüe de acciones de riesgo; pruebas y rollback.

**Fuera de alcance:** traducción externa en render; traducir libremente contratos, archivos Evidence, chats/RAG o descripciones del usuario; rutas SEO públicas sin aprobación; cambiar reglas de cobro/escrow, permisos, identidad, FSM o montos; desplegar al completar esta documentación.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| CLIENT | Los permisos vigentes de jobs/intake; sin permiso nuevo por i18n | Su cuenta y los Jobs autorizados | Cambiar idioma de visualización y completar wizard | Publicar un Job de otro usuario ni autorizar pagos por traducción |
| PRO | Permisos vigentes de propuestas y trabajo | Recursos asignados a su org/cuenta | Leer etiquetas ES/EN | Acceder a datos de otra organización por cambiar idioma |
| WORKER | Permisos vigentes de tareas/evidencia | Trabajos y tareas asignados | Usar UI y ayudas traducidas | Convertir etiquetas en permisos o aprobar evidencia automáticamente |
| OPS_ADMIN | Permisos reales de administración | Scope según políticas de administración, sin superusuario añadido | Revisar UI administrativa | Ver originales privados ajenos ni RAG sin acceso |
| Público | Ninguno nuevo | Rutas públicas existentes | Ver UI pública localizada cuando esté aprobada | Obtener rutas privadas, contenido de usuario o documentos privados |

- **Tenant boundary:** todo contenido dinámico/derivado debe verificar ACL en cada lectura; nunca reutilizar caché cross-tenant ni cross-org. Recursos UI estáticos aprobados pueden compartirse globalmente, sin datos sensibles.
- **Ownership:** el backend continúa siendo autoridad; cambiar locale no altera sesión, rol, `organizationId`, `projectId`, acciones autorizadas o `canRelease`.
- **Step-up y revisión humana:** ningún permiso nuevo ni cambio de pagos. Textos sensibles requieren revisión de dominio/legal. Exposición externa queda supeditada a DEC-PLATFORM-001 niveles 2/3.
- **Privacidad/auditoría:** no guardar PII en catálogos ni logs de fallos de traducción; registrar versión de recurso y aprobación editorial, no contenido de negocio privado.

## 4. Escenarios y criterios de aceptación

### P1 — CLIENT publica trabajo sin perder datos al cambiar idioma

```gherkin
DADO un CLIENT autenticado con un borrador que contiene categoría, detalles, archivos e importe USD
CUANDO cambia de español a inglés y regresa durante los pasos 2 y 3
ENTONCES todos los controles y errores muestran el idioma correcto
Y el Job, IDs, fechas de negocio, minor units, moneda, permisos, archivos y draft se preservan
Y no se emite un segundo POST ni un efecto económico nuevo
```

### P1 — Acceso y sesión aislados por idioma

```gherkin
DADO CLIENT A con idioma ES y CLIENT B con idioma EN en sesiones distintas
CUANDO ambos navegan y consultan recursos de su alcance
ENTONCES SSR, HTML lang y cliente coinciden dentro de cada sesión
Y ninguna caché ni respuesta contiene datos, idioma privado o autorización del otro
```

### P1 — Bloqueo editorial

```gherkin
DADO una clave de pago crítica con variable faltante o digest desactualizado
CUANDO el validador compara catálogo ES, EN y metadatos de aprobación
ENTONCES falla el gate de publicación
Y ningún texto jurídico obsoleto ni clave interna llega al usuario
```

Casos borde: URL prefill, desconexión, locale inexistente, mensaje vacío, montos decimales, horario de verano, cambio concurrente, adjuntos que exijan reselección, error API seguro, consentimientos revocados, rollback de catálogo.

## 5. Contratos

### API / BFF (sin endpoints nuevos aprobados)

```yaml
auth: "El contrato actual de cada ruta no cambia"
permissions: "Backend guard existente; locale no concede permisos"
input_schema:
  presentationLocale: "es | en, validado, solamente si la ruta lo contempla"
output_schema:
  errorCode: "Código semántico estable"
  safeParams: "Parámetros permitidos, sin datos sensibles"
errors:
  400: "Locale no soportado si el endpoint recibe ese campo"
  401: "No autenticado, se conserva"
  403: "Prohibido por política backend, se conserva"
  404: "Recurso ausente o no visible, se conserva"
  409: "Estado/revisión editorial obsoleta donde aplique"
effects:
  audit_log: "Sin cambios de estados de negocio"
  domain_event: "Ninguno por elegir idioma"
  sse: "Sin necesidad para catálogo estático"
  payment_governance: "Sin cambio"
```

### UI

```yaml
surfaces: ["/client/jobs/new", "client", "worker", "admin", "protools", "marketplace", "prometeo-ui-static"]
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior:
  - "Textos y aria-label equivalentes ES/EN"
  - "Sin claves técnicas visibles ni pérdida de drafts"
  - "Cambio de idioma preserva datos, autorización y moneda"
  - "Catálogos aprobados; fallback seguro"
```

### Agente / Prometeo

No se añade herramienta. Sólo se admite locale de presentación donde ya exista; RAG, documentos, cachés derivados y traducción privada **fuera de alcance** hasta resolver #974/#987 y una aprobación independiente de diseño/seguridad.

## 6. FSM, eventos y reconstrucción

- **Estado de negocio:** sin cambios en FSM de Job, Evidence, Approval o Payment.
- **FSM editorial propuesta:** `new → machineDraft/translated → inReview → approved → published`; transiciones `outdated/revoked` por cambio del original, glosario o retirada de aprobación.
- **Evento/outbox:** ninguno nuevo para el piloto UI estático. Versionado en Git y trazabilidad PR SHA.
- **Idempotencia/replay:** re-render de locale no invoca mutaciones ni duplica envíos; rollback usa catálogo versionado.
- **Gobernanza:** se mantienen `docs/foundation/DOMAIN_INVARIANTS.md` y `EVENT_CATALOG.md` sin cambios.

## 7. Datos y migración

- **Estado de código verificado en `main` (2026-10-27):** `apps/web/lib/language-preference.ts` valida la cookie `semse-language`; el layout raíz resuelve la preferencia en SSR y establece `<html lang>`/`InitialLanguageProvider`. El cliente sincroniza cookie y `localStorage`; existe `tests/unit/language-preference-cookie.test.ts` y [smoke local histórico](../../reportes/2026-10-23_idioma-sin-destello.md). **No es preferencia de cuenta ni prueba de cobertura por rol.** Véase [ADR-047 PROPOSED](../../architecture/ADR-047-semse-ui-localization-runtime.md).
- **Auditoría estática del 2026-10-26:** catálogo de `main` con 1,182 claves ES/EN, 0 claves faltantes entre idiomas y 0 duplicadas encontradas por extracción textual; campos de idioma no encontrados en los modelos Prisma `User`/`UserProfile`. Véase [análisis de consistencia y D4](localization-architecture.analyze.md). Paridad no prueba cobertura ni SSR.
- **D4 pendiente:** la opción A de cookie SSR por navegador **ya está implementada parcialmente**, pero falta verificar sesiones A/B, dispositivos y cobertura real. La opción B —campo Prisma/account preference y ruta autenticada— exigiría migración aditiva, autorización, compatibilidad expand/contract y rollback. **No seleccionar B implícitamente ni duplicar el provider actual.**
- **Metadata actual:** `migration_status: NOT_APPLICABLE` describe este PR sólo documental; reevaluar antes de APPROVED si D4 implica Prisma, marcando PENDING y endpoints relacionados entonces.
- **Backfill:** ninguno autorizado. **Drift:** verificar migraciones si B se elige; prohibido `db push` en producción.
- **Compatibilidad:** mantener claves viejas con adaptador, versiones de catálogo y rollback sin alterar datos de Jobs o firmas.

## 8. Observabilidad, despliegue y activación

- **Métricas propuestas:** claves sin traducir por módulo/locale, coberturas reales por ruta, error de digest/placeholder, fallos de cambio de idioma, SSR hydration mismatch, tasa de abandono del wizard. Sin PII.
- **Logs:** clave semántica y versión/hashes; no incluir texto privado, secretos, tokens o descripciones de cliente.
- **Health/readiness:** no interpretar 200 como smoke bilingüe.
- **Flags/allowlist:** piloto no productivo aislado; no flags de Prometeo ni proveedores de traducción activados.
- **Canary/rollback:** versión anterior de catálogos y selección de runtime anterior si el spike es reversible; probar en cuentas autorizadas.
- **Producción:** registrar SHA, approvals, CI y smoke en staging antes de solicitar despliegue; este PR permanece sin activación.
- **Owner:** semse-core con revisión de riesgo conforme DEC-PLATFORM-001.

## 9. Tests requeridos

- [ ] Unitarios AST/JSON: duplicados, faltantes, valores vacíos, placeholders por nombre/tipo, ICU/plurales, HTML inseguro, digest fuente y versión de glosario (I18N-01/02/03/05/06/07/09).
- [ ] Pruebas de dominio invariante: presupuestos USD minor units, transacciones, fecha local y UTC, `canRelease`, RBAC y estados (I18N-04/08/15).
- [ ] UI/SSR/hidratación: formularios + adjuntos, URLs prefill, errores/loading/degraded, usuarios concurrentes A/B, cambio de idioma y rollback (L01–L12).
- [ ] Pseudolocalización móvil (320–390px) y accesibilidad teclado/lectores de pantalla (I18N-10/11).
- [ ] Negativos de aislamiento de tenant/org/proyecto, sólo si una futura traducción dinámica es autorizada (I18N-13, #974/#987).
- [ ] Smoke autenticado por CLIENT, PRO, WORKER, OPS_ADMIN. Ninguno se declara PASS por sólo existir en checklist.
- **Archivos de tests propuestos (no creados):** `tests/unit/localization-catalog-validation.test.mjs`, `tests/unit/localization-runtime-contract.test.mjs`, `tests/e2e-semse/localization-client-wizard.spec.ts`. No añadirlos a `related_tests` hasta existir.

## 10. Mapa de implementación

| Capa | Archivos/punto de integración | Responsabilidad |
|---|---|---|
| UI y adaptador | `apps/web/lib/language-context.tsx` | Runtime único preservando `t(key)` durante la transición |
| Wizard | `apps/web/app/(app)/client/jobs/new/page.tsx` | Pasos, errores, fechas, moneda, adjuntos y borrador |
| Layout SSR | `apps/web/app/layout.tsx` | Atributo HTML lang/locale coherente y metadatos |
| Protección | `apps/web/middleware.ts` | No debilitar sesión ni permisos |
| API/BFF | `apps/web/app/api/semse/*` y rutas existentes | Códigos semánticos, parámetros seguros y locale sin autoridad |
| Dominio datos | `packages/db/prisma/` sólo si D4 autoriza persistencia | Migración opcional y reversible |
| Tests | `tests/unit/*`, `tests/e2e-semse/*` | Paridad semántica, seguridad y UX |
| Gobierno | SDD + plan/tasks/checklist + ADR para D1 | Trazabilidad, aprobaciones y gates |

## 11. Investigación externa

Tres líneas independientes de investigación primaria para decisiones del diseño; describen orientación, **no certifican** aplicación en SEMSE:

| Investigación | Fuente | Aplicado ahora | Backlog | Descartado |
|---|---|---|---|---|
| App Router Next 15 y locale | https://nextjs.org/docs/15/app/guides/internationalization | Diccionarios/versionado y test SSR + HTML lang | Evaluar rutas locales sólo con decisión SEO | Reescribir rutas públicas automáticamente |
| Composición middleware de next-intl | https://next-intl.dev/docs/routing/middleware | Comparativa técnica sin cambiar auth | Spike aislado de integración y ADR D1 | Sustituir middleware RBAC por un locale proxy |
| Pseudolocalización y pruebas funcionales | https://learn.microsoft.com/en-us/globalization/testing/how-to-perform-internationalization-testing | Pruebas de expansión e inspección de textos fijos | Múltiples idiomas en futura fase | Dar por aprobadas traducciones reales sólo con pseudo |
| Mantenimiento de traducciones y digest | https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableResource | Proponer source-hash/outdated y versión por catálogo | Implementar validador Git | Copiar la API GraphQL de Shopify |

## 12. Gates de cierre

- [x] Spec indexado y reconciliado a `main` en el PR documental.
- [x] Contrato propuesto con roles, API/UI, FSM, datos y seguridad descritos.
- [x] Plan, tareas y checklist escritos **en estado pendiente**, sin implementación.
- [ ] Ratificar D1–D7 y convertir [ADR-047](../../architecture/ADR-047-semse-ui-localization-runtime.md) de PROPOSED a ACCEPTED antes de cambiar el runtime o sus dependencias.
- [ ] Resolver gaps y aceptar análisis spec↔plan↔tasks↔checklist (véase [analyze](localization-architecture.analyze.md)).
- [ ] Revisar D4 y fijar si `migration_status` sigue N/A o pasa a PENDING.
- [ ] Revisión automatizada sin bloqueantes del último SHA y aprobación explícita del propietario conforme DEC-PLATFORM-001.
- [ ] CI verde sobre HEAD que se pretende fusionar, además de validación `spec:validate:strict`, `spec:index:check`, `spec:audit-plan-coverage`.
- [ ] Tras APPROVED: tests antes de código, build, smoke ES/EN real, seguridad, rollback y aprobaciones legales en los PR de implementación.
- [ ] Merge/deploy/activación verificadas **por separado**. No escribir VERIFIED sin producción verificable.

## Anexo — auditoría original y requisitos de calidad


> REVIEW is not approval to replace libraries, release new translations, turn on provider calls, or add public routes. The snapshot below is historical (`38d7cb3a`) and MUST NOT be interpreted as the current `main` baseline; see the reconciliation checkpoint and current-source analysis below. This is not production evidence.

### Historical as-is snapshot — commit `38d7cb3a` (not current `main`)

- `@semse/web` uses Next.js **15.5.27**, React 19, and the App Router; client components coexist with server-renderable routes. It is **not** a conventional standalone React SPA.
- `apps/web/lib/language-context.tsx` already exposes `LanguageProvider`, `useLanguage()`, `language`, `setLanguage` and `t(string)`. Flat ES and EN maps contain **759 unique entries each** at the audited commit, with equal key sets and no duplicate keys found by static key extraction. This measures dictionary parity, **not page coverage**.
- At this historical snapshot, fallback was `T[language][key] ?? T.en[key] ?? key` (English and then a raw technical key); `semse-language` was persisted in browser localStorage after mount. **This is superseded for SSR preference:** current `main` reads the validated `semse-language` cookie in the root layout and initializes `InitialLanguageProvider`; account-level cross-device preference is still not established.
- BuildOps, navigation, offers, contributors and other screens use the existing API; an immediate provider swap would break callers. The job-posting wizard (`apps/web/app/(app)/client/jobs/new/page.tsx`) still uses untranslated step labels, and money formatting uses `en-US` independently of the UI language.
- Public metadata/OG currently contains Spanish text, `og:locale = es_MX`, and `robots: { index: false }`. **Multilingual public SEO is a separate explicitly gated decision**, not an automatic requirement of this phase.
- At this historical snapshot, i18n PRs #968, #969, #970 and #973 were pending. **Current status (2026-10-27): #968, #969 and #970 were merged into `main`; #973 remains open and CI-green but not merged.** Do not conflate #973's candidate catalog with `main`, and do not bypass issue #974 / security PR #987 for Prometeo.

**Proposed D1–D7 disposition and executable pilot test matrix:** [localization-architecture.pilot.md](localization-architecture.pilot.md). This companion plan is **REVIEW-only** and cannot supersede the SDD delivery states, #974/#987 security gate, or an explicit adoption decision.

### Reconciliation checkpoint — 2026-10-26 (documentation only)

- This SDD originally audited the then-current `main` at `38d7cb3a`. Its 759 ES / 759 EN key baseline and hard-coded wizard findings are **historical measurements**, not assertions of the latest default-branch count.
- Internationalization PRs **#968 (2026-10-19), #969 (2026-10-20), and #970 (2026-10-20) have now been merged into `main`**. Their route coverage and smoke evidence must be treated separately from the remaining architecture decisions D1–D7.
- **#973 remains open** and must not bypass the Prometeo document-access safeguards in **#974 / PR #987**; #987 is now ready for review (not draft) but has no independent security sign-off or production release approval.
- The previous failures of GitHub Actions CI run **#4232 (ID 39288712379)** were superseded by a successful rerun for prior head `0b1c10a8`: `quality-gates`, `unit-coverage`, and `e2e` each completed with `success`. This does **not** certify real authenticated ES/EN staging smoke, nor checks for the reconciled head.
- Merge `main` into this documentation branch using an explicit two-parent integration commit with `main` as the file tree base, preserving every unrelated merged change. The only delivered changes relative to that `main` should be this SDD, its pilot plan, and one regenerated-compatible `SPEC_INDEX` row.
- The proposal stays `REVIEW`; neither PR merge nor runtime activation is approved by successful CI alone.

### Governance alignment — DEC-PLATFORM-001 (2026-10-26)

- Apply the accepted [DEC-PLATFORM-001](../../architecture/DEC-PLATFORM-001-solo-maintainer-review.md) to reviews and merges while SEMSE has only one authorized maintainer. This document-only PR is **risk level 1**: final-head CI green, at least one linked automated review with no unresolved blocking findings, and an owner approval comment that records SHA/date/scope. A green CI run is **necessary but not sufficient**.
- A subsequent code change affecting authenticated locale, cookie/session handling, cross-tenant caches, authorization, private-source translation, payments or consent may meet **level 2**: level-1 evidence plus two independent automated tools, negative real-PostgreSQL tests, 24-hour cooling period, and owner checklist review. Classify the implementation PR on its actual exposure before proceeding.
- Any **level-3 production activation or external exposure of sensitive data/payment functions** still requires a genuine external human security assessment, allowlisted canary and rollback. Automated reviews never impersonate this signoff.
- This governance exception does **not** waive human bilingual domain/legal review of sensitive content (D6), nor security scopes, legal consent, validated translations, or separate production authorization.

### Target decision

**No second translation system for the same screens.** Perform a small compatibility spike comparing:

1. **Preferred candidate:** `next-intl` on Next.js App Router, with per-request server locale and bundled versioned JSON; validate Next 15 / React 19, Server and Client Components, current middleware/authorization boundaries, and build output on this repository.
2. **Lower-risk fallback:** retain the existing `useLanguage` adapter, extract its dictionaries to versioned ES/EN module JSON and strengthen SSR/CI/preferences without replacing the runtime immediately.
3. `react-i18next` is not the default for `@semse/web`; consider it only for independently developed React-only apps, not as a second global provider layered over Next.

Choose **one** primary localization runtime after measuring the pilot. Preserve compatibility for existing `t("nav.dashboard")` and similar key callers during migration via an explicit adapter; do not silently change message syntax or dynamic business-status keys.

### Language contract

- Supported UI languages for v1: `es` and `en`; choose `es` for the declared product fallback (requires an approved migration of existing English fallback behavior).
- Resolve authenticated language before initial private SSR render, without reading `localStorage` on the server. Proposed order: explicit valid route language when supported; saved account preference; validated device/browser preference; Spanish fallback. Define cookie/account synchronization and avoid cross-tenant caching or hydration flicker.
- Treat `uiLanguage`, `formatLocale`, `timeZone`, `measurementSystem`, `marketCountry`, and transaction currency as independent fields. Changing language must not change money, stored timestamps, financial precision, project identifiers, role, business status, or contractual meaning.
- Root `html.lang`, accessible labels, browser metadata and client hydration must agree with the chosen locale. Locale switching preserves route, form drafts and authenticated session state.
- Do not introduce `/es` and `/en` public routes, canonical or hreflang until SEO policy and `robots: noindex` are explicitly reconciled.

### Catalog migration contract

- Git-tracked, approved, release-versioned ES/EN JSON is the single source of truth, with domain namespaces. Draft target domains: `common`, `landing`, `auth`, `jobs`, `proposals`, `buildops`, `evidence`, `payments`, `trust`, `prometeo`, `validation`.
- During migration, maintain an immutable key mapping from flat `ui.*`, `page.*`, `status.*`, `buildops.*`, `contributors.*`, etc., to namespace paths. Avoid a forced wholesale rename until every caller is migrated.
- JSON stores only runtime messages; reviewer notes, glossary, semantic meaning, risk and approval hashes live in separate metadata. Message IDs describe domain meaning, not layout or English/Spanish prose.
- Do not concatenate translated sentence fragments; validate parameters, plurals/ICU syntax against the selected runtime, safe links and formatting, and do not render arbitrary translated HTML.
- The server must return stable domain error codes plus safe parameters; a presentation mapping localizes those codes. No translated message may alter the rules governing milestones, evidence, grants or payments.
- Display `escrow`/fund-protection wording only after legal/functional approval. The current site's marketing copy is not evidence of contractual escrow guarantees.

### Static vs dynamic translation boundary

- All ordinary buttons, labels, controls, status labels and error messages load **without runtime machine translation**. No DeepL or Google calls during render.
- Human-reviewed strings only in releases. Machine output is a backend/CI editorial draft with `new → machineDraft → inReview → approved` plus source-hash invalidation.
- User-provided project descriptions, chats, evidence documents and AI outputs are **separate versioned business data**. The optional future `Translate` action preserves the source, labels derived output and confirms object-level authorization before serving original or cached derivatives.
- Never send private Prometeo RAG fragments, evidence, personal data, payments or contracts to third-party translation providers without separately documented consent, policy review, tenant/org scope, residency and retention controls. Issue #974/PR #987 security clearance is a release dependency for translation touching Prometeo.
- Keep tenant/org-specific derived translations isolated; cache key must account for original content version/source hash, authorization scope, source and target language, provider/model and glossary version. Do not cache by plaintext equality across organizations.
- The provider benchmark (DeepL vs Google) is deferred; no provider credential, SDK, worker, backfill or external call is authorized by this REVIEW spec.

### Pilot and acceptance

**Proposed pilot:** full client job-posting wizard, not just one button. First execute a short Next App Router compatibility spike on an isolated branch; preserve current wizard drafts and server auth boundaries.

1. Record inventory for each role and route: static UI strings, server errors, `aria-label`, placeholders, emails/notifications, page metadata and untranslated business data. Revalidate the current `main` catalog (1,182 ES / 1,182 EN in the 2026-10-27 audit) before any extraction; 759/759 was a historical baseline, not the current count. Report unmerged #973 additions separately (candidate 1,317/1,317), without claiming their presence in `main`.
2. Extract namespaces to a Git-owned source folder; introduce a compatibility adapter retaining existing `useLanguage` callers. Import the same approved resources on server and client without a mutable cross-request singleton.
3. Pilot wizard ES/EN labels, validation, error codes, status and confirmation. Switching locale cannot erase intake drafts, change posted price/currency, change authorization or expose raw keys.
4. Gate CI for duplicate JSON keys, identical semantic coverage, missing parameters, valid plural forms, unapproved/high-risk changes, unresolved raw keys, broken links, and consistency with `@semse/web` build.
5. Add SSR/hydration concurrency tests (distinct sessions es/en); navigation switch, protected session restoration, screen-reader labels, keyboard navigation, mobile text expansion and rollback to previous catalog version.
6. Pilot release only after all workflow strings reviewed in both languages, zero technical keys displayed, confirmed business-logic neutrality and successful clean rollback.

### Decisions awaiting approval

- **D1**: accept an isolated `next-intl` compatibility spike before adopting its runtime, or maintain the existing adapter only.
- **D2**: pilot the entire client job-posting wizard (`/client/jobs/new`), rather than starting with less critical navigation.
- **D3**: switch missing-message fallback from English to Spanish and define monitoring for missing keys.
- **D4**: specify authoritative authenticated account locale and safe cookie/device synchronization; this is not currently shown in the provider.
- **D5**: defer multilingual SEO while the site uses `robots: noindex`.
- **D6**: require legal/product approval for translated escrow, payment, dispute and contractual claims.
- **D7**: defer dynamic-content translation/providers until #974 restrictions, consent, access and audit are independently verified.

### Normative quality annex — ES/EN (proposal, 2026-10-19)

> **Status and precedence:** I18N-01 to I18N-16 are proposed acceptance requirements for approval under this same SDD, not evidence of implementation or permission to ship. Decisions D1–D7 above remain open. This section extends the existing catalog, privacy and pilot contracts; it does not create a second localization runtime or authorize translation vendors. Existing #968 → #969 → #970 changes must be reconciled in order; #973 is additionally subject to #974/#987 security release gates.

#### Quality and release invariants

- Treat localization as a functional requirement: a new/changed user-facing workflow is not complete unless both ES and EN pass review, accessibility and functional acceptance.
- Separate the UI message catalog (Git-versioned JSON per domain, ultimately selected by the approved runtime) from editorial metadata and business/user-generated content. Keep stable semantic IDs and an explicit compatibility map for legacy flat keys.
- Changing display language must never mutate stored money, transaction currency, quantities, unit conversions, UTC instants, authorized roles, domain states, contracts, signature artifacts, payment governance or project/tenant scope.
- Human translation approval is mandatory for financial, dispute, consent, employment offer, compensation, escrow and legally significant claims. Do not imply that release approval is the same as evidence approval, or that a translation grants financial custody or legal assurances.
- Machine translation may prepare editorial drafts only after a separate provider approval. No machine translation during UI rendering, and no processing private source documents/RAG/evidence externally without per-object authorization, explicit consent as applicable, and verified #974/#987 protections.
- Continue to defer public bilingual SEO routes while the current robots noindex policy is in force. Do not make SEO or provider integration implicit side effects of a UI catalog change.

#### Verifiable requirements and blocking acceptance gates

| ID | Proposed MUST requirement | CI / staging acceptance |
|---|---|---|
| I18N-01 | Version-controlled ES/EN JSON resources per semantic domain, with stable keys, no duplicate keys and parity for affected flows. | Reject invalid JSON, duplicates or missing keys in either language; key-count parity alone is not proof of route coverage. |
| I18N-02 | Store editorial context outside runtime catalog: key, description, surface, risk, sourceLocale, sourceHash, translationSourceHash, status, reviewer, reviewedAt and glossaryVersion. | Metadata required for each new or changed message; absence of context or approval blocks critical releases. No PII in metadata. |
| I18N-03 | Preserve named placeholders and types across languages, according to the approved message runtime (ICU/MessageFormat where supported). | Reject deleted/renamed parameters, unsafe markup, invalid plural/select clauses or protected IDs substituted into translations. |
| I18N-04 | Use Intl regional formatting, with explicit uiLanguage, formatLocale, timeZone and currency/measurement context rather than conflating them. | Test 0/1/2/many, currency and date behavior; switching ES/EN must preserve raw prices and their currency codes. |
| I18N-05 | Maintain reviewed, versioned construction/business terminology and contextual notes for jobs, proposals, milestones, evidence, orders and payments. | Terminology checks flag inconsistent sensitive wording; glossary changes re-open affected entries. |
| I18N-06 | Implement auditable states new → machineDraft/translated → inReview → approved → published, with explicit revoke/outdated outcomes. | Only current, reviewed messages ship for critical flows; no self-asserted automated human approval. |
| I18N-07 | Bind every translation approval to a deterministic digest of the canonical source text, plus relevant glossary version. | Source/glossary change marks prior translation outdated; reject outdated critical translations in build/release. A Git manifest suffices initially; no DB migration assumed. |
| I18N-08 | Synchronize supported locale resolution across authenticated account, safe cookie, SSR, hydration, navigation and html.lang, subject to D3/D4 approval. | Independent ES/EN sessions must not bleed content; no locale flash, session change or lost draft when toggling. |
| I18N-09 | Have APIs supply stable presentation-safe error codes with safe parameters, never use translated prose as a business decision field. | Unknown errors render safe localized fallbacks; no raw exceptions, leaked names or technical keys in user-visible UI. |
| I18N-10 | Use test-only pseudolocalization with expanded strings, accents and direction/layout stress where practical. | Detect clipping, fixed-width buttons, untranslated strings, unsafe concatenation, overlaps and inaccessible controls. |
| I18N-11 | Run real ES and EN smoke tests on mobile and desktop for CLIENT, PRO, WORKER and ADMIN, including loading, empty and failure states. | Retain auditable screenshots/results per role; zero raw keys; business actions remain equivalent. Pseudolocale is not a substitute. |
| I18N-12 | Version catalogs and releases with reproducible build inputs and a tested rollback. | Previous approved resources restore without altering business records or migration state. |
| I18N-13 | Keep private, user-supplied or AI-created content out of UI auto-translation; future derivatives require per-object authorization and scope-safe caches. | Negative same-tenant org A/B and cross-tenant tests; no cross-project, RAG citation, document or cache exposure. #974/#987 remain independent release blockers. |
| I18N-14 | Stamp generated notification/email/PDF templates with locale and immutable templateVersion; preserve signed document originals. | Audit reconstructs the displayed/sent version; changing locale never rewrites signed artifacts or payment proofs. |
| I18N-15 | Require bilingual domain/legal review for sensitive commands and confirmations: accept/reject offers, evidence approval, payment requests, release funds, disputes, signatures. | Verify positive/cancel paths, action semantics, permissions and no misleading legal guarantees in both languages. |
| I18N-16 | Include locale completeness in the definition of done for every new or modified user-facing feature. | Fail PR/release gate if required ES/EN resources, tests or human reviews for touched critical workflows are missing. |

#### Initial bilingual domain glossary (provisional, not legally approved)

| Semantic concept | ES proposed | EN proposed | Distinction |
|---|---|---|---|
| job | Trabajo | Job | Not automatically a project or a work order. |
| project | Proyecto | Project | Can aggregate work; keep entity IDs distinct. |
| estimate | Presupuesto estimado | Estimate | Must not imply a binding agreed price. |
| proposal | Propuesta | Proposal | Not an employment offer. |
| milestone | Hito | Milestone | Completion/approval does not prove funds released. |
| evidence | Evidencia | Evidence | Submitted, approved and rejected are different states. |
| approval | Aprobación | Approval | Evidence approval is not payment authorization. |
| release_funds | Liberar fondos | Release funds | Restricted payment governance action. |
| escrow | Fondos en custodia (only if verified legally) | Escrow | No unverified protection or custody claim. |
| change_order | Orden de cambio | Change order | Preserve approval and contractual authorization. |
| dispute | Disputa | Dispute | Neutral terminology, no prejudgment. |
| business_offer | Oferta laboral | Job offer | Not an active employment contract. |

#### Editorial example: payment confirmation

Illustrative metadata for a **non-approved** message, not approved legal copy:

~~~json
{
  "key": "payments.release.confirmAction",
  "description": "Final confirmation control requesting a milestone-funds release; does not itself authorize a payment",
  "surface": "/client/milestones",
  "risk": "critical",
  "sourceLocale": "es",
  "sourceText": "Confirmar solicitud de liberación de {amount}",
  "placeholders": {"amount": "formattedCurrency"},
  "sourceHash": "<computed SHA-256 of canonical source>",
  "translationSourceHash": "<digest actually reviewed>",
  "glossaryVersion": "<approved-version>",
  "status": "inReview",
  "reviewer": null,
  "reviewedAt": null
}
~~~

These example angle-bracket values are placeholders, not actual computed hashes or approvals. Monetary values must be formatted from explicit amount+currency data; the backend remains the authority for eligibility, ownership and payment effects.

#### Test matrix, deliverables and traceability

1. Inventory actual static UI text, aria labels, validation, user-facing API errors, notification/email templates and public metadata by route and role. Baseline real merged main separately from draft branches: #1003 audited 759/759 keys on its base; draft #968 reports 925/925, #969 1,041/1,041 and #970 1,145/1,145. None of these numbers alone proves app coverage or production deployment.
2. Run isolated Next.js App Router compatibility spike; choose exactly one runtime under D1. Keep existing LanguageProvider callers working via an adapter until replacement is validated. Do not merge the stacked i18n PRs out of order.
3. Pilot the full client job-post wizard, not merely navigation: labels, errors, validation, confirm/cancel, ARIA, formatting, initial server locale, persistence on language switch, mobile overflow, separate concurrent logged-in sessions and successful catalog rollback.
4. Test CLIENT Intake → Estimate → BuildOps → Milestones → Evidence → Approval → Payment and disputes; PRO/WORKER marketplace, ProTools, offers and field ops; ADMIN Mission Control; Prometeo static UI and localized request metadata only, without enabling private-content translation.
5. Add negative CI fixtures for JSON duplicate keys, missing/changed placeholders, stale source digest, unapproved critical string, unsafe interpolation, unknown raw key, UI overflow, divergent business payload, cross-organization leakage and rollback failures. Differentiate static catalog checks from authenticated staging E2E and independent security validation.
6. Require evidence per release: reviewed glossary/catalog version, reviewer identity and approval time, linked spec/PR/commit, green CI on final merge head, ES/EN staging smoke artifacts per role, security and legal signoff for affected critical flows, deploy provenance and rollback verification. Keep code_status / ci_status / merge_status / deploy_status / activation_status truthful; none is completed by documentation alone.

#### Reference provenance and corrected source mapping

- Shopify: https://shopify.dev/docs/apps/build/localize-your-app (externalized texts, formatting, flexible UI).
- Shopify GraphQL resource: https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableResource (source digest and outdated translation semantics; adopt the principle, not the API).
- Microsoft: https://learn.microsoft.com/en-us/globalization/methodology/pseudolocalization and https://learn.microsoft.com/en-us/globalization/testing/how-to-perform-internationalization-testing (pseudo- and functional test methodologies).
- Android: https://developer.android.com/guide/topics/resources/string-resource (illustrative string resource guidance, not a Next.js dependency).

The earlier user-provided bracketed reference numbers [8], [16] and [19] were mismatched to their corresponding URLs. Link sources by URL/title rather than those indices.

No application runtime changes, migrations, credentials, machine translation calls or production activation are in scope for this document-only PR.
