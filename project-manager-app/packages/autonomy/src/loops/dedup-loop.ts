/**
 * SPEC-AUT-001 §3 — loop.dedup-abstractions, fase mecánica (sin LLM).
 *
 * Inventario de exports por package (grep de export + firmas) y candidatos
 * a duplicación por similitud de firma: nombre normalizado + tipo de export
 * + aridad. La capa semántica (embeddings) es fase posterior.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { LoopAnalyzerContext, LoopFinding } from "./loop-types.js";

export interface ExportRecord {
  package: string;
  file: string;
  name: string;
  normalizedName: string;
  kind: "function" | "const" | "class";
  arity: number | null;
}

const EXPORT_PATTERNS: Array<{ kind: ExportRecord["kind"]; regex: RegExp }> = [
  { kind: "function", regex: /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)/ },
  { kind: "const", regex: /^export\s+const\s+([A-Za-z0-9_$]+)\s*[:=]/ },
  { kind: "class", regex: /^export\s+class\s+([A-Za-z0-9_$]+)/ }
];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[_-]/g, "");
}

function countArity(params: string): number {
  const trimmed = params.trim();
  if (!trimmed) return 0;
  // Aridad aproximada: comas de primer nivel (suficiente para similitud mecánica)
  let depth = 0;
  let count = 1;
  for (const char of trimmed) {
    if (char === "(" || char === "{" || char === "[" || char === "<") depth += 1;
    else if (char === ")" || char === "}" || char === "]" || char === ">") depth -= 1;
    else if (char === "," && depth === 0) count += 1;
  }
  return count;
}

function isSourceFile(name: string): boolean {
  return name.endsWith(".ts") && !name.endsWith(".d.ts") && !name.endsWith(".test.ts") && !name.endsWith(".spec.ts");
}

function collectSourceFiles(dir: string, results: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(absolute, results);
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      results.push(absolute);
    }
  }
}

/** Un archivo shim (`export * from "./x.ts"`) no define nada propio. */
function isShimContent(content: string): boolean {
  const meaningful = content.split("\n").filter((line) => line.trim() && !line.trim().startsWith("//"));
  return meaningful.length > 0 && meaningful.every((line) => /^export\s+\*\s+from/.test(line.trim()));
}

export function buildExportInventory(repoRoot: string): ExportRecord[] {
  const packagesDir = join(repoRoot, "packages");
  if (!existsSync(packagesDir)) return [];

  const records: ExportRecord[] = [];
  for (const pkgEntry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!pkgEntry.isDirectory()) continue;
    const srcDir = join(packagesDir, pkgEntry.name, "src");
    if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) continue;

    const files: string[] = [];
    collectSourceFiles(srcDir, files);

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (isShimContent(content)) continue;

      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        // Saltar re-exports: no son definiciones propias
        if (/^export\s+(\*|\{)/.test(trimmed)) continue;

        for (const { kind, regex } of EXPORT_PATTERNS) {
          const match = trimmed.match(regex);
          if (match) {
            records.push({
              package: pkgEntry.name,
              file: relative(repoRoot, file),
              name: match[1],
              normalizedName: normalizeName(match[1]),
              kind,
              arity: kind === "function" ? countArity(match[2] ?? "") : null
            });
            break;
          }
        }
      }
    }
  }
  return records;
}

/** Candidatos: mismo nombre normalizado + mismo kind en ≥2 packages distintos. */
export function findDuplicateCandidates(inventory: ExportRecord[]): LoopFinding[] {
  const groups = new Map<string, ExportRecord[]>();
  for (const record of inventory) {
    const key = `${record.kind}:${record.normalizedName}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const findings: LoopFinding[] = [];
  for (const [key, group] of groups) {
    const packages = new Set(group.map((r) => r.package));
    if (packages.size < 2) continue;

    // Confianza mecánica: base 0.6; +0.2 si las aridades coinciden; +0.1 si el
    // nombre original coincide exactamente (no solo normalizado).
    const arities = new Set(group.map((r) => r.arity));
    const exactNames = new Set(group.map((r) => r.name));
    let confidence = 0.6;
    if (arities.size === 1) confidence += 0.2;
    if (exactNames.size === 1) confidence += 0.1;

    findings.push({
      loopId: "loop.dedup-abstractions",
      target: `dedup:${key}`,
      kind: "dedup.candidate",
      confidence: Number(confidence.toFixed(2)),
      rationale: `"${group[0].name}" (${group[0].kind}) definido en ${packages.size} packages: ${[...packages].sort().join(", ")}`,
      evidence: {
        occurrences: group.map((r) => ({ package: r.package, file: r.file, name: r.name, arity: r.arity }))
      }
    });
  }

  return findings.sort((a, b) => b.confidence - a.confidence);
}

export function analyzeDedupAbstractions(ctx: LoopAnalyzerContext): LoopFinding[] {
  return findDuplicateCandidates(buildExportInventory(ctx.repoRoot));
}
