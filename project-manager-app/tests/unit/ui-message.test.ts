/**
 * Messages kept in React state must follow a later language switch
 * (KIT-F3-03, SEMSE quality kit): state holds the key, rendering translates.
 * Run: node --experimental-strip-types --test tests/unit/ui-message.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { messageKey, messageText, messageTextOr, renderMessage } from "../../apps/web/lib/ui-message.ts";

const dictionaries: Record<"es" | "en", Record<string, string>> = {
  es: { "clientDash.connectionError": "No se pudo conectar con el servidor.", "pt.estimateServerError": "No se pudo generar el estimado (error del servidor HTTP" },
  en: { "clientDash.connectionError": "Could not connect to the server.", "pt.estimateServerError": "Could not generate the estimate (server HTTP error" },
};
const tFor = (lang: "es" | "en") => (key: string) => dictionaries[lang][key] ?? key;

test("a stored key renders in whatever language is active when it is shown", () => {
  const stored = messageKey("clientDash.connectionError"); // set while the UI was in Spanish
  assert.equal(renderMessage(stored, tFor("es")), "No se pudo conectar con el servidor.");
  assert.equal(renderMessage(stored, tFor("en")), "Could not connect to the server.");
});

test("suffixes, server text and empty fallbacks", () => {
  assert.equal(renderMessage(messageKey("pt.estimateServerError", " 502)."), tFor("en")), "Could not generate the estimate (server HTTP error 502).");
  assert.equal(renderMessage(messageText("Job not found"), tFor("es")), "Job not found");
  assert.deepEqual(messageTextOr("  ", "clientDash.connectionError"), { key: "clientDash.connectionError" });
  assert.deepEqual(messageTextOr(undefined, "clientDash.connectionError"), { key: "clientDash.connectionError" });
  assert.deepEqual(messageTextOr("Authentication required", "clientDash.connectionError"), { text: "Authentication required" });
  assert.equal(renderMessage(null, tFor("es")), null);
});

function webSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) webSources(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// The argument of every `setX(...)` / `throw new Error(...)` call, brackets balanced.
function callArguments(source: string, callee: RegExp): Array<{ line: number; text: string }> {
  const found: Array<{ line: number; text: string }> = [];
  for (const match of source.matchAll(callee)) {
    let i = match.index! + match[0].length;
    let depth = 1;
    while (i < source.length && depth > 0) {
      if ("([{".includes(source[i])) depth++;
      else if (")]}".includes(source[i])) depth--;
      i++;
    }
    found.push({ line: source.slice(0, match.index).split("\n").length, text: source.slice(match.index, i) });
  }
  return found;
}

test("no web page stores or throws already-translated text", () => {
  const web = path.resolve(import.meta.dirname, "../../apps/web");
  const translated = /\bt\(\s*["'`]/;
  const offenders = webSources(web).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    if (!/useLanguage\(/.test(source)) return [];
    return [
      // setX(t("…")), setX(x ?? t("…")), setX(e ? e.message : t("…")), setX({ message: t("…") })… (callbacks excluded)
      ...callArguments(source, /\bset[A-Z]\w*\(/g).filter((call) => translated.test(call.text) && !call.text.includes("=>")),
      // throw new Error(t("…")) freezes the text too when the catch stores error.message
      ...callArguments(source, /\bthrow new Error\(/g).filter((call) => translated.test(call.text)),
    ].map((call) => `${path.relative(web, file)}:${call.line}`);
  });
  assert.deepEqual(offenders, [], "store messageKey()/messageText() from lib/ui-message.ts, throw UiMessageError, render with renderMessage()");
});
