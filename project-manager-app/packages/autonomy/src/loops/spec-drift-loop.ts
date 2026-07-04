/**
 * SPEC-AUT-001 §4 — loop.spec-drift, fase mecánica (sin LLM, costo ~0).
 *
 * Por cada spec en docs/specs extrae afirmaciones verificables y comprueba:
 *   a. paths declarados en related_files existen
 *   b. tests declarados en related_tests existen
 *   c. specs IMPLEMENTED/VERIFIED declaran related_tests
 *   d. comandos `pnpm run X` citados existen en package.json
 * El drift semántico (¿el spec describe el comportamiento actual?) es fase
 * posterior y NUNCA se auto-corrige (decisión humana, §4 paso 4).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { LoopAnalyzerContext, LoopFinding } from "./loop-types.js";

interface SpecMetadata {
  file: string;
  status: string | null;
  relatedFiles: string[];
  relatedTests: string[];
}

const LIST_FIELDS = ["related_files", "related_tests"] as const;
const IMPLEMENTED_STATUSES = new Set(["IMPLEMENTED", "VERIFIED"]);

function collectSpecFiles(dir: string, results: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) collectSpecFiles(absolute, results);
    else if (entry.isFile() && entry.name.endsWith(".spec.md")) results.push(absolute);
  }
}

/** Frontmatter mínimo: status + listas related_files/related_tests. */
export function parseSpecMetadata(repoRoot: string, absolutePath: string): SpecMetadata {
  const content = readFileSync(absolutePath, "utf8");
  const meta: SpecMetadata = {
    file: relative(repoRoot, absolutePath),
    status: null,
    relatedFiles: [],
    relatedTests: []
  };

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const body = frontmatterMatch ? frontmatterMatch[1] : content.slice(0, 2000);

  const statusMatch = body.match(/^status:\s*"?([A-Z_]+)"?\s*$/m) ?? content.match(/\*\*Estado:\*\*\s*([A-Z_]+)/);
  if (statusMatch) meta.status = statusMatch[1];

  for (const field of LIST_FIELDS) {
    const fieldRegex = new RegExp(`^${field}:\\s*$`, "m");
    const inlineEmpty = new RegExp(`^${field}:\\s*\\[\\s*\\]`, "m");
    if (inlineEmpty.test(body)) continue;
    const startMatch = body.match(fieldRegex);
    if (!startMatch || startMatch.index === undefined) continue;

    const rest = body.slice(startMatch.index + startMatch[0].length);
    for (const line of rest.split("\n")) {
      const item = line.match(/^\s+-\s+(.+)$/);
      if (!item) {
        if (line.trim() === "") continue;
        break;
      }
      const value = item[1].trim().replace(/^"|"$/g, "");
      if (field === "related_files") meta.relatedFiles.push(value);
      else meta.relatedTests.push(value);
    }
  }

  return meta;
}

function findCitedCommands(content: string): string[] {
  const commands = new Set<string>();
  for (const match of content.matchAll(/pnpm (?:run )?([a-z][a-z0-9:_-]+)/g)) {
    commands.add(match[1]);
  }
  return [...commands];
}

export function analyzeSpecDrift(ctx: LoopAnalyzerContext): LoopFinding[] {
  const repoRoot = ctx.repoRoot;
  const specsDir = join(repoRoot, "docs", "specs");
  const specFiles: string[] = [];
  collectSpecFiles(specsDir, specFiles);

  let knownScripts: Set<string> | null = null;
  const rootPackageJson = join(repoRoot, "package.json");
  if (existsSync(rootPackageJson)) {
    try {
      const parsed = JSON.parse(readFileSync(rootPackageJson, "utf8")) as { scripts?: Record<string, string> };
      knownScripts = new Set(Object.keys(parsed.scripts ?? {}));
    } catch {
      knownScripts = null;
    }
  }

  const findings: LoopFinding[] = [];

  for (const absolutePath of specFiles) {
    const meta = parseSpecMetadata(repoRoot, absolutePath);
    const specRef = meta.file;

    for (const declared of meta.relatedFiles) {
      if (!existsSync(join(repoRoot, declared))) {
        findings.push({
          loopId: "loop.spec-drift",
          target: `drift:${specRef}:file:${declared}`,
          kind: "drift.missing_path",
          confidence: 1,
          rationale: `${specRef} declara related_files "${declared}" pero el path no existe`,
          evidence: { spec: specRef, declared }
        });
      }
    }

    for (const declared of meta.relatedTests) {
      if (!existsSync(join(repoRoot, declared))) {
        findings.push({
          loopId: "loop.spec-drift",
          target: `drift:${specRef}:test:${declared}`,
          kind: "drift.missing_test",
          confidence: 1,
          rationale: `${specRef} declara related_tests "${declared}" pero el archivo no existe`,
          evidence: { spec: specRef, declared }
        });
      }
    }

    if (meta.status && IMPLEMENTED_STATUSES.has(meta.status) && meta.relatedTests.length === 0) {
      findings.push({
        loopId: "loop.spec-drift",
        target: `drift:${specRef}:done-without-tests`,
        kind: "drift.done_without_tests",
        confidence: 0.95,
        rationale: `${specRef} está ${meta.status} pero no declara related_tests — drift crítico (spec §4 paso 2d)`,
        evidence: { spec: specRef, status: meta.status }
      });
    }

    if (knownScripts) {
      const content = readFileSync(absolutePath, "utf8");
      for (const command of findCitedCommands(content)) {
        if (!knownScripts.has(command)) {
          findings.push({
            loopId: "loop.spec-drift",
            target: `drift:${specRef}:command:${command}`,
            kind: "drift.missing_command",
            confidence: 0.9,
            rationale: `${specRef} documenta "pnpm ${command}" pero el script no existe en package.json`,
            evidence: { spec: specRef, command }
          });
        }
      }
    }
  }

  return findings;
}

/** spec.health_score = specs sin drift / total (input del protocolo de arranque del harness). */
export function buildSpecHealthReport(repoRoot: string, findings: LoopFinding[]): { markdown: string; healthScore: number; totalSpecs: number } {
  const specsDir = join(repoRoot, "docs", "specs");
  const specFiles: string[] = [];
  collectSpecFiles(specsDir, specFiles);

  const driftedSpecs = new Set(
    findings
      .map((f) => (typeof f.evidence?.spec === "string" ? f.evidence.spec : null))
      .filter((s): s is string => s !== null)
  );
  const totalSpecs = specFiles.length;
  const healthScore = totalSpecs === 0 ? 1 : Number(((totalSpecs - driftedSpecs.size) / totalSpecs).toFixed(3));

  const lines = [
    "# Spec Health — loop.spec-drift",
    "",
    `- Specs totales: ${totalSpecs}`,
    `- Specs con drift: ${driftedSpecs.size}`,
    `- spec.health_score: ${healthScore}`,
    "",
    "## Hallazgos",
    ""
  ];
  if (findings.length === 0) {
    lines.push("Sin drift mecánico detectado.");
  } else {
    for (const finding of findings) {
      lines.push(`- [${finding.kind}] ${finding.rationale}`);
    }
  }

  return { markdown: lines.join("\n") + "\n", healthScore, totalSpecs };
}
