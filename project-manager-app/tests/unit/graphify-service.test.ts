/**
 * Tests for graphify integration behavior.
 * Tests graceful degradation and CLI arg construction without importing
 * NestJS-decorated classes (incompatible with --experimental-strip-types).
 * Run: node --experimental-strip-types --test tests/unit/graphify-service.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import { resolve, join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);
const REAL_GRAPH = resolve(process.cwd(), "graphify-out/graph.json");
const graphAvailable = existsSync(REAL_GRAPH);
const MISSING_GRAPH = "/tmp/__graphify_missing__/graph.json";

// ── pure helpers (mirrors GraphifyService internal logic) ─────────────────────

function isGraphAvailable(graphPath: string): boolean {
  return existsSync(graphPath);
}

async function runGraphify(
  bin: string,
  args: string[],
  timeoutMs = 15_000,
): Promise<{ available: boolean; result: string }> {
  try {
    const { stdout } = await exec(bin, args, { timeout: timeoutMs });
    return { available: true, result: stdout.trim() };
  } catch {
    return { available: false, result: "" };
  }
}

function buildQueryArgs(graph: string, question: string, budget: number): string[] {
  return ["query", question, "--graph", graph, "--budget", String(budget)];
}

function buildPathArgs(graph: string, from: string, to: string): string[] {
  return ["path", from, to, "--graph", graph];
}

function buildExplainArgs(graph: string, concept: string): string[] {
  return ["explain", concept, "--graph", graph];
}

function buildAffectedArgs(graph: string, node: string, relation?: string): string[] {
  const args = ["affected", node, "--graph", graph];
  if (relation) args.push("--relation", relation);
  return args;
}

function buildStructuralContextHeader(result: string): string {
  if (!result) return "";
  return `## Contexto estructural del código (Graphify)\n${result}`;
}

// ── isGraphAvailable ──────────────────────────────────────────────────────────

test("isGraphAvailable returns false for non-existent path", () => {
  assert.equal(isGraphAvailable(MISSING_GRAPH), false);
});

test("isGraphAvailable returns true when graph.json exists", { skip: !graphAvailable }, () => {
  assert.equal(isGraphAvailable(REAL_GRAPH), true);
});

// ── arg builders ──────────────────────────────────────────────────────────────

test("buildQueryArgs includes question and budget", () => {
  const args = buildQueryArgs("/path/graph.json", "auth flow", 1000);
  assert.deepEqual(args, ["query", "auth flow", "--graph", "/path/graph.json", "--budget", "1000"]);
});

test("buildPathArgs produces correct CLI args", () => {
  const args = buildPathArgs("/path/graph.json", "AuthService", "PaymentsModule");
  assert.deepEqual(args, ["path", "AuthService", "PaymentsModule", "--graph", "/path/graph.json"]);
});

test("buildExplainArgs produces correct CLI args", () => {
  const args = buildExplainArgs("/path/graph.json", "GovernanceModule");
  assert.deepEqual(args, ["explain", "GovernanceModule", "--graph", "/path/graph.json"]);
});

test("buildAffectedArgs without relation", () => {
  const args = buildAffectedArgs("/path/graph.json", "AuthService");
  assert.deepEqual(args, ["affected", "AuthService", "--graph", "/path/graph.json"]);
});

test("buildAffectedArgs with relation appends --relation flag", () => {
  const args = buildAffectedArgs("/path/graph.json", "AuthService", "imports");
  assert.deepEqual(args, ["affected", "AuthService", "--graph", "/path/graph.json", "--relation", "imports"]);
});

// ── structural context header ─────────────────────────────────────────────────

test("buildStructuralContextHeader returns empty string for empty result", () => {
  assert.equal(buildStructuralContextHeader(""), "");
});

test("buildStructuralContextHeader prefixes with expected header", () => {
  const ctx = buildStructuralContextHeader("some result");
  assert.ok(ctx.startsWith("## Contexto estructural del código (Graphify)"));
  assert.ok(ctx.includes("some result"));
});

// ── runGraphify degradation ───────────────────────────────────────────────────

test("runGraphify returns available=false when binary does not exist", async () => {
  const result = await runGraphify("/nonexistent/bin/graphify", ["query", "test"], 2000);
  assert.equal(result.available, false);
  assert.equal(result.result, "");
});

// ── live CLI queries (only when graph is built) ───────────────────────────────

test("graphify query returns non-empty output on real graph", { skip: !graphAvailable }, async () => {
  const args = buildQueryArgs(REAL_GRAPH, "autenticación", 500);
  const result = await runGraphify("graphify", args, 20_000);
  assert.equal(result.available, true);
  assert.ok(result.result.length > 0);
});

test("graphify explain returns output for known module", { skip: !graphAvailable }, async () => {
  const args = buildExplainArgs(REAL_GRAPH, "AuthService");
  const result = await runGraphify("graphify", args, 20_000);
  assert.equal(result.available, true);
});

test("structural context block is non-empty on real graph", { skip: !graphAvailable }, async () => {
  const args = buildQueryArgs(REAL_GRAPH, "pagos stripe", 500);
  const { result } = await runGraphify("graphify", args, 20_000);
  const ctx = buildStructuralContextHeader(result);
  assert.ok(ctx.startsWith("## Contexto estructural del código (Graphify)"));
});
