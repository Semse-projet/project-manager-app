import test from "node:test";
import assert from "node:assert/strict";
import { BrowserSessionPool } from "../../packages/autonomy/dist/browser/session-pool.js";
import { BrowserToolRunner } from "../../packages/autonomy/dist/browser/browser-tool-runner.js";

test("browser-mission: session pool creates and manages warm sessions", async () => {
  const sessionId = "test-session-123";
  const session1 = await BrowserSessionPool.getOrCreateSession(sessionId);
  assert.ok(session1.page);
  assert.ok(session1.context);
  assert.ok(session1.browser);

  const session2 = await BrowserSessionPool.getOrCreateSession(sessionId);
  assert.equal(session1.page, session2.page, "Should reuse page instance");

  await BrowserSessionPool.closeSession(sessionId);
});

test("browser-mission: htmlToMarkdown basic conversions", () => {
  const html = `
    <html>
      <head><style>body { color: red; }</style></head>
      <body>
        <h1>Hello World</h1>
        <p>This is a <a href="https://example.com">link</a>.</p>
        <script>console.log('test')</script>
      </body>
    </html>
  `;

  const md = BrowserToolRunner.htmlToMarkdown(html);
  assert.ok(md.includes("# Hello World"));
  assert.ok(md.includes("[link](https://example.com)"));
  assert.ok(!md.includes("<script>"));
  assert.ok(!md.includes("<style>"));
});
export {};
