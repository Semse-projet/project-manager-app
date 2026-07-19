import type { ForgeApprovalMode, ForgeRiskLevel, ForgeTaskPacket } from "./types.js";
import { matchesScope } from "./policy.js";

export type SandboxMode = "dry-run" | "live";

export type SandboxDecision = "allow" | "deny" | "require_approval";

export type SandboxCommand = {
  raw: string;
  program: string;
  args: string[];
  allowed: boolean;
  violations: string[];
};

export type SandboxPlan = {
  mode: SandboxMode;
  decision: SandboxDecision;
  reason: string;
  riskLevel: ForgeRiskLevel;
  commands: SandboxCommand[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};

export interface SandboxProvider {
  plan(input: {
    task: ForgeTaskPacket;
    action?: string;
    environment?: string;
  }): SandboxPlan;
}

const DANGEROUS_PROGRAMS = new Set([
  "bash",
  "csh",
  "curl",
  "dd",
  "env",
  "eval",
  "exec",
  "expect",
  "ftp",
  "ksh",
  "mkfs",
  "nc",
  "netcat",
  "nmap",
  "perl",
  "python",
  "python3",
  "rmdir",
  "rm",
  "ruby",
  "scp",
  "sftp",
  "sh",
  "shred",
  "ssh",
  "sudo",
  "su",
  "tclsh",
  "telnet",
  "tsch",
  "wget",
  "zsh"
]);

const SHELL_METACHARACTERS = /[\n\r;|&$`<>{}()\[\]\\]/;
const ABSOLUTE_OR_HOME = /^(?:\/|~)/;
const SCOPED_PACKAGE = /^@[^/]+\/[^/]+$/;
const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\//i;
const FILE_EXTENSION = /\.(json|ts|tsx|js|jsx|mjs|cjs|md|prisma|sql|yml|yaml|toml|html|css|scss|less|svg|png|jpe?g|gif|webp|ico|txt|env|lock|log)$/i;

function isPathLike(token: string): boolean {
  if (!token) return false;
  if (token.startsWith("-")) return false;
  if (SCOPED_PACKAGE.test(token)) return false;
  if (URL_LIKE.test(token)) return false;
  if (token.startsWith(".") && token !== ".") return true;
  return token.includes("/") || token.includes("\\") || FILE_EXTENSION.test(token);
}

function parseCommand(raw: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (const char of raw) {
    if (char === quote) {
      quote = null;
      continue;
    }
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      continue;
    }
    if (char === " " && !quote) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function normalizeProgram(token: string): string {
  return token.toLowerCase().replace(/\.exe$/i, "");
}

function validateCommand(raw: string, task: ForgeTaskPacket): SandboxCommand {
  const violations: string[] = [];
  if (SHELL_METACHARACTERS.test(raw)) {
    violations.push("sandbox.forbidden_shell_characters");
  }
  const tokens = parseCommand(raw);
  const program = normalizeProgram(tokens[0] ?? "");
  if (!program) {
    violations.push("sandbox.empty_command");
  }
  if (program && DANGEROUS_PROGRAMS.has(program)) {
    violations.push(`sandbox.dangerous_program:${program}`);
  }

  const allowedFiles = Array.isArray(task.allowedFiles) ? task.allowedFiles : [];
  const forbiddenFiles = Array.isArray(task.forbiddenFiles) ? task.forbiddenFiles : [];

  for (const token of tokens) {
    if (token.startsWith("-")) continue;
    if (SCOPED_PACKAGE.test(token)) continue;
    if (token.includes("..")) {
      violations.push(`sandbox.parent_directory_reference:${token}`);
    }
    if (ABSOLUTE_OR_HOME.test(token)) {
      violations.push(`sandbox.absolute_or_home_path:${token}`);
    }
    if (isPathLike(token)) {
      const taskAllows = allowedFiles.some((scope) => matchesScope(token, scope));
      const forbidden = forbiddenFiles.some((scope) => matchesScope(token, scope));
      if (!taskAllows) violations.push(`sandbox.file_out_of_scope:${token}`);
      if (forbidden) violations.push(`sandbox.file_forbidden:${token}`);
    }
  }

  return { raw, program, args: tokens.slice(1), allowed: violations.length === 0, violations };
}

function computeDecision(violations: string[], environment: string, riskLevel: ForgeRiskLevel): SandboxDecision {
  const hasDenyViolation = violations.some(
    (v) =>
      v.startsWith("sandbox.file_") ||
      v === "sandbox.forbidden_shell_characters" ||
      v.startsWith("sandbox.parent_directory_reference") ||
      v.startsWith("sandbox.absolute_or_home_path") ||
      v === "sandbox.empty_command"
  );
  if (hasDenyViolation) return "deny";

  const hasDangerousProgram = violations.some((v) => v.startsWith("sandbox.dangerous_program"));
  if (hasDangerousProgram) {
    if (environment === "production" || riskLevel === "critical") return "deny";
    return "require_approval";
  }

  return "allow";
}

class DryRunSandboxProvider implements SandboxProvider {
  plan(input: { task: ForgeTaskPacket; action?: string; environment?: string }): SandboxPlan {
    const { task, environment = task.environment ?? "worker" } = input;
    const commands = (task.allowedCommands ?? []).map((raw) => validateCommand(raw, task));
    const allViolations = commands.flatMap((cmd) => cmd.violations);
    const decision = computeDecision(allViolations, environment, task.riskLevel);
    const requiredApprovals: ForgeApprovalMode[] = decision === "require_approval" ? ["ops_admin"] : [];

    const reason =
      decision === "allow"
        ? "Dry-run sandbox validation passed."
        : `Dry-run sandbox validation ${decision}: ${allViolations.join("; ")}`;

    return {
      mode: "dry-run",
      decision,
      reason,
      riskLevel: task.riskLevel,
      commands,
      requiredApprovals,
      violations: allViolations,
      auditTags: ["forge.sandbox.planned", `forge.agent.${task.requestedRole}`]
    };
  }
}

class LiveSandboxProvider implements SandboxProvider {
  plan(): SandboxPlan {
    throw new Error("Live sandbox execution is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createSandboxProvider(config?: { mode?: SandboxMode }): SandboxProvider {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LiveSandboxProvider();
  return new DryRunSandboxProvider();
}
