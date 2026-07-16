import type { BrowserEngineAdapter, BrowserInspectionOptions, BrowserInspectionResult } from "./browser-engine.interface.js";
import { ObscuraAdapter } from "./obscura-adapter.js";
import { PlaywrightAdapter } from "./playwright-adapter.js";

export class EngineRouter implements BrowserEngineAdapter {
  private readonly obscura: ObscuraAdapter;
  private readonly playwright: PlaywrightAdapter;

  constructor() {
    this.obscura = new ObscuraAdapter();
    this.playwright = new PlaywrightAdapter();
  }

  async inspect(options: BrowserInspectionOptions): Promise<BrowserInspectionResult> {
    // 1. Try Obscura first
    const obscuraResult = await this.obscura.inspect(options);
    if (obscuraResult.success) {
      return obscuraResult;
    }

    // 2. Fallback to Playwright if Obscura fails (e.g. service down or compatibility error)
    console.warn(`Obscura inspection failed: ${obscuraResult.error ?? "unknown error"}. Falling back to Playwright for URL: ${options.url}`);
    return this.playwright.inspect(options);
  }
}
