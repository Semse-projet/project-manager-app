"use client";

import { StatusBadge } from "@semse/ui";
import { useCapabilityState } from "../../lib/capability-context";
import { deriveActiveCapability } from "../../lib/capability";
import { useLanguage } from "../../lib/language-context";

/**
 * Read-only indicator of the capability (CLIENT/PRO/WORKER) the user is
 * currently acting under, derived from the open project's org — never a
 * saved preference (spec: universal-identity-multi-role.spec.md §5).
 * There is no manual switcher: outside an open-project context there is no
 * single correct default to show, so the indicator hides itself entirely.
 */
export function CapabilityIndicator() {
  const { capabilities, activeProjectOrgId } = useCapabilityState();
  const { t } = useLanguage();

  const active = deriveActiveCapability(capabilities, activeProjectOrgId);
  if (!active) return null;

  const label = t(`capability.${active.role}`);
  return <StatusBadge variant="info" size="sm" text={label} />;
}
