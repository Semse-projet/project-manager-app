import type { BrowserEngineAdapter, BrowserInspectionOptions, BrowserInspectionResult } from "./browser-engine.interface.js";
import { SecureNetworkGateway } from "./secure-network-gateway.js";

export class ObscuraAdapter implements BrowserEngineAdapter {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.OBSCURA_URL ?? "http://127.0.0.1:9222";
  }

  async inspect(options: BrowserInspectionOptions): Promise<BrowserInspectionResult> {
    if (!(await SecureNetworkGateway.isUrlSafe(options.url))) {
      throw new Error(`SSRF Block: URL is unsafe: ${options.url}`);
    }

    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/inspect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: options.url,
          screenshot: options.includeScreenshot !== false,
          extractText: options.includeText !== false,
          timeout: options.timeoutMs ?? 30000
        })
      });

      if (!response.ok) {
        throw new Error(`Obscura returned status ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as any;
      return {
        success: true,
        url: options.url,
        finalUrl: data.finalUrl || options.url,
        title: data.title || "",
        status: data.errorCount > 0 ? "warning" : "healthy",
        severity: data.errorCount > 0 ? "medium" : "low",
        pageStatus: data.status || 200,
        loadTimeMs: Date.now() - startTime,
        consoleErrors: data.consoleErrors || [],
        networkFailures: data.networkFailures || [],
        visibleTextSample: data.text,
        screenshotBase64: data.screenshot
      };
    } catch (err: any) {
      return {
        success: false,
        url: options.url,
        status: "failed",
        severity: "critical",
        error: err.message,
        consoleErrors: [],
        networkFailures: []
      };
    }
  }
}
