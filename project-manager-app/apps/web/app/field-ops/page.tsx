import { redirect } from "next/navigation";

// This top-level route was a ~90%-duplicate, strictly worse copy of
// /worker/field-ops (missing the Tracker tab entirely, divergent/raw error
// extraction instead of normalizeErrorMessage, silently swallowed any error
// containing "not configured", no i18n, no NotificationBanner). It had no
// live inbound link anywhere in the app (the only nav entry that ever
// pointed here, app/nav.tsx's `Nav` component, is itself dead/unused code —
// nothing imports it) and no back-link to the real page.
//
// Redirecting instead of deleting outright so any bookmarked/typed URL still
// lands somewhere useful. /worker/field-ops itself is behind the normal
// (app) layout's role-aware auth/RBAC, same as every other /worker/* route.
// See docs/AUDIT_REMEDIATION_PLAN.md 2.7.
export default function LegacyFieldOpsRedirect() {
  redirect("/worker/field-ops");
}
