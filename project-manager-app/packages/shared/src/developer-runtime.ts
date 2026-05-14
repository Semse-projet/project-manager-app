import type {
  DeveloperRuntimeAutonomyLevel,
  DeveloperRuntimeProviderCapability,
  DeveloperRuntimeRiskLevel,
  DeveloperRuntimeToolName,
} from "@semse/schemas";

export const SEMSE_DEVELOPER_RUNTIME_MODULE = "developer-runtime";

export const SEMSE_DEVELOPER_RUNTIME_EVENTS = [
  "session.created",
  "intent.interpreted",
  "plan.created",
  "approval.requested",
  "approval.resolved",
  "tool.started",
  "tool.finished",
  "tool.failed",
  "validation.started",
  "validation.finished",
  "artifact.created",
  "mission.completed",
  "mission.failed",
] as const;

export type SemseDeveloperRuntimeEvent = (typeof SEMSE_DEVELOPER_RUNTIME_EVENTS)[number];

export const SEMSE_DEVELOPER_RUNTIME_SAFE_TOOLS: readonly DeveloperRuntimeToolName[] = [
  "readFile",
  "listFiles",
  "searchCode",
  "runBuild",
  "runLint",
  "runTests",
  "gitStatus",
  "gitDiff",
  "inspectEnv",
];

export const SEMSE_DEVELOPER_RUNTIME_SENSITIVE_TOOLS: readonly DeveloperRuntimeToolName[] = [
  "runCommand",
  "writeFile",
  "patchFile",
  "installDependencies",
  "requestApproval",
];

export const SEMSE_DEVELOPER_RUNTIME_AUTONOMY_ORDER: readonly DeveloperRuntimeAutonomyLevel[] = [
  "observation",
  "suggestion",
  "safe-execution",
  "supervised-execution",
  "controlled-autonomy",
];

export const SEMSE_DEVELOPER_RUNTIME_PROVIDER_PREFERENCES: Record<
  DeveloperRuntimeProviderCapability,
  "fast" | "balanced" | "deep"
> = {
  reasoning: "deep",
  code_generation: "balanced",
  code_editing: "balanced",
  retrieval: "fast",
  embedding: "fast",
  vision: "balanced",
  classification: "fast",
};

export const SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATES = {
  "pnpm.build.api": "pnpm build:api",
  "pnpm.build.web": "pnpm build:web",
  "pnpm.test.unit": "pnpm test:unit",
  "pnpm.typecheck": "pnpm typecheck",
  "pnpm.smoke.agents": "pnpm smoke:agents",
} as const;

export type SemseDeveloperRuntimeCommandTemplate =
  keyof typeof SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATES;

export const SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATE_POLICIES: Record<
  SemseDeveloperRuntimeCommandTemplate,
  {
    allowArgs: boolean;
    maxArgs: number;
    notes: string;
  }
> = {
  "pnpm.build.api": {
    allowArgs: false,
    maxArgs: 0,
    notes: "Build canonico de API sin argumentos variables.",
  },
  "pnpm.build.web": {
    allowArgs: false,
    maxArgs: 0,
    notes: "Build canonico de web sin argumentos variables.",
  },
  "pnpm.test.unit": {
    allowArgs: false,
    maxArgs: 0,
    notes: "Suite unitaria canonica sin filtros libres.",
  },
  "pnpm.typecheck": {
    allowArgs: false,
    maxArgs: 0,
    notes: "Typecheck global sin banderas dinamicas.",
  },
  "pnpm.smoke.agents": {
    allowArgs: false,
    maxArgs: 0,
    notes: "Smoke oficial de agentes sin argumentos adicionales.",
  },
};

export function resolveDeveloperRuntimeCommandTemplate(
  template: string,
): string | null {
  return SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATES[
    template as SemseDeveloperRuntimeCommandTemplate
  ] ?? null;
}

export function getDeveloperRuntimeCommandTemplatePolicy(
  template: string,
) {
  return SEMSE_DEVELOPER_RUNTIME_COMMAND_TEMPLATE_POLICIES[
    template as SemseDeveloperRuntimeCommandTemplate
  ] ?? null;
}

export function isDeveloperRuntimeSensitiveTool(tool: DeveloperRuntimeToolName): boolean {
  return SEMSE_DEVELOPER_RUNTIME_SENSITIVE_TOOLS.includes(tool);
}

export function normalizeDeveloperRuntimeRisk(
  riskLevel: DeveloperRuntimeRiskLevel,
): DeveloperRuntimeRiskLevel {
  switch (riskLevel) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
    default:
      return "low";
  }
}

export function requiresApprovalForDeveloperRuntimeTool(input: {
  tool: DeveloperRuntimeToolName;
  riskLevel: DeveloperRuntimeRiskLevel;
  autonomyLevel: DeveloperRuntimeAutonomyLevel;
}): boolean {
  const normalizedRisk = normalizeDeveloperRuntimeRisk(input.riskLevel);

  if (normalizedRisk === "critical" || normalizedRisk === "high") {
    return true;
  }

  if (input.autonomyLevel === "observation" || input.autonomyLevel === "suggestion") {
    return input.tool !== "requestApproval";
  }

  return isDeveloperRuntimeSensitiveTool(input.tool);
}

export function canAutoExecuteDeveloperRuntimeTool(input: {
  tool: DeveloperRuntimeToolName;
  riskLevel: DeveloperRuntimeRiskLevel;
  autonomyLevel: DeveloperRuntimeAutonomyLevel;
}): boolean {
  return !requiresApprovalForDeveloperRuntimeTool(input);
}
