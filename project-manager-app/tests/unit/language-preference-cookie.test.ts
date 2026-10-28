/** The chosen language reaches the server through a cookie, so the first paint is not Spanish for EN users. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  languageCookie,
  parseLanguagePreference,
} from "../../apps/web/lib/language-preference.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("only es and en are accepted; anything else falls back", () => {
  assert.equal(parseLanguagePreference("en"), "en");
  assert.equal(parseLanguagePreference("es"), "es");
  for (const value of ["EN", "fr", "", "en; Path=/", undefined, null]) {
    assert.equal(parseLanguagePreference(value), null, String(value));
  }
  assert.equal(DEFAULT_LANGUAGE, "es");
});

test("the cookie keeps the old localStorage key, lasts a year and is site-wide", () => {
  assert.equal(LANGUAGE_STORAGE_KEY, "semse-language");
  assert.equal(languageCookie("en", false), "semse-language=en; Path=/; Max-Age=31536000; SameSite=Lax");
  assert.equal(languageCookie("es", true), "semse-language=es; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
});

test("the root layout renders <html lang> and the initial language from the cookie", () => {
  const layout = read("apps/web/app/layout.tsx");
  assert.match(layout, /export const dynamic = "force-dynamic";/, "reading cookies must not turn a static page dynamic");
  assert.match(layout, /\(await cookies\(\)\)\.get\(LANGUAGE_STORAGE_KEY\)/);
  assert.match(layout, /<html lang=\{language\}/);
  assert.match(layout, /<InitialLanguageProvider value=\{language\}>\{children\}<\/InitialLanguageProvider>/);
});

test("LanguageProvider starts from the server language and keeps cookie and localStorage in sync", () => {
  const context = read("apps/web/lib/language-context.tsx");
  assert.match(context, /useState<LanguagePreference>\(initialLanguage\)/);
  assert.doesNotMatch(context, /useState<LanguagePreference>\("es"\)/);
  assert.match(context, /document\.cookie = languageCookie\(lang, window\.location\.protocol === "https:"\)/);
  assert.match(context, /const effective = cookie \?\? saved \?\? initialLanguage;/);
});
