import { chromium } from "playwright";
import { isUrlSafe } from "./url-safety.mjs";

/**
 * Runs browser inspection using Playwright Chromium.
 * 
 * @param {string} url - The URL to inspect
 * @param {Object} options - Configuration options
 * @param {boolean} [options.includeScreenshot=true] - Whether to capture a screenshot
 * @param {boolean} [options.includeText=true] - Whether to extract visible text
 * @param {number} [options.timeoutMs=30000] - Page load and interaction timeout
 * @returns {Promise<Object>} Inspection result object
 */
export async function runBrowserInspection(url, options = {}) {
  const includeScreenshot = options.includeScreenshot !== false;
  const includeText = options.includeText !== false;
  const timeoutMs = options.timeoutMs ?? 30000;

  if (!isUrlSafe(url)) {
    throw new Error(`URL is unsafe or blocked: ${url}`);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEMSE-BrowserAgent/1.0",
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const networkFailures = [];

  // Listen to console messages
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location(),
      });
    }
  });

  // Listen to request/response failures
  page.on("requestfailed", (request) => {
    networkFailures.push({
      url: request.url(),
      method: request.method(),
      errorText: request.failure()?.errorText ?? "unknown failure",
    });
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      networkFailures.push({
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  });

  try {
    const startTime = Date.now();
    await page.goto(url, {
      waitUntil: "load",
      timeout: timeoutMs,
    });
    const loadTimeMs = Date.now() - startTime;

    const title = await page.title();
    const finalUrl = page.url();

    let screenshotBase64 = null;
    if (includeScreenshot) {
      const screenshotBuffer = await page.screenshot({ type: "png", fullPage: false });
      screenshotBase64 = screenshotBuffer.toString("base64");
    }

    let visibleTextSample = null;
    if (includeText) {
      const innerText = await page.evaluate(() => document.body?.innerText ?? "");
      // Truncate text sample to avoid giant payloads
      visibleTextSample = innerText.slice(0, 5000);
    }

    // Classify health based on console errors and network failures
    let status = "healthy";
    let severity = "low";
    if (consoleErrors.length > 0 || networkFailures.length > 0) {
      status = "warning";
      severity = "medium";
    }
    
    // Critical if there are major network failures on the main page, or multiple errors
    if (networkFailures.some(f => f.url === url && f.status >= 500)) {
      status = "failed";
      severity = "critical";
    }

    return {
      success: true,
      url,
      finalUrl,
      title,
      status,
      severity,
      loadTimeMs,
      consoleErrors: consoleErrors.slice(0, 50),
      networkFailures: networkFailures.slice(0, 50),
      visibleTextSample,
      screenshotBase64,
    };
  } catch (error) {
    return {
      success: false,
      url,
      status: "failed",
      severity: "critical",
      error: error.message,
      consoleErrors,
      networkFailures,
    };
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}
