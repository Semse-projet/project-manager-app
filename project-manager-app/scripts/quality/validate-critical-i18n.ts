#!/usr/bin/env node
// Critical ES/EN catalog validator for apps/web (SEMSE quality kit, phase 3).
//
//   node --experimental-strip-types scripts/quality/validate-critical-i18n.ts          # report, exit 1 on errors
//   node --experimental-strip-types scripts/quality/validate-critical-i18n.ts --json   # machine-readable
//
// Reads source as text (the catalogs live in "use client" React modules that
// node's strip-types loader cannot execute) and checks, for the central
// dictionary in apps/web/lib/language-context.tsx and every page-local
// `const COPY = { es: {...}, en: {...} }`:
//   - key parity between es and en (nested keys flattened with dots)
//   - no empty values
//   - same interpolation placeholders ({x}, {{x}}, %s, ${x}) in both languages
//   - function-valued entries (plurals, interpolation) are functions in both,
//     with the same parameter names
//   - no Spanish text left in English values
//   - critical messages (errors, permissions, payments, confirmations) exist,
//     are non-empty and are not copied verbatim between languages (warning)
//   - every static t("key") used in apps/web exists, and every dynamic
//     t(`prefix.${x}`) has at least one key under its static prefix
//   - translated text stored in React state (warning): it will not follow a
//     later language switch
// Exceptions live in scripts/quality/i18n-allowlist.json, each with a reason.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type Entry = { kind: "string" | "template" | "function" | "other"; raw: string; params: string[] };
export type Catalog = { file: string; name: string; es: Map<string, Entry>; en: Map<string, Entry> };
export type Finding = { level: "error" | "warning"; code: string; where: string; key?: string; message: string };
export type Allowlist = Record<string, Record<string, string>>;

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const WEB_ROOT = join(PROJECT_ROOT, "apps/web");
const CENTRAL = "apps/web/lib/language-context.tsx";
const ALLOWLIST_PATH = join(PROJECT_ROOT, "scripts/quality/i18n-allowlist.json");

// Keys whose text a user must understand to avoid losing money, data or access.
export const CRITICAL_KEY = /(^|[._])(error|errors|err|fail|failed|failure|denied|forbidden|unauthorized|permission|permissions|payment|payments|pay|escrow|refund|payout|confirm|confirmation|delete|remove|cancel|consent|warning|blocked|invalid|expired)([._A-Z]|$)/i;
const SPANISH_ONLY = /[ñáéíóú¿¡]/i;
const IGNORED_DIRS = new Set(["node_modules", ".next", "dist", "build", "coverage"]);

// ── Object-literal parser (just enough for translation catalogs) ────────────

function skipSpaceAndComments(src: string, i: number): number {
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src.startsWith("//", i)) {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
    } else {
      return i;
    }
  }
}

function readQuoted(src: string, i: number): number {
  const quote = src[i];
  i++;
  while (i < src.length && src[i] !== quote) i += src[i] === "\\" ? 2 : 1;
  return i + 1;
}

function readTemplate(src: string, i: number): number {
  i++;
  while (i < src.length && src[i] !== "`") {
    if (src[i] === "\\") i += 2;
    else if (src.startsWith("${", i)) i = readBalanced(src, i + 1);
    else i++;
  }
  return i + 1;
}

// From an opening bracket at i, returns the index just past its match.
function readBalanced(src: string, i: number): number {
  const open = src[i];
  const close = open === "{" ? "}" : open === "(" ? ")" : "]";
  let depth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { i = readQuoted(src, i); continue; }
    if (ch === "`") { i = readTemplate(src, i); continue; }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return i + 1;
    i++;
  }
  return i;
}

// Reads an expression up to the next top-level "," or the closing "}".
function readExpression(src: string, i: number): number {
  while (i < src.length) {
    const ch = src[i];
    if (ch === "," || ch === "}") return i;
    if (ch === '"' || ch === "'") i = readQuoted(src, i);
    else if (ch === "`") i = readTemplate(src, i);
    else if (ch === "{" || ch === "(" || ch === "[") i = readBalanced(src, i);
    else i++;
  }
  return i;
}

