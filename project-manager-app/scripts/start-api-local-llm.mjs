const host = process.env.HOST?.trim() || "127.0.0.1";
const port = process.env.PORT?.trim() || "4132";
const model = process.env.SEMSE_AUTONOMY_LLM_MODEL?.trim() || "llama3.2:1b";
const baseUrl = process.env.SEMSE_AUTONOMY_LLM_BASE_URL?.trim() || "http://127.0.0.1:11434/v1";
const apiKey = process.env.SEMSE_AUTONOMY_LLM_API_KEY?.trim() || "ollama";

process.env.HOST = host;
process.env.PORT = port;
process.env.SEMSE_AUTONOMY_LLM_PROVIDER = "ollama";
process.env.SEMSE_AUTONOMY_LLM_BASE_URL = baseUrl;
process.env.SEMSE_AUTONOMY_LLM_MODEL = model;
process.env.SEMSE_AUTONOMY_LLM_API_KEY = apiKey;

await import("../apps/api/dist/main.js");
