import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseInline, parseMarkdown } from "../../apps/web/lib/markdown-lite.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("negrita, cursiva, código y enlaces https en línea", () => {
  assert.deepEqual(parseInline("a **b** *c* `d` [e](https://x.io)"), [
    { type: "text", text: "a " },
    { type: "bold", text: "b" },
    { type: "text", text: " " },
    { type: "italic", text: "c" },
    { type: "text", text: " " },
    { type: "code", text: "d" },
    { type: "text", text: " " },
    { type: "link", text: "e", href: "https://x.io" },
  ]);
});

test("un enlace javascript: o con HTML nunca se vuelve enlace", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,<b>x</b>", "//evil.com", "vbscript:x"]) {
    const parts = parseInline(`[clic](${href})`);
    assert.equal(parts.some((p) => p.type === "link"), false, href);
  }
});

test("el HTML del modelo queda como texto, nunca como marcado", () => {
  const blocks = parseMarkdown("<img src=x onerror=alert(1)> y <script>alert(2)</script>");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.type, "paragraph");
  const inline = (blocks[0] as { inline: Array<{ type: string; text: string }> }).inline;
  assert.ok(inline.every((p) => p.type === "text"));
  assert.match(inline.map((p) => p.text).join(""), /<script>/);
});

test("encabezados, listas, regla y código", () => {
  const blocks = parseMarkdown("### Título\n\n- uno\n- dos\n\n1. a\n2. b\n\n---\n\n```\ncódigo\n```");
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "list", "list", "rule", "code"],
  );
  assert.equal((blocks[0] as { level: number }).level, 3);
  assert.equal((blocks[1] as { ordered: boolean }).ordered, false);
  assert.equal((blocks[2] as { ordered: boolean }).ordered, true);
  assert.equal((blocks[4] as { text: string }).text, "código");
});

test("la tabla del copiloto (caso real de producción) se parsea con cabecera y filas", () => {
  const source = [
    "Los otros pilares:",
    "| Pilar | Score | Estado |",
    "|---|---|---|",
    "| Trust | 56/100 | Watch |",
    "| Execution | 87/100 | Strong |",
  ].join("\n");
  const [intro, table] = parseMarkdown(source);
  assert.equal(intro!.type, "paragraph");
  assert.equal(table!.type, "table");
  const t = table as { header: unknown[][]; rows: unknown[][][] };
  assert.equal(t.header.length, 3);
  assert.equal(t.rows.length, 2);
});

test("las líneas seguidas forman un solo párrafo", () => {
  const blocks = parseMarkdown("línea uno\nlínea dos\n\notro");
  assert.equal(blocks.length, 2);
});

test("la página del copiloto de proyecto pinta las respuestas con MarkdownLite y el chat nunca colapsa a 1 px", () => {
  const page = readFileSync(path.join(repoRoot, "apps/web/app/(app)/client/projects/[projectId]/copilot/page.tsx"), "utf8");
  assert.match(page, /msg\.role === "assistant" \? <MarkdownLite text=\{msg\.content\} \/> : msg\.content/);
  // Con `height` fijo y `minHeight: 0` el panel del chat medía 1 px en ventanas bajas y el campo quedaba recortado.
  assert.doesNotMatch(page, /gap: "16px", height: "calc\(100vh - 120px\)"/);
  assert.match(page, /gap: "16px", minHeight: "calc\(100vh - 120px\)"/);
  assert.match(page, /flex: 1, minHeight: 420,/);
  const component = readFileSync(path.join(repoRoot, "apps/web/app/components/prometeo/MarkdownLite.tsx"), "utf8");
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
});

test("el widget flotante también pinta las respuestas del asistente con MarkdownLite (los mensajes del usuario, como texto)", () => {
  const chat = readFileSync(path.join(repoRoot, "apps/web/app/components/prometeo/CopilotChat.tsx"), "utf8");
  assert.match(chat, /m\.role === "assistant" \? <MarkdownLite text=\{m\.content\} \/> : m\.content/);
});
