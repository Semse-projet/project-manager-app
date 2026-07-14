import { BrowserSessionPool } from "./session-pool.js";
import { SecureNetworkGateway } from "./secure-network-gateway.js";

export class BrowserToolRunner {
  static async navigate(sessionId: string, url: string): Promise<{ success: boolean; finalUrl: string; title: string; error?: string }> {
    if (!(await SecureNetworkGateway.isUrlSafe(url))) {
      throw new Error(`SSRF Block: URL is unsafe: ${url}`);
    }

    const session = await BrowserSessionPool.getOrCreateSession(sessionId);
    try {
      await session.page.goto(url, { waitUntil: "load", timeout: 30000 });
      return {
        success: true,
        finalUrl: session.page.url(),
        title: await session.page.title()
      };
    } catch (err: any) {
      return { success: false, finalUrl: url, title: "", error: err.message };
    }
  }

  static async getMarkdown(sessionId: string): Promise<{ success: boolean; markdown: string; error?: string }> {
    const session = await BrowserSessionPool.getOrCreateSession(sessionId);
    try {
      const html = await session.page.content();
      const markdown = this.htmlToMarkdown(html);
      return { success: true, markdown };
    } catch (err: any) {
      return { success: false, markdown: "", error: err.message };
    }
  }

  static async query(sessionId: string, selector: string): Promise<{ success: boolean; results: any[]; error?: string }> {
    const session = await BrowserSessionPool.getOrCreateSession(sessionId);
    try {
      const results = await session.page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map((el) => ({
          tagName: el.tagName.toLowerCase(),
          text: (el as HTMLElement).innerText || "",
          attributes: Array.from(el.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {} as Record<string, string>)
        }));
      }, selector);
      return { success: true, results };
    } catch (err: any) {
      return { success: false, results: [], error: err.message };
    }
  }

  static async click(sessionId: string, selector: string): Promise<{ success: boolean; error?: string }> {
    const session = await BrowserSessionPool.getOrCreateSession(sessionId);
    try {
      await session.page.click(selector, { timeout: 10000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static async fill(sessionId: string, selector: string, value: string): Promise<{ success: boolean; error?: string }> {
    const session = await BrowserSessionPool.getOrCreateSession(sessionId);
    try {
      await session.page.fill(selector, value, { timeout: 10000 });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static htmlToMarkdown(html: string): string {
    let text = html;
    
    // Remove scripts and styles
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    
    // Convert headings
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
    
    // Convert links
    text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
    
    // Remove other HTML tags
    text = text.replace(/<[^>]+>/g, " ");
    
    // Clean up whitespace
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n\s*\n+/g, "\n\n");
    
    return text.trim();
  }
}
export {};
