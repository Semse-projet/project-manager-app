import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

function resolveOllamaBin() {
  const envBin = process.env.OLLAMA_BIN?.trim();
  if (envBin) {
    return envBin;
  }

  const candidate = join(homedir(), ".local/ollama/bin/ollama");
  if (existsSync(candidate)) {
    return candidate;
  }

  return "ollama";
}

const model = process.env.SEMSE_LOCAL_LLM_MODEL?.trim() || "llama3.2:1b";
const child = spawn(resolveOllamaBin(), ["pull", model], {
  stdio: "inherit",
  env: {
    ...process.env,
    OLLAMA_HOST: process.env.OLLAMA_HOST?.trim() || "127.0.0.1:11434",
    OLLAMA_MODELS: process.env.OLLAMA_MODELS?.trim() || join(homedir(), ".local/share/ollama/models")
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
