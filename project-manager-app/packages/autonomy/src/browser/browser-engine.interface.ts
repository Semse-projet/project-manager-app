export interface BrowserInspectionOptions {
  url: string;
  tenantId: string;
  projectId?: string;
  milestoneId?: string;
  includeScreenshot?: boolean;
  includeText?: boolean;
  timeoutMs?: number;
}

export interface BrowserInspectionResult {
  success: boolean;
  url: string;
  finalUrl?: string;
  title?: string;
  status: "healthy" | "warning" | "failed";
  severity: "low" | "medium" | "high" | "critical";
  pageStatus?: number;
  loadTimeMs?: number;
  consoleErrors: Array<{ text: string; location?: any }>;
  networkFailures: Array<{ url: string; method: string; status?: number; errorText?: string }>;
  visibleTextSample?: string;
  screenshotBase64?: string;
  error?: string;
}

export interface BrowserEngineAdapter {
  inspect(options: BrowserInspectionOptions): Promise<BrowserInspectionResult>;
}
