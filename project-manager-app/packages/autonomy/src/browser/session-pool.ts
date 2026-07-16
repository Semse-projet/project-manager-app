import type { Page, Browser, BrowserContext } from "playwright";

export interface ActiveSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  lastActive: number;
}

export class BrowserSessionPool {
  private static sessions = new Map<string, ActiveSession>();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  static async getOrCreateSession(sessionId: string): Promise<ActiveSession> {
    let session = this.sessions.get(sessionId);
    if (session) {
      session.lastActive = Date.now();
      return session;
    }

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
    session = {
      id: sessionId,
      browser,
      context,
      page,
      lastActive: Date.now()
    };

    this.sessions.set(sessionId, session);
    this.startCleanupTimer();

    return session;
  }

  static async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      try {
        await session.page.close();
        await session.context.close();
        await session.browser.close();
      } catch (e) {
        console.error(`Error closing session ${sessionId}:`, e);
      }
    }

    if (this.sessions.size === 0 && this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private static startCleanupTimer() {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes session timeout
      for (const [id, session] of this.sessions.entries()) {
        if (now - session.lastActive > maxAge) {
          console.log(`Cleaning up idle browser session: ${id}`);
          this.closeSession(id).catch(console.error);
        }
      }
      if (this.sessions.size === 0 && this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
    }, 60 * 1000);
  }
}
export {};
