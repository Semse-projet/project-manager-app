import { existsSync, mkdirSync } from "node:fs";
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

const ollamaHost = process.env.OLLAMA_HOST?.trim() || "127.0.0.1:11434";
const modelStore = process.env.OLLAMA_MODELS?.trim() || join(homedir(), ".local/share/ollama/models");

mkdirSync(modelStore, { recursive: true });

const child = spawn(resolveOllamaBin(), ["serve"], {
  stdio: "inherit",
  env: {
    ...process.env,
    OLLAMA_HOST: ollamaHost,
    OLLAMA_MODELS: modelStore
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
