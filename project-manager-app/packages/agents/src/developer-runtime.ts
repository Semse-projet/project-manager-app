import type {
  DeveloperRuntimeAutonomyLevel,
  DeveloperRuntimeProviderCapability,
  DeveloperRuntimeRiskLevel,
  DeveloperRuntimeToolName,
} from "@semse/schemas";

export type DeveloperRuntimeAgentRole =
  | "diagnostic-agent"
  | "runtime-agent"
  | "backend-agent"
  | "frontend-agent"
  | "devops-agent"
  | "qa-agent"
  | "doc-agent"
  | "governance-agent"
  | "architect-agent";

export interface DeveloperRuntimeAgentDefinition {
  role: DeveloperRuntimeAgentRole;
  description: string;
  responsibilities: string[];
  allowedTools: DeveloperRuntimeToolName[];
  defaultCapabilities: DeveloperRuntimeProviderCapability[];
  maxAutonomyLevel: DeveloperRuntimeAutonomyLevel;
  defaultRiskLevel: DeveloperRuntimeRiskLevel;
}

export const DEVELOPER_RUNTIME_AGENTS: Record<
  DeveloperRuntimeAgentRole,
  DeveloperRuntimeAgentDefinition
> = {
  "diagnostic-agent": {
    role: "diagnostic-agent",
    description: "Inspecciona repos, errores, stack y bloqueos tecnicos.",
    responsibilities: ["repo inspection", "stack detection", "error triage", "health summary"],
    allowedTools: ["readFile", "listFiles", "searchCode", "runBuild", "runLint", "runTests", "gitStatus", "gitDiff", "inspectEnv"],
    defaultCapabilities: ["reasoning", "classification", "retrieval"],
    maxAutonomyLevel: "safe-execution",
    defaultRiskLevel: "low",
  },
  "runtime-agent": {
    role: "runtime-agent",
    description: "Ejecuta shell, instala dependencias y valida entorno.",
    responsibilities: ["command execution", "dependency install", "env validation", "process runtime"],
    allowedTools: ["runCommand", "runBuild", "runLint", "runTests", "inspectEnv", "installDependencies", "requestApproval"],
    defaultCapabilities: ["reasoning", "classification"],
    maxAutonomyLevel: "supervised-execution",
    defaultRiskLevel: "medium",
  },
  "backend-agent": {
    role: "backend-agent",
    description: "Opera sobre API, Prisma, workers, auth y backend application logic.",
    responsibilities: ["nestjs", "prisma", "api contracts", "worker integrations"],
    allowedTools: ["readFile", "writeFile", "patchFile", "searchCode", "runBuild", "runLint", "runTests", "gitDiff", "requestApproval"],
    defaultCapabilities: ["reasoning", "code_generation", "code_editing", "retrieval"],
    maxAutonomyLevel: "safe-execution",
    defaultRiskLevel: "medium",
  },
  "frontend-agent": {
    role: "frontend-agent",
    description: "Opera sobre React, Next.js, Vite, Tailwind y UX tecnico.",
    responsibilities: ["ui architecture", "frontend fixes", "design-system alignment", "build debugging"],
    allowedTools: ["readFile", "writeFile", "patchFile", "searchCode", "runBuild", "runLint", "runTests", "gitDiff", "requestApproval"],
    defaultCapabilities: ["reasoning", "code_generation", "code_editing", "retrieval"],
    maxAutonomyLevel: "safe-execution",
    defaultRiskLevel: "medium",
  },
  "devops-agent": {
    role: "devops-agent",
    description: "Opera sobre Docker, CI/CD, variables, infraestructura y observabilidad.",
    responsibilities: ["infra diagnostics", "ci pipelines", "docker workflows", "deployment readiness"],
    allowedTools: ["runCommand", "readFile", "writeFile", "patchFile", "inspectEnv", "gitDiff", "requestApproval"],
    defaultCapabilities: ["reasoning", "classification", "retrieval"],
    maxAutonomyLevel: "supervised-execution",
    defaultRiskLevel: "high",
  },
  "qa-agent": {
    role: "qa-agent",
    description: "Valida pruebas, smoke flows, regresiones y estado final de la mision.",
    responsibilities: ["test execution", "smoke validation", "regression reporting", "release confidence"],
    allowedTools: ["runBuild", "runLint", "runTests", "readFile", "listFiles", "gitDiff"],
    defaultCapabilities: ["reasoning", "classification"],
    maxAutonomyLevel: "safe-execution",
    defaultRiskLevel: "low",
  },
  "doc-agent": {
    role: "doc-agent",
    description: "Actualiza docs, changelog, ADRs y evidencia tecnica.",
    responsibilities: ["documentation updates", "adr notes", "change summaries", "evidence packs"],
    allowedTools: ["readFile", "writeFile", "patchFile", "gitDiff", "requestApproval"],
    defaultCapabilities: ["reasoning", "code_generation", "retrieval"],
    maxAutonomyLevel: "safe-execution",
    defaultRiskLevel: "low",
  },
  "governance-agent": {
    role: "governance-agent",
    description: "Evalua riesgo, permisos, aprobaciones y limites operativos.",
    responsibilities: ["risk scoring", "policy checks", "approval gating", "safety review"],
    allowedTools: ["readFile", "listFiles", "inspectEnv", "requestApproval"],
    defaultCapabilities: ["reasoning", "classification"],
    maxAutonomyLevel: "suggestion",
    defaultRiskLevel: "high",
  },
  "architect-agent": {
    role: "architect-agent",
    description: "Protege fronteras modulares, ownership y alineacion canonica.",
    responsibilities: ["module ownership", "anti-duplication review", "boundary enforcement", "system alignment"],
    allowedTools: ["readFile", "listFiles", "searchCode", "gitDiff"],
    defaultCapabilities: ["reasoning", "classification", "retrieval"],
    maxAutonomyLevel: "suggestion",
    defaultRiskLevel: "medium",
  },
};

export function getDeveloperRuntimeAgentDefinition(
  role: DeveloperRuntimeAgentRole,
): DeveloperRuntimeAgentDefinition {
  return DEVELOPER_RUNTIME_AGENTS[role];
}
