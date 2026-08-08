export type MobileRuntimeMode = "mock" | "bff" | "api-direct";

export type MobileEnv = {
  apiBaseUrl: string;
  bffBaseUrl: string;
  runtimeMode: MobileRuntimeMode;
  allowMockFallback: boolean;
  enableAgentic: boolean;
  enableMemory: boolean;
  enableRag: boolean;
  enableTelemetry: boolean;
};

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim().toLowerCase() === "true";
}

function readRuntimeMode(value: unknown): MobileRuntimeMode {
  if (value === "bff" || value === "api-direct") {
    return value;
  }
  return "mock";
}

export const MOBILE_ENV: MobileEnv = {
  apiBaseUrl: import.meta.env.VITE_SEMSE_API_BASE_URL ?? "http://127.0.0.1:4122",
  bffBaseUrl: import.meta.env.VITE_SEMSE_BFF_BASE_URL ?? "http://127.0.0.1:3000/api/semse",
  runtimeMode: readRuntimeMode(import.meta.env.VITE_SEMSE_RUNTIME_MODE),
  allowMockFallback: readBoolean(import.meta.env.VITE_SEMSE_ALLOW_MOCK_FALLBACK, import.meta.env.DEV),
  enableAgentic: readBoolean(import.meta.env.VITE_SEMSE_ENABLE_AGENTIC, true),
  enableMemory: readBoolean(import.meta.env.VITE_SEMSE_ENABLE_MEMORY, true),
  enableRag: readBoolean(import.meta.env.VITE_SEMSE_ENABLE_RAG, true),
  enableTelemetry: readBoolean(import.meta.env.VITE_SEMSE_ENABLE_TELEMETRY, true),
};
