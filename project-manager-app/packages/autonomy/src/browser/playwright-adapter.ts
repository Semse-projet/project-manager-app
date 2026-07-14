import type { BrowserEngineAdapter, BrowserInspectionOptions, BrowserInspectionResult } from "./browser-engine.interface.js";
import { SecureNetworkGateway } from "./secure-network-gateway.js";

export class PlaywrightAdapter implements BrowserEngineAdapter {
  async inspect(options: BrowserInspectionOptions): Promise<BrowserInspectionResult> {
    if (!(await SecureNetworkGateway.isUrlSafe(options.url))) {
      throw new Error(`SSRF Block: URL is unsafe: ${options.url}`);
    }

    // Dynamic import to prevent bundle load failures in environments that only run Obscura
    const { chromium } = await import("playwright");
    
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEMSE-BrowserAgent/1.0"
    });

    const page = await context.newPage();
    const consoleErrors: any[] = [];
    const networkFailures: any[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on("requestfailed", (req) => {
      networkFailures.push({
        url: req.url(),
        method: req.method(),
        errorText: req.failure()?.errorText ?? "unknown failure"
      });
    });

    page.on("response", (res) => {
      if (res.status() >= 400) {
        networkFailures.push({
          url: res.url(),
          method: res.request().method(),
          status: res.status(),
          statusText: res.statusText()
        });
      }
    });

    const startTime = Date.now();
    try {
      await page.goto(options.url, {
        waitUntil: "load",
        timeout: options.timeoutMs ?? 30000
      });
      const loadTimeMs = Date.now() - startTime;

      const title = await page.title();
      const finalUrl = page.url();

      let screenshotBase64: string | undefined;
      if (options.includeScreenshot !== false) {
        const buf = await page.screenshot({ type: "png" });
        screenshotBase64 = buf.toString("base64");
      }

      let visibleTextSample: string | undefined;
      if (options.includeText !== false) {
        const innerText = await page.evaluate(() => document.body?.innerText ?? "");
        visibleTextSample = innerText.slice(0, 5000);
      }

      return {
        success: true,
        url: options.url,
        finalUrl,
        title,
        status: consoleErrors.length > 0 ? "warning" : "healthy",
        severity: consoleErrors.length > 0 ? "medium" : "low",
        pageStatus: 200,
        loadTimeMs,
        consoleErrors,
        networkFailures,
        visibleTextSample,
        screenshotBase64
      };
    } catch (err: any) {
      return {
        success: false,
        url: options.url,
        status: "failed",
        severity: "critical",
        error: err.message,
        consoleErrors,
        networkFailures
      };
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  }
}
