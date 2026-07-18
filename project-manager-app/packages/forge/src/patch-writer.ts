import type { ForgePatchPlan, PatchOperation, PatchPlanChange } from "./patch-planner.js";

export type PatchResultEntry = {
  path: string;
  operation: PatchOperation;
  previousContent?: string;
  newContent?: string;
  applied: boolean;
  violations: string[];
};

export type ForgePatchResult = {
  mode: "dry-run" | "live";
  decision: "allow" | "deny";
  reason: string;
  results: PatchResultEntry[];
  violations: string[];
  auditTags: string[];
};

export interface PatchWriter {
  apply(plan: ForgePatchPlan): ForgePatchResult;
}

function simulateChange(change: PatchPlanChange): PatchResultEntry {
  const { path, operation, content, diff } = change.proposed;

  if (operation === "delete") {
    return {
      path,
      operation: "delete",
      previousContent: content,
      newContent: undefined,
      applied: true,
      violations: []
    };
  }

  if (!content && !diff) {
    return {
      path,
      operation,
      applied: false,
      violations: ["patch.missing_content"]
    };
  }

  return {
    path,
    operation,
    previousContent: operation === "update" ? "<dry-run-baseline>" : undefined,
    newContent: content ?? diff,
    applied: true,
    violations: []
  };
}

class DryRunPatchWriter implements PatchWriter {
  apply(plan: ForgePatchPlan): ForgePatchResult {
    if (plan.decision === "deny") {
      return {
        mode: "dry-run",
        decision: "deny",
        reason: "Patch plan is denied; cannot simulate application.",
        results: [],
        violations: ["patch.plan_denied"],
        auditTags: ["forge.patch.denied"]
      };
    }

    const results: PatchResultEntry[] = [];
    const seenPaths = new Set<string>();
    const allViolations: string[] = [];

    for (const change of plan.changes) {
      const path = change.proposed.path;

      if (seenPaths.has(path)) {
        const entry: PatchResultEntry = {
          path,
          operation: change.proposed.operation,
          applied: false,
          violations: ["patch.duplicate_path"]
        };
        results.push(entry);
        allViolations.push("patch.duplicate_path");
        continue;
      }

      seenPaths.add(path);
      const entry = simulateChange(change);
      results.push(entry);
      allViolations.push(...entry.violations);
    }

    const decision = allViolations.length === 0 ? "allow" : "deny";
    const reason =
      decision === "allow"
        ? "Dry-run patch simulation completed."
        : `Dry-run patch simulation failed: ${allViolations.join("; ")}`;

    return {
      mode: "dry-run",
      decision,
      reason,
      results,
      violations: allViolations,
      auditTags: ["forge.patch.simulated", "forge.patch.writer"]
    };
  }
}

class LivePatchWriter implements PatchWriter {
  apply(): ForgePatchResult {
    throw new Error("Live patch writing is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createPatchWriter(config?: { mode?: "dry-run" | "live" }): PatchWriter {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LivePatchWriter();
  return new DryRunPatchWriter();
}