// Skips a type assertion after a value (`as const`, `as Record<string, string>`,
// `satisfies X`), whose generic arguments may contain top-level commas.
function skipTypeAssertion(src: string, i: number): number {
  i = skipSpaceAndComments(src, i);
  if (!/^(as|satisfies)\b/.test(src.slice(i, i + 10))) return i;
  let angle = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "<") angle++;
    else if (ch === ">") angle--;
    else if (angle === 0 && (ch === "," || ch === "}")) return i;
    else if (ch === "{" || ch === "(" || ch === "[") { i = readBalanced(src, i); continue; }
    i++;
  }
  return i;
}

function functionParams(raw: string): string[] {
  const m = raw.match(/^(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*(?::[^=]+)?=>/);
  if (!m) return [];
  const list = m[1] ?? m[2] ?? "";
  return list.split(",").map((p) => p.trim().replace(/^\.\.\./, "").split(/[?:=\s]/)[0]).filter(Boolean);
}

// Parses the object literal whose "{" is at `start` into flattened entries.
export function parseObjectLiteral(src: string, start: number, prefix = "", out = new Map<string, Entry>()): Map<string, Entry> {
  let i = start + 1;
  const seen = new Set<string>();
  for (;;) {
    i = skipSpaceAndComments(src, i);
    if (i >= src.length || src[i] === "}") return out;
    let key: string;
    if (src[i] === '"' || src[i] === "'") {
      const end = readQuoted(src, i);
      key = src.slice(i + 1, end - 1);
      i = end;
    } else {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
      if (!m) throw new Error(`unexpected token at offset ${i}: ${JSON.stringify(src.slice(i, i + 30))}`);
      key = m[0];
      i += key.length;
    }
    i = skipSpaceAndComments(src, i);
    if (src[i] !== ":") throw new Error(`expected ":" after key ${key} at offset ${i}`);
    i = skipSpaceAndComments(src, i + 1);
    const full = prefix ? `${prefix}.${key}` : key;
    if (seen.has(key) || out.has(full)) throw new Error(`duplicate-key: ${full}`);
    seen.add(key);
    if (src[i] === "{") {
      parseObjectLiteral(src, i, full, out);
      i = skipTypeAssertion(src, readBalanced(src, i));
    } else {
      const end = readExpression(src, i);
      const raw = src.slice(i, end).trim();
      const kind = /^["']/.test(raw) ? "string" : raw.startsWith("`") ? "template" : /=>/.test(raw) ? "function" : "other";
      out.set(full, { kind, raw, params: kind === "function" ? functionParams(raw) : [] });
      i = end;
    }
    i = skipSpaceAndComments(src, i);
    if (src[i] === ",") i++;
  }
}

function findProperty(src: string, from: number, to: number, name: string): number {
  // Accept both multiline and compact `}, en: {` catalog properties.
  // The previous newline-only matcher silently skipped compact fixtures.
  const re = new RegExp(`(?:\\n|,)\\s*${name}\\s*:\\s*\\{`, "g");
  re.lastIndex = from;
  const m = re.exec(src);
  return m && m.index < to ? src.indexOf("{", m.index + 1) : -1;
}

// Finds every `{ es: {...}, en: {...} }` catalog object in a source file.
export function extractCatalogs(src: string, file: string, problems: Finding[] = []): Catalog[] {
  const catalogs: Catalog[] = [];
  const decl = /\n(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*\{\s*\n\s*es\s*:\s*\{/g;
  for (const m of src.matchAll(decl)) {
    const open = src.indexOf("{", m.index! + m[0].indexOf("="));
    const close = readBalanced(src, open);
    const esAt = findProperty(src, open, close, "es");
    const enAt = findProperty(src, open, close, "en");
    if (esAt === -1 || enAt === -1) continue;
    try {
      catalogs.push({ file, name: m[1], es: parseObjectLiteral(src, esAt), en: parseObjectLiteral(src, enAt) });
    } catch (err) {
      // An unreadable catalog is a finding, never a silent pass.
      const message = (err as Error).message;
      const duplicateKey = message.startsWith("duplicate-key: ") ? message.slice("duplicate-key: ".length) : undefined;
      problems.push({ level: "error", code: duplicateKey ? "duplicate-key" : "unparseable-catalog", where: `${file} (${m[1]})`, ...(duplicateKey ? { key: duplicateKey } : {}), message });
    }
  }
  return catalogs;
}

// ── Checks ──────────────────────────────────────────────────────────────────

function textOf(entry: Entry): string {
  if (entry.kind === "string") {
    try { return JSON.parse(entry.raw.startsWith("'") ? `"${entry.raw.slice(1, -1).replace(/"/g, '\\"')}"` : entry.raw); } catch { return entry.raw.slice(1, -1); }
  }
  if (entry.kind === "template") return entry.raw.slice(1, -1);
  const body = entry.raw.slice(entry.raw.indexOf("=>") + 2).trim();
  return body.replace(/^[`"']|[`"']$/g, "");
}

export function placeholders(entry: Entry): string[] {
  const text = entry.kind === "string" ? textOf(entry) : entry.raw;
  const found = new Set<string>();
  for (const m of text.matchAll(/\$\{\s*([A-Za-z_$][\w$.]*)/g)) found.add(`\${${m[1]}}`);
  if (entry.kind === "string") {
    for (const m of text.matchAll(/\{\{\s*([A-Za-z_][\w.]*)\s*\}\}|\{([A-Za-z_][\w.]*)\}/g)) found.add(`{${m[1] ?? m[2]}}`);
    for (const m of text.matchAll(/%[sd]/g)) found.add(m[0]);
  }
  return [...found].sort();
}

function allowed(allowlist: Allowlist, rule: string, key: string): boolean {
  return Boolean(allowlist[rule]?.[key]);
}

export function checkCatalog(catalog: Catalog, allowlist: Allowlist = {}): Finding[] {
  const findings: Finding[] = [];
  const where = catalog.file === CENTRAL ? CENTRAL : `${catalog.file} (${catalog.name})`;
  const scoped = (key: string) => (catalog.file === CENTRAL ? key : `${catalog.file}#${key}`);
  const add = (level: Finding["level"], code: string, key: string, message: string) => {
    if (!allowed(allowlist, code, scoped(key))) findings.push({ level, code, where, key, message });
  };
  for (const [lang, other, otherLang] of [[catalog.es, catalog.en, "en"], [catalog.en, catalog.es, "es"]] as const) {
    for (const key of lang.keys()) if (!other.has(key)) add("error", "missing-key", key, `exists only in ${otherLang === "en" ? "es" : "en"}; missing in ${otherLang}`);
  }
  for (const [key, es] of catalog.es) {
    const en = catalog.en.get(key);
    if (!en) continue;
    for (const [lang, entry] of [["es", es], ["en", en]] as const) {
      if (entry.kind !== "function" && textOf(entry).trim() === "") add("error", "empty-value", key, `empty ${lang} value`);
    }
    const shapeDiffers = (es.kind === "function") !== (en.kind === "function");
    if (shapeDiffers) {
      add("error", "function-mismatch", key, `es is ${es.kind}, en is ${en.kind}: plurals/interpolation must have the same shape`);
    } else if (es.kind === "function" && es.params.join(",") !== en.params.join(",")) {
      add("error", "function-mismatch", key, `parameters differ: es (${es.params.join(", ")}) vs en (${en.params.join(", ")})`);
    }
    const pe = placeholders(es).join(" ");
    const pn = placeholders(en).join(" ");
    // A shape mismatch already explains differing placeholders; report it once.
    if (!shapeDiffers && pe !== pn) add("error", "placeholder-mismatch", key, `placeholders differ: es [${pe}] vs en [${pn}]`);
    if (SPANISH_ONLY.test(textOf(en))) add("error", "spanish-in-en", key, `English value looks untranslated: ${JSON.stringify(textOf(en))}`);
    if (CRITICAL_KEY.test(key) && es.kind !== "function" && textOf(es) === textOf(en)) {
      add("warning", "critical-identical", key, `critical message is identical in es and en: ${JSON.stringify(textOf(es))}`);
    }
  }
  return findings;
}

export function checkUsages(files: Array<{ file: string; src: string }>, central: Catalog, allowlist: Allowlist = {}): Finding[] {
  const findings: Finding[] = [];
  const keys = [...central.es.keys()];
  const known = new Set(keys);
  for (const { file, src } of files) {
    if (file === CENTRAL || !/useLanguage\s*\(/.test(src)) continue;
    // A file that defines its own `t` is not reading the central dictionary.
    if (/(?:const|let|function)\s+t\s*[=(]/.test(src)) continue;
    for (const m of src.matchAll(/\bt\(\s*["']([^"'\n]+)["']\s*\)/g)) {
      if (!known.has(m[1]) && !allowed(allowlist, "raw-key", m[1])) {
        findings.push({ level: "error", code: "raw-key", where: file, key: m[1], message: "t() key is not in the central dictionary: the UI would show the raw key" });
      }
    }
    // Text translated at fetch time and kept in state stays in the old language
    // after a switch (seen live: clientDash.jobsLoadError shown in Spanish in EN).
    // The whole argument is scanned, so `x ?? t(…)`, `e ? e.message : t(…)`,
    // `{ message: t(…) }` and `throw new Error(t(…))` (stored later from the
    // catch) are caught too; state-updater callbacks (`prev => …`) are not.
    for (const m of src.matchAll(/\b(set[A-Z]\w*|throw new Error)\(/g)) {
      const open = m.index! + m[0].length - 1;
      const argument = src.slice(open, readBalanced(src, open));
      const key = /\bt\(\s*["'`]([^"'`]+)["'`]/.exec(argument)?.[1];
      if (!key || (m[1] !== "throw new Error" && argument.includes("=>"))) continue;
      if (!allowed(allowlist, "translated-text-in-state", `${file}#${key}`)) {
        findings.push({ level: "warning", code: "translated-text-in-state", where: file, key, message: `${m[1]}(… t(...) …) freezes the text in the current language; store the key or the raw error and translate when rendering` });
      }
    }
    for (const m of src.matchAll(/\bt\(\s*`([^`$]*)\$\{/g)) {
      const prefix = m[1];
      if (prefix && !keys.some((k) => k.startsWith(prefix)) && !allowed(allowlist, "raw-key-prefix", prefix)) {
        findings.push({ level: "error", code: "raw-key-prefix", where: file, key: `${prefix}*`, message: "no dictionary key starts with this dynamic t() prefix" });
      }
    }
  }
  return findings;
}

// ── Repository scan ─────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(path);
  }
  return out;
}

export function loadAllowlist(path = ALLOWLIST_PATH): Allowlist {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const list: Allowlist = {};
  for (const [rule, entries] of Object.entries(raw)) {
    if (rule.startsWith("_")) continue;
    list[rule] = {};
    for (const [key, reason] of Object.entries(entries as Record<string, unknown>)) {
      if (typeof reason !== "string" || reason.trim().length < 10) throw new Error(`allowlist ${rule}/${key} needs a written reason`);
      list[rule][key] = reason;
    }
  }
  return list;
}

export function validateRepository(allowlist = loadAllowlist()) {
  const files = walk(WEB_ROOT).map((path) => ({ file: relative(PROJECT_ROOT, path).split("\\").join("/"), src: readFileSync(path, "utf8") }));
  const problems: Finding[] = [];
  const catalogs = files.flatMap(({ file, src }) => (/\n\s*es\s*:\s*\{/.test(src) && /\n\s*en\s*:\s*\{/.test(src) ? extractCatalogs(src, file, problems) : []));
  const central = catalogs.find((c) => c.file === CENTRAL && c.name === "T");
  if (!central) throw new Error(`central dictionary T not found in ${CENTRAL}`);
  const findings = [...problems, ...catalogs.flatMap((c) => checkCatalog(c, allowlist)), ...checkUsages(files, central, allowlist)];
  return {
    catalogs: catalogs.map((c) => ({ file: c.file, name: c.name, es: c.es.size, en: c.en.size })),
    errors: findings.filter((f) => f.level === "error"),
    warnings: findings.filter((f) => f.level === "warning"),
  };
}

function main(argv: string[]): number {
  const result = validateRepository();
  if (argv.includes("--json")) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const keys = result.catalogs.reduce((n, c) => n + c.es, 0);
    console.log(`i18n: ${result.catalogs.length} catalogs, ${keys} es keys`);
    for (const f of [...result.errors, ...result.warnings]) {
      console.log(`  ${f.level === "error" ? "ERROR" : "warn "} ${f.code.padEnd(20)} ${f.where}${f.key ? `  ${f.key}` : ""}\n        ${f.message}`);
    }
    console.log(`\n  ${result.errors.length} errors, ${result.warnings.length} warnings`);
  }
  return result.errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
