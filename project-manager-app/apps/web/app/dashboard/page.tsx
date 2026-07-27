import { redirect } from "next/navigation";

// This top-level route pre-dates the per-role /client|/worker|/admin/dashboard
// split. It had no live inbound link anywhere in the app, and its own data
// fetching never looked at the visiting user's session at all — it read
// SEMSE_TENANT_ID/SEMSE_ORG_ID/SEMSE_USER_ID/SEMSE_ROLES server env vars
// (defaulting to OPS_ADMIN) regardless of who requested the page, then always
// rendered all-zero KPIs plus an internal "Mission Control" migration banner
// to whoever landed here — client included. See AUDIT_REMEDIATION_PLAN.md 1.6.
//
// The real fix lives in middleware.ts, which now intercepts `/dashboard`
// before it reaches this component and redirects to the visitor's actual
// role-appropriate dashboard (or /login with no session) — that's the only
// place that can resolve "which dashboard" correctly, since it already
// decodes the session cookie. This page component is unreachable through
// normal navigation as a result; it only exists as an inert fallback in case
// the middleware matcher config is ever changed to exclude this path.
export default function LegacyDashboardRedirect() {
  redirect("/login");
}
