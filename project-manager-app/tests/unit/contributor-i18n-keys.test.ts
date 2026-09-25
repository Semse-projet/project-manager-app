/**
 * Regression test: every "contributors.*" i18n key defined in the Spanish
 * dictionary must also exist in English, and vice versa — the Contributor
 * Program's public pages must never fall back to a raw key in either
 * locale. Parses the source file as text rather than importing the "use
 * client" React module (which node's --experimental-strip-types loader
 * cannot execute, since it only strips types, not JSX).
 * Run: node --experimental-strip-types --test tests/unit/contributor-i18n-keys.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const languageContextPath = path.resolve(
  __dirname,
  "../../apps/web/lib/language-context.tsx"
);

function extractDictionary(source: string, blockStartMarker: string, blockEndMarker: string): Set<string> {
  const startIndex = source.indexOf(blockStartMarker);
  assert.ok(startIndex >= 0, `could not find "${blockStartMarker}" in language-context.tsx`);
  const endIndex = source.indexOf(blockEndMarker, startIndex);
  assert.ok(endIndex > startIndex, `could not find "${blockEndMarker}" after "${blockStartMarker}"`);
  const block = source.slice(startIndex, endIndex);

  const keys = new Set<string>();
  const keyPattern = /"(contributors\.[a-zA-Z0-9.]+)":/g;
  let match: RegExpExecArray | null;
  while ((match = keyPattern.exec(block)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

test("every contributors.* key exists in both Spanish and English dictionaries", () => {
  const source = readFileSync(languageContextPath, "utf8");

  const esKeys = extractDictionary(source, "\n  es: {", "\n  en: {");
  const enKeys = extractDictionary(source, "\n  en: {", "\nconst LanguageContext");

  assert.ok(esKeys.size > 0, "expected to find contributors.* keys in the Spanish dictionary");
  assert.ok(enKeys.size > 0, "expected to find contributors.* keys in the English dictionary");

  const missingInEnglish = [...esKeys].filter((key) => !enKeys.has(key));
  const missingInSpanish = [...enKeys].filter((key) => !esKeys.has(key));

  assert.deepEqual(missingInEnglish, [], "keys present in es but missing in en");
  assert.deepEqual(missingInSpanish, [], "keys present in en but missing in es");
});
