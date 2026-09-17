---
name: semse-security-baseline
description: Quick-reference checklist for the three highest-risk root-cause bug shapes already found in this codebase — IDOR (missing tenant/assignedTo filter), payment status trusted without provider verification, and auth weaknesses (header spoofing, no session revocation). Use before writing any DB query that scopes by resource, any code path that reads/updates payment status, or touching auth.service.ts.
---

# SEMSE security baseline (RC4-RC6)

This is a **quick-reference companion**, not a replacement for `semse-audit-remediation` (which owns the actual backlog, governance gate, and full root-cause list RC1-RC7) or the generic `security-review` skill. Use this one when you need the concrete pattern fast, without re-reading the whole audit plan.

## RC4 — Missing tenantId/assignedTo filter (IDOR)

**The shape, verbatim from the audit's own finding**: a `where` clause omits a scoping field that a **sibling function in the same file already uses correctly** — e.g. `findUnitById` scopes by tenant, `updateUnitStatus` right next to it doesn't. This is the single most mechanically-checkable class of bug here.

**Before writing or reviewing a Prisma query that fetches or mutates by ID**, find the nearest sibling read/write function in the same repository file and diff its `where` clause against yours. If the sibling filters by `tenantId` (or `assignedTo`, `orgId`, whichever scoping field applies to that aggregate) and yours doesn't, that's the bug — don't assume the missing filter was intentional.

**If you find and fix one of these**: note explicitly whether existing data may already have been exposed/modified through the hole. A clean fix does not mean no incident occurred, and this codebase doesn't have enough logging today to know for sure — say so rather than implying the fix retroactively made things fine.

## RC5 — Payment status trusted without provider verification

Highest business-risk category in the backlog. The shape: payment/escrow status is read from a local field or trusted client input instead of being verified against the actual provider (Stripe) state, or a webhook handler updates status without confirming the event is real. **Any change here needs a plan reviewed by a human before implementation** — this mirrors the audit's own governance gate, not a suggestion specific to this skill.

Testing this live is usually not possible without a dedicated Stripe sandbox — if you can't reproduce it against a real webhook event, say explicitly what you verified by reading code versus what remains unverified, rather than claiming full confidence.

## RC6 — Auth weaknesses

Four concrete, already-confirmed instances in this codebase, useful as a checklist of "does my change reintroduce one of these":

- **Header spoofing** — the dev header-auth shortcut (`x-tenant-id`/`x-org-id`/`x-user-id`/`x-roles`, see `semse-rbac-permissions`) is only safe because `AUTH_SECRET` gates it in production. Never let a code path trust these headers when `AUTH_SECRET` is set.
- **Bootstrap token not enforced** — `SEMSE_BOOTSTRAP_TOKEN` must fail closed if unset in production; confirmed already fixed and configured on Railway (`semse-API`/`semse-web`), but a regression here is a full auth bypass.
- **No session/token revocation** — **do not reimplement per-request session verification against the DB.** This was tried before and reverted: it caused 15-second timeouts when Postgres was slow on Railway. `auth.service.ts:127-129` documents this history in code. This is a recorded, conscious architectural tradeoff (security vs. availability), not an oversight — if you think it needs revisiting, that's a product/infra conversation, not a quick fix.
- **Password reset not sending email** — already caused a real user lockout twice in 24h in a prior incident; if you touch the reset-password flow, verify the email actually sends, don't just check the token logic.

## Notas para futuros agentes / hallazgos abiertos

- Esta skill resume patrones ya confirmados; no reemplaza la investigación caso-por-caso que `semse-audit-remediation` ya hizo para los hallazgos `0.4`-`0.8` (IDOR), `0.3` (revocación), `0.12`-`0.17` (dinero) — leé esa skill y el propio `AUDIT_REMEDIATION_PLAN.md` antes de asumir que un hallazgo nuevo es genuinamente nuevo.
- No se armó un checklist equivalente para RC1 (JobStatus casing) ni RC2 (upload flow) acá porque esos son bugs funcionales, no de seguridad — quedan cubiertos por `semse-audit-remediation` directamente.
- Probar IDOR de verdad requiere un segundo tenant de prueba con IDs reales — sin eso, el único resultado posible contra producción es "no encontré nada" (inconclusivo) o, si el fix estuviera roto, exponer datos reales de otro tenant. Ninguno de los dos vale el riesgo sin ese setup — no lo intentes contra producción real bajo ninguna circunstancia.
