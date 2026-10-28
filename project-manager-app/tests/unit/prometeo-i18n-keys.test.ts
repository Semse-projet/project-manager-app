/**
 * Prometeo admin ES/EN regression gates. Run from project-manager-app:
 * node --experimental-strip-types --test tests/unit/prometeo-i18n-keys.test.ts
 * Keep source-only checks: language-context.tsx is a client-side TSX module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dictionarySource = readFileSync(path.resolve(directory, "../../apps/web/lib/language-context.tsx"), "utf8");
const pageSource = readFileSync(path.resolve(directory, "../../apps/web/app/(app)/admin/prometeo/page.tsx"), "utf8");

function localeKeys(start: string, end: string): string[] {
  const from = dictionarySource.indexOf(start);
  const until = dictionarySource.indexOf(end, from + start.length);
  assert.ok(from >= 0 && until > from, `Could not locate dictionary block: ${start}`);
  const text = dictionarySource.slice(from, until);
  return [...text.matchAll(/^\s*"(prom\.[^"]+)":/gm)].map((entry) => entry[1]);
}

test("Prometeo translation keys are unique and symmetric in ES/EN", () => {
  const es = localeKeys("\n  es: {", "\n  en: {");
  const en = localeKeys("\n  en: {", "\nconst LanguageContext");
  assert.ok(es.length > 40, "Expected Prometeo translations");
  assert.equal(new Set(es).size, es.length, "Duplicate Spanish translation key");
  assert.equal(new Set(en).size, en.length, "Duplicate English translation key");
  assert.deepEqual([...es].sort(), [...en].sort());

  const referenced = [...pageSource.matchAll(/\bt\("(?<key>prom\.[^"]+)"\)/g)]
    .map((match) => match.groups?.key)
    .filter((key): key is string => !!key);
  for (const key of referenced) {
    assert.ok(es.includes(key), `Missing Prometeo translation: ${key}`);
  }

  for (const tab of ["docs", "library", "query", "search", "assets", "workorders"]) {
    assert.ok(es.includes(`prom.tab.${tab}`), `Missing tab label: ${tab}`);
  }
});

test("Trade library row never shadows the translation function", () => {
  assert.match(pageSource, /tradeLibrary\.map\(\(entry\)\s*=>/);
  assert.doesNotMatch(pageSource, /tradeLibrary\.map\(\(t\)\s*=>/);
});

test("Prometeo text ingestion forwards visibility and trade to the API", () => {
  assert.match(
    pageSource,
    /apiPost\("\/api\/semse\/prometeo\/ingest",\s*\{[^}]*trade:\s*ingestTrade,\s*visibility:\s*ingestVisibility/
  );
  assert.match(pageSource, /question:\s*ragQuestion,\s*locale:\s*language/);
});

test("PR #973 authenticated QA smoke fails closed and parses on the CI Node toolchain", () => {
  const qaSpecPath = path.resolve(directory, "../e2e-semse/i18n-pr973.spec.ts");
  const qaSpec = readFileSync(qaSpecPath, "utf8");
  for (const role of ["admin", "client", "worker"]) {
    assert.ok(qaSpec.includes(`loginAsQa(page, "${role}")`), `Missing QA login: ${role}`);
  }
  assert.match(qaSpec, /SEMSE_QA_ISOLATED_PREVIEW/);
  assert.match(qaSpec, /SEMSE_QA_\$\{role\.toUpperCase\(\)\}/);
  assert.match(qaSpec, /production target is forbidden/);
  assert.match(qaSpec, /login redirected outside approved preview origin/);
  assert.match(qaSpec, /trace: "off", screenshot: "off", video: "off"/);
  assert.doesNotMatch(qaSpec, /import \{ loginAs \} from "\.\/utils\/auth"/);
  const parse = spawnSync(process.execPath, ["--experimental-strip-types", "--check", qaSpecPath], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(parse.status, 0, `PR #973 QA test syntax check failed: ${parse.stderr || parse.error}`);
});

test("Prometeo file uploads avoid argument overflow and default to private", () => {
  assert.match(pageSource, /new FileReader\(\)/);
  assert.match(pageSource, /reader\.readAsDataURL\(file\)/);
  assert.match(pageSource, /const fileBase64 = await readFileAsBase64\(ingestFile\)/);
  assert.doesNotMatch(pageSource, /String\.fromCharCode\(\.\.\.new Uint8Array\(/);
  assert.match(pageSource, /\[ingestVisibility, setIngestVisibility\] = useState\("tenant_private"\)/);
  assert.doesNotMatch(pageSource, /\[ingestVisibility, setIngestVisibility\] = useState\("public_training"\)/);
});
