import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function headerValue(
  entry: { headers: Array<{ key: string; value: string }> } | undefined,
  key: string,
): string | undefined {
  return entry?.headers.find((header) => header.key === key)?.value;
}

test("el modo embebido mantiene protegidas las rutas autenticadas y sólo relaja el mapa público", async () => {
  process.env.SEMSE_PREVIEW_EMBEDDED = "true";
  const { default: config } = await import("../../apps/web/next.config.ts?embedded-preview");
  const entries = await config.headers?.();
  assert.ok(entries);

  const general = entries.find((entry) => entry.source === "/:path*");
  const map = entries.find((entry) => entry.source === "/semse-consciousness-map");
  assert.match(headerValue(general, "Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(headerValue(general, "X-Frame-Options"), "DENY");
  assert.ok(map, "el mapa público necesita una excepción explícita y limitada");
  assert.match(
    headerValue(map, "Content-Security-Policy") ?? "",
    /frame-ancestors 'self' https:\/\/kimi\.com https:\/\/\*\.kimi\.com/,
  );
  assert.equal(headerValue(map, "X-Frame-Options"), "SAMEORIGIN");
});

test("sin modo embebido todas las rutas conservan la protección anti-clickjacking", async () => {
  delete process.env.SEMSE_PREVIEW_EMBEDDED;
  const { default: config } = await import("../../apps/web/next.config.ts?default-preview");
  const entries = await config.headers?.();
  assert.ok(entries);
  const general = entries.find((entry) => entry.source === "/:path*");
  assert.match(headerValue(general, "Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(headerValue(general, "X-Frame-Options"), "DENY");
  assert.equal(entries.find((entry) => entry.source === "/semse-consciousness-map"), undefined);
});

test("la imagen web opcional no activa el modo embebido por defecto", async () => {
  const dockerfile = await readFile(new URL("../../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /ARG SEMSE_PREVIEW_EMBEDDED=false/);
  assert.doesNotMatch(dockerfile, /ARG SEMSE_PREVIEW_EMBEDDED=true/);
});
