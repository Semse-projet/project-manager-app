import type { ForgeAcceptanceCriterion, ForgeTaskPacket, ForgeVerificationItem, ForgeVerificationMatrix } from "./types.js";
import type { ForgePatchResult } from "./patch-writer.js";
import type { ForgeToolPlan } from "./tool-adapter.js";

export type VerificationProviderInput = {
  task: ForgeTaskPacket;
  patchResult?: ForgePatchResult;
  toolPlan?: ForgeToolPlan;
};

export interface VerificationProvider {
  verify(input: VerificationProviderInput): ForgeVerificationMatrix;
}

function itemId(criterion: ForgeAcceptanceCriterion, index: number): string {
  return criterion.id || `ac-${index}`;
}

function evaluateCriterion(
  criterion: ForgeAcceptanceCriterion,
  patchResult: ForgePatchResult | undefined,
  toolPlan: ForgeToolPlan | undefined
): Omit<ForgeVerificationItem, "id"> {
  const command = typeof criterion.verification === "string" ? criterion.verification : "";
  const statement = typeof criterion.statement === "string" ? criterion.statement : "";
  const text = `${statement} ${command}`.toLowerCase();

  const patchAllowed = patchResult?.decision === "allow";
  const hasCommandRun = toolPlan?.tools.some((tool) => tool.name === "command.run" && tool.allowed) ?? false;
  const hasCodeWrite = toolPlan?.tools.some((tool) => tool.name === "code.write" && tool.allowed) ?? false;
  const hasTestWrite = toolPlan?.tools.some((tool) => tool.name === "test.write" && tool.allowed) ?? false;

  if (/\bsecurity\b/.test(text)) {
    return {
      command,
      required: criterion.required,
      status: "failed",
      evidence: "Security review evidence is not present in dry-run verification."
    };
  }

  if (/\bspec\b/.test(text) || /\bindex\b/.test(text)) {
    return {
      command,
      required: criterion.required,
      status: patchAllowed && hasCodeWrite ? "passed" : "failed",
      evidence: patchAllowed && hasCodeWrite ? "Spec file changes simulated." : "Spec changes were not simulated or not allowed."
    };
  }

  if (/\btypecheck\b/.test(text) || /\btype.check\b/.test(text)) {
    return {
      command,
      required: criterion.required,
      status: patchAllowed && hasCommandRun ? "passed" : "failed",
      evidence: "Dry-run typecheck verification passed."
    };
  }

  if (/\btest\b/.test(text) && !/\bno test\b/.test(text)) {
    return {
      command,
      required: criterion.required,
      status: patchAllowed && hasTestWrite ? "passed" : "failed",
      evidence: "Dry-run test verification passed."
    };
  }

  if (/\blint\b/.test(text)) {
    return {
      command,
      required: criterion.required,
      status: patchAllowed && hasCommandRun ? "passed" : "failed",
      evidence: "Dry-run lint verification passed."
    };
  }

  if (/\bbuild\b/.test(text)) {
    return {
      command,
      required: criterion.required,
      status: patchAllowed && hasCommandRun ? "passed" : "failed",
      evidence: "Dry-run build verification passed."
    };
  }

  if (criterion.required) {
    return {
      command,
      required: true,
      status: "failed",
      evidence: `Unrecognized required criterion could not be verified in dry-run: ${statement}`
    };
  }

  return {
    command,
    required: false,
    status: "skipped",
    evidence: `Optional criterion skipped in dry-run: ${statement}`
  };
}

class DryRunVerificationProvider implements VerificationProvider {
  verify(input: VerificationProviderInput): ForgeVerificationMatrix {
    const { task, patchResult, toolPlan } = input;
    const criteria = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [];

    const items: ForgeVerificationItem[] = criteria.map((criterion, index) => ({
      id: itemId(criterion, index),
      ...evaluateCriterion(criterion, patchResult, toolPlan)
    }));

    const requiredFailed = items.some((item) => item.required && item.status === "failed");
    const passed = !requiredFailed && items.every((item) => (item.required ? item.status === "passed" : true));

    return {
      runId: task.id,
      items,
      passed,
      completedAt: new Date().toISOString()
    };
  }
}

class LiveVerificationProvider implements VerificationProvider {
  verify(): ForgeVerificationMatrix {
    throw new Error("Live verification is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createVerificationProvider(config?: { mode?: "dry-run" | "live" }): VerificationProvider {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LiveVerificationProvider();
  return new DryRunVerificationProvider();
}
