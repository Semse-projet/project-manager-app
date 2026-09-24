#!/usr/bin/env node
// Minimal live check for Jev AI (jev-ai.pro). Reads JEV_AI_API_KEY from the
// environment (e.g. apps/api/.env) and never prints it.
//
//   pnpm --filter @semse/api build
//   pnpm --filter @semse/api jev:models            # GET /api/v1/models — connected models only
//   pnpm --filter @semse/api jev:call              # POST /api/v1/systemone — the "urgent" noul example
//   pnpm --filter @semse/api jev:call -- --model laya-english --state "..."
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Same file the API loads at boot; an exported shell variable wins.
try { process.loadEnvFile(resolve(here, "../.env")); } catch { /* no apps/api/.env: rely on the shell */ }
const { JevAiClient, JevAiError } = await import(resolve(here, "../dist/modules/ai-models/decision/jev-ai.client.js"));
const { resolveDecisionLayerConfig } = await import(resolve(here, "../dist/modules/ai-models/decision/decision-flags.js"));

const args = process.argv.slice(2).filter((a) => a !== "--");
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const command = args[0];

const { provider } = resolveDecisionLayerConfig(process.env);
if (!provider.apiKey) {
  console.error("JEV_AI_API_KEY is not set. Put it in apps/api/.env (gitignored) or export it in this shell; never paste it into chat or commit it.");
  process.exit(2);
}
const client = new JevAiClient({ ...provider, timeoutMs: Number(arg("--timeout-ms") ?? 15_000) });

try {
  if (command === "models") {
    const models = await client.listModels();
    console.log(JSON.stringify({ models }, null, 2));
  } else if (command === "call") {
    const result = await client.systemOne({
      model: arg("--model") ?? provider.model ?? "jev-latest",
      state: arg("--state") ?? "My payment failed. Please help.",
      questions: { urgent: { type: "noul", instructions: "Does this message need urgent support?" } },
    });
    const urgent = result.answers.urgent.noul;
    console.log(JSON.stringify({ model: result.model, answers: result.answers, usage: result.usage }, null, 2));
    console.log(`answers.urgent.noul = ${urgent} (${urgent >= 0.5 ? "likely urgent" : "likely not urgent"}); input_tokens = ${result.usage.input_tokens ?? "n/a"}`);
  } else {
    console.error("usage: jev-ai.mjs models | call [--model <id>] [--state <text>] [--timeout-ms <n>]");
    process.exit(2);
  }
} catch (error) {
  if (error instanceof JevAiError) {
    console.error(JSON.stringify({ error: error.kind, status: error.status, errorType: error.errorType, retryAfterMs: error.retryAfterMs, outcomeUncertain: error.outcomeUncertain, message: error.message }));
    process.exit(1);
  }
  throw error;
}
