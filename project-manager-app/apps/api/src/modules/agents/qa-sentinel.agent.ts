export type QaSentinelSeverity = "low" | "medium" | "high" | "critical";

export type QaSentinelAffectedModule =
  | "buildops"
  | "tools"
  | "marketplace"
  | "evidence"
  | "auth"
  | "milestones"
  | "dashboard"
  | "unknown";

export type QaSentinelReport = {
  scenario: string;
  status: "passed" | "failed" | "blocked";
  affectedModule: QaSentinelAffectedModule;
  severity: QaSentinelSeverity;
  summary: string;
  probableCause?: string;
  recommendedActions: string[];
  evidenceFiles: string[];
};

export type QaSentinelBatch = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  baseURL: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  blocked: number;
  reports: QaSentinelReport[];
  deployBlocked: boolean;
  blockReason?: string;
};

/** Determines severity from the number/type of failed tests. */
export function deriveSeverity(report: Pick<QaSentinelReport, "status" | "affectedModule">): QaSentinelSeverity {
  if (report.status === "passed") return "low";
  if (report.affectedModule === "auth") return "critical";
  if (report.affectedModule === "milestones" || report.affectedModule === "buildops") return "high";
  if (report.affectedModule === "tools" || report.affectedModule === "dashboard") return "medium";
  return "medium";
}

/** Infers the affected module from the scenario name. */
export function inferModule(scenario: string): QaSentinelAffectedModule {
  const s = scenario.toLowerCase();
  if (s.includes("auth") || s.includes("login")) return "auth";
  if (s.includes("milestone")) return "milestones";
  if (s.includes("buildops")) return "buildops";
  if (s.includes("dashboard")) return "dashboard";
  if (s.includes("tool") || s.includes("concrete") || s.includes("roofing")) return "tools";
  if (s.includes("evidence")) return "evidence";
  if (s.includes("marketplace")) return "marketplace";
  return "unknown";
}

/** Compiles a batch report and decides whether to block deployment. */
export function compileBatch(
  reports: QaSentinelReport[],
  meta: Pick<QaSentinelBatch, "runId" | "startedAt" | "baseURL">
): QaSentinelBatch {
  const failed = reports.filter((r) => r.status === "failed");
  const blocked = reports.filter((r) => r.status === "blocked");
  const criticalFails = failed.filter((r) => r.severity === "critical" || r.severity === "high");

  const deployBlocked = criticalFails.length > 0;
  const blockReason = deployBlocked
    ? `${criticalFails.length} critical/high severity failure(s): ${criticalFails.map((r) => r.scenario).join(", ")}`
    : undefined;

  return {
    ...meta,
    finishedAt: new Date().toISOString(),
    totalScenarios: reports.length,
    passed: reports.filter((r) => r.status === "passed").length,
    failed: failed.length,
    blocked: blocked.length,
    reports,
    deployBlocked,
    blockReason,
  };
}

/** Converts a raw Playwright-style evidence JSON into a QaSentinelReport. */
export function fromEvidenceFile(raw: {
  scenario: string;
  status: "passed" | "failed" | "blocked";
  errors?: string[];
  recommendedActions?: string[];
  screenshots?: string[];
  traces?: string[];
}): QaSentinelReport {
  const module = inferModule(raw.scenario);
  const severity = deriveSeverity({ status: raw.status, affectedModule: module });
  return {
    scenario: raw.scenario,
    status: raw.status,
    affectedModule: module,
    severity,
    summary:
      raw.status === "passed"
        ? `Scenario "${raw.scenario}" passed.`
        : `Scenario "${raw.scenario}" ${raw.status} with ${raw.errors?.length ?? 0} error(s).`,
    probableCause: raw.errors?.[0],
    recommendedActions: raw.recommendedActions ?? [],
    evidenceFiles: [...(raw.screenshots ?? []), ...(raw.traces ?? [])],
  };
}
