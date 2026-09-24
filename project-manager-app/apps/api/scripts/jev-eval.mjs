#!/usr/bin/env node
// Jev evaluation harness runner (handoff §56; spec prometeo/jev-decision-layer §9.5).
//
//   pnpm --filter @semse/api build
//   JEV_BASE_URL=... JEV_API_KEY=... node apps/api/scripts/jev-eval.mjs [--feature agent_router|vision_gate] [--json]
//   node apps/api/scripts/jev-eval.mjs --mock baseline     # dry run: a fake Jev that echoes the ground truth
//
// Forces both pilots ON + live for the run only (in-process config; nothing
// touches Railway). Telemetry goes to memory, never to the database.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = (p) => resolve(here, "../dist/modules/ai-models/decision", p);
const { DecisionLayerService } = await import(dist("decision-layer.service.js"));
const { resolveDecisionLayerConfig } = await import(dist("decision-flags.js"));
const { JevHttpProvider } = await import(dist("jev.provider.js"));
const { runDecisionEval, agentRouterEvalRequest, visionGateEvalRequest } = await import(dist("decision-eval.js"));

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const onlyFeature = arg("--feature");
const mock = arg("--mock");

const env = {
  ...process.env,
  SEMSE_JEV_ENABLED: "true",
  SEMSE_JEV_AGENT_ROUTER_ENABLED: "true",
  SEMSE_JEV_VISION_GATE_ENABLED: "true",
  SEMSE_JEV_AGENT_ROUTER_MODE: "live",
  SEMSE_JEV_VISION_GATE_MODE: "live",
  SEMSE_JEV_CANARY_TENANT_IDS: "",
  SEMSE_JEV_CANARY_USER_IDS: "",
  SEMSE_JEV_CANARY_ROLES: "",
  SEMSE_JEV_CANARY_PERCENT: "0",
};
const config = resolveDecisionLayerConfig(env);

const fixtures = {
  agent_router: { file: "agent-router.json", toRequest: agentRouterEvalRequest },
  vision_gate: { file: "vision-gate.json", toRequest: visionGateEvalRequest },
};

let provider;
if (mock === "baseline") {
  const expectedById = new Map();
  for (const { file } of Object.values(fixtures)) {
    for (const c of JSON.parse(readFileSync(resolve(here, "../test/fixtures/jev-eval", file), "utf8")).cases) expectedById.set(`eval:${c.id}`, c.expected);
  }
  provider = { name: "mock-baseline", async decide(req) { return { raw: { action: expectedById.get(req.correlationId), confidence: 0.9, reasonCode: "MOCK_GROUND_TRUTH" }, model: "mock" }; } };
} else {
  if (!config.provider.baseUrl || !config.provider.apiKey) {
    console.error("JEV_BASE_URL and JEV_API_KEY are required (or use --mock baseline for a dry run).");
    process.exit(2);
  }
  provider = new JevHttpProvider(config.provider);
}

const memoryTelemetry = { async record() { return null; }, async recordOutcome() {} };
const service = new DecisionLayerService(provider, memoryTelemetry, () => config);

const reports = [];
for (const [feature, { file, toRequest }] of Object.entries(fixtures)) {
  if (onlyFeature && onlyFeature !== feature) continue;
  const { cases } = JSON.parse(readFileSync(resolve(here, "../test/fixtures/jev-eval", file), "utf8"));
  reports.push(await runDecisionEval({ feature, cases, service, toRequest }));
}

if (args.includes("--json")) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  for (const { results, ...summary } of reports) {
    console.log(`\n== ${summary.feature} (${summary.cases} cases, provider=${provider.name})`);
    console.table(summary);
    const misses = results.filter((r) => r.expected && r.final !== r.expected);
    if (misses.length) console.table(misses.map(({ id, expected, deterministic, jev, final, fallbackReason }) => ({ id, expected, deterministic, jev, final, fallbackReason })));
  }
}
