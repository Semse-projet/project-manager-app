import * as fs from "fs";
import * as path from "path";

export type EvidenceStatus = "passed" | "failed" | "blocked";

export type EvidenceReport = {
  scenario: string;
  status: EvidenceStatus;
  startedAt: string;
  endedAt: string;
  baseURL: string;
  screenshots: string[];
  traces: string[];
  errors: string[];
  recommendedActions: string[];
};

const EVIDENCE_DIR = path.resolve("artifacts/evidence/playwright");

function ensureDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

function slug(scenario: string): string {
  return scenario.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function writeEvidenceReport(report: EvidenceReport): string {
  ensureDir();
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${slug(report.scenario)}-${ts}.json`;
  const filepath = path.join(EVIDENCE_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  return filepath;
}

export function buildReport(
  scenario: string,
  status: EvidenceStatus,
  startedAt: string,
  baseURL: string,
  opts: Partial<Omit<EvidenceReport, "scenario" | "status" | "startedAt" | "endedAt" | "baseURL">> = {}
): EvidenceReport {
  return {
    scenario,
    status,
    startedAt,
    endedAt: new Date().toISOString(),
    baseURL,
    screenshots: opts.screenshots ?? [],
    traces: opts.traces ?? [],
    errors: opts.errors ?? [],
    recommendedActions: opts.recommendedActions ?? [],
  };
}
