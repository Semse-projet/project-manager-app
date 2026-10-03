#!/usr/bin/env node
/**
 * C51 etapa 3B — guarda de arquitectura de ResourceScope (INFORMATIVA / report-only).
 * Spec: docs/specs/platform/resource-scope.spec.md §3.2–§3.3
 *
 * Inventaría los endpoints de `apps/api` que direccionan un recurso (parámetro de ruta `:xxx`, o query
 * `...Id`/`...Ids`) y estima si su cadena de llamadas pasa por una política de dominio o por el contrato
 * ResourceScope (`common/resource-scope*`). NO es un gate de seguridad:
 *   - Usa el AST de TypeScript (no un grep): lee decoradores @Controller/@Get/…, la inyección del constructor
 *     y los imports/llamadas de los servicios (hasta 2 niveles: controller → servicio → repositorio/política).
 *   - La evidencia es ESTÁTICA y por módulo: puede haber falsos positivos (la política se aplica por otra vía)
 *     y falsos negativos (importa la política pero no la usa en esa ruta). Por eso el modo por defecto es
 *     `report` y NUNCA falla; convertirlo en bloqueante es otro PR, tras un ciclo verde y revisar falsos positivos.
 *   - Las excepciones reales viven en `docs/architecture/resource-scope-allowlist.json`, con motivo obligatorio.
 *
 * Uso:
 *   node scripts/architecture/resource-scope-inventory.mjs [--src=apps/api/src] [--allowlist=<json>]
 *        [--mode=report|enforce] [--json=<out.json>] [--markdown=<out.md>]
 * `--mode=enforce` (NO conectado a CI) sale con 1 si hay endpoints sin evidencia y sin allowlist.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const HTTP_DECORATORS = new Set(["Get", "Post", "Put", "Patch", "Delete", "All"]);
const PUBLIC_DECORATORS = new Set(["Public", "AuthenticatedAccess"]);
const RESOURCE_SCOPE_IMPORT = /(^|\/)resource-scope(\.resolver|\.module)?\.js$/;
const POLICY_IMPORT = /\.(policy|access|access-policy)\.js$|(^|\/)[\w-]*access[\w-]*\.(service|policy)\.js$/;

export function parseArgs(argv) {
  const out = { mode: "report" };
  for (const arg of argv) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(arg);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

function listFiles(dir, suffix, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      listFiles(full, suffix, acc);
    } else if (entry.name.endsWith(suffix) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".spec.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

const sourceCache = new Map();
function parse(file) {
  if (!sourceCache.has(file)) {
    sourceCache.set(file, ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true));
  }
  return sourceCache.get(file);
}

const decoratorsOf = (node) => (ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []);
function decoratorName(dec) {
  const e = dec.expression;
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) return e.expression.text;
  if (ts.isIdentifier(e)) return e.text;
  return null;
}
function decoratorFirstString(dec) {
  const e = dec.expression;
  if (ts.isCallExpression(e) && e.arguments.length > 0 && ts.isStringLiteralLike(e.arguments[0])) return e.arguments[0].text;
  return "";
}

/** import "x" → mapa nombreImportado → ruta relativa resuelta (solo imports relativos). */
function importMap(file) {
  const sf = parse(file);
  const map = new Map();
  const specifiers = [];
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    specifiers.push(spec);
    if (!spec.startsWith(".")) continue;
    const resolved = path.resolve(path.dirname(file), spec.replace(/\.js$/, ".ts"));
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) map.set(el.name.text, resolved);
  }
  return { map, specifiers };
}

function injectedDeps(classNode, imports) {
  const deps = new Map(); // nombre de la propiedad → archivo del tipo
  for (const member of classNode.members) {
    if (!ts.isConstructorDeclaration(member)) continue;
    for (const param of member.parameters) {
      if (!ts.isIdentifier(param.name) || !param.type || !ts.isTypeReferenceNode(param.type)) continue;
      const typeName = param.type.typeName.getText();
      const file = imports.map.get(typeName);
      if (file && fs.existsSync(file)) deps.set(param.name.text, file);
    }
  }
  return deps;
}

/** Evidencia propia de un archivo: "resource-scope" > "domain-policy" > null. */
function ownEvidence(file) {
  const { specifiers } = importMap(file);
  if (specifiers.some((s) => RESOURCE_SCOPE_IMPORT.test(s))) return "resource-scope";
  if (specifiers.some((s) => POLICY_IMPORT.test(s))) return "domain-policy";
  return null;
}
const RANK = { "resource-scope": 2, "domain-policy": 1 };
const best = (a, b) => ((RANK[a] ?? 0) >= (RANK[b] ?? 0) ? a : b);

/** Evidencia de un archivo de servicio incluyendo hasta `depth` niveles de lo que inyecta. */
function chainEvidence(file, depth, seen = new Set()) {
  if (seen.has(file)) return null;
  seen.add(file);
  let ev = ownEvidence(file);
  if (depth <= 0) return ev;
  const sf = parse(file);
  const imports = importMap(file);
  for (const stmt of sf.statements) {
    if (!ts.isClassDeclaration(stmt)) continue;
    for (const dep of injectedDeps(stmt, imports).values()) ev = best(ev, chainEvidence(dep, depth - 1, seen));
  }
  return ev;
}

function pathParams(routePath) {
  return [...routePath.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
}

function analyzeController(file, srcRoot) {
  const sf = parse(file);
  const imports = importMap(file);
  const controllerEvidence = ownEvidence(file);
  const routes = [];
  for (const stmt of sf.statements) {
    if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
    const ctrl = decoratorsOf(stmt).find((d) => decoratorName(d) === "Controller");
    if (!ctrl) continue;
    const prefix = decoratorFirstString(ctrl);
    const classDecorators = decoratorsOf(stmt).map(decoratorName);
    const deps = injectedDeps(stmt, imports);
    for (const member of stmt.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) continue;
      const decs = decoratorsOf(member);
      const http = decs.find((d) => HTTP_DECORATORS.has(decoratorName(d)));
      if (!http) continue;
      const routePath = [prefix, decoratorFirstString(http)].filter(Boolean).join("/").replace(/\/+/g, "/");
      const resourceIds = new Set(pathParams(routePath));
      for (const param of member.parameters) {
        for (const d of decoratorsOf(param)) {
          const n = decoratorName(d);
          const arg = decoratorFirstString(d);
          if (n === "Query" && /Ids?$/.test(arg)) resourceIds.add(arg);
          if (n === "Param" && arg) resourceIds.add(arg);
        }
      }
      if (resourceIds.size === 0) continue;

      // servicios que el handler realmente llama: this.<dep>.<método>(...)
      const called = new Set();
      const visit = (node) => {
        if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) called.add(node.expression.name.text);
        ts.forEachChild(node, visit);
      };
      if (member.body) visit(member.body);

      let evidence = controllerEvidence;
      for (const name of called) {
        const depFile = deps.get(name);
        if (depFile) evidence = best(evidence, chainEvidence(depFile, 2));
      }
      const methodDecorators = decs.map(decoratorName);
      const publicRoute = [...methodDecorators, ...classDecorators].some((n) => PUBLIC_DECORATORS.has(n));
      routes.push({
        file: path.relative(srcRoot, file).split(path.sep).join("/"),
        controller: stmt.name.text,
        handler: member.name.getText(),
        httpMethod: decoratorName(http).toUpperCase(),
        path: "/" + routePath.replace(/^\//, ""),
        resourceIds: [...resourceIds],
        permissionsOnly: methodDecorators.includes("RequirePermissions") || classDecorators.includes("RequirePermissions"),
        publicRoute,
        evidence,
      });
    }
  }
  return routes;
}

export function loadAllowlist(file) {
  if (!file || !fs.existsSync(file)) return { entries: [], errors: [] };
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const errors = [];
  entries.forEach((e, i) => {
    if (!e.file || !e.reason || String(e.reason).trim().length < 10) {
      errors.push(`allowlist[${i}] requiere "file" y un "reason" explícito (≥10 caracteres)`);
    }
  });
  return { entries, errors };
}

const matches = (entry, route) =>
  entry.file === route.file && (!entry.handler || entry.handler === route.handler || entry.handler === "*");

export function classify(route, allowEntries) {
  const allow = allowEntries.find((e) => matches(e, route));
  if (route.evidence === "resource-scope") return { ...route, status: "scoped" };
  if (route.evidence === "domain-policy") return { ...route, status: "domain-policy" };
  if (allow) return { ...route, status: "allowlisted", allowReason: allow.reason };
  if (route.publicRoute) return { ...route, status: "public-unscoped" };
  return { ...route, status: "no-evidence" };
}

export function buildReport({ srcRoot, allowlistFile }) {
  const files = listFiles(srcRoot, ".controller.ts").sort();
  const { entries: declared, errors } = loadAllowlist(allowlistFile);
  // Una entrada sin motivo explícito NO exime a nadie: se informa como error y no se aplica.
  const entries = declared.filter((e) => e.file && e.reason && String(e.reason).trim().length >= 10);
  const routes = files.flatMap((f) => analyzeController(f, srcRoot)).map((r) => classify(r, entries));
  const staleAllowlist = entries.filter((e) => !routes.some((r) => matches(e, r)));
  const counts = {};
  for (const r of routes) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return {
    mode: "report",
    controllers: files.length,
    resourceRoutes: routes.length,
    counts,
    candidates: routes.filter((r) => r.status === "no-evidence"),
    routes,
    allowlistErrors: errors,
    staleAllowlist,
  };
}

export function toMarkdown(report) {
  const c = report.counts;
  const lines = [
    "## ResourceScope — inventario de endpoints (INFORMATIVO, no bloquea CI)",
    "",
    "> Heurística estática por AST. Puede haber falsos positivos y falsos negativos: **no es un gate de seguridad**.",
    "> La evidencia es por módulo (controller → servicio → repositorio/política); `RequirePermissions` por sí solo NO cuenta como scope.",
    "",
    `Controllers: ${report.controllers} · rutas con identificador de recurso: ${report.resourceRoutes}`,
    "",
    "| Estado | Rutas |",
    "|---|---|",
    `| scoped (pasa por resource-scope / resolver) | ${c.scoped ?? 0} |`,
    `| domain-policy (política/acceso de dominio) | ${c["domain-policy"] ?? 0} |`,
    `| allowlisted (excepción documentada) | ${c.allowlisted ?? 0} |`,
    `| public-unscoped (@Public/@AuthenticatedAccess sin evidencia) | ${c["public-unscoped"] ?? 0} |`,
    `| **no-evidence (candidatos a revisar)** | **${c["no-evidence"] ?? 0}** |`,
    "",
  ];
  if (report.candidates.length > 0) {
    lines.push("### Candidatos (sin evidencia de scope ni allowlist)", "", "| Endpoint | Handler | Identificadores | Solo permisos |", "|---|---|---|---|");
    for (const r of report.candidates) {
      lines.push(`| \`${r.httpMethod} ${r.path}\` (\`${r.file}\`) | \`${r.controller}.${r.handler}\` | ${r.resourceIds.join(", ")} | ${r.permissionsOnly ? "sí" : "no"} |`);
    }
    lines.push("");
  }
  if (report.staleAllowlist.length > 0) {
    lines.push("### Entradas de allowlist obsoletas (no coinciden con ninguna ruta)", "");
    for (const e of report.staleAllowlist) lines.push(`- \`${e.file}\`${e.handler ? ` · ${e.handler}` : ""}`);
    lines.push("");
  }
  if (report.allowlistErrors.length > 0) {
    lines.push("### Errores de allowlist", "");
    for (const e of report.allowlistErrors) lines.push(`- ${e}`);
    lines.push("");
  }
  lines.push("_Modo report: este paso nunca falla el CI._");
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "..", "..");
  const srcRoot = path.resolve(root, typeof args.src === "string" ? args.src : "apps/api/src");
  const allowlistFile = path.resolve(root, typeof args.allowlist === "string" ? args.allowlist : "docs/architecture/resource-scope-allowlist.json");
  const mode = args.mode === "enforce" ? "enforce" : "report";

  let report;
  try {
    report = buildReport({ srcRoot, allowlistFile });
  } catch (error) {
    // En modo report un fallo del propio inventario no debe romper el CI: se informa y se sale en 0.
    console.log(`::warning title=ResourceScope inventario::no se pudo generar el inventario: ${error?.message ?? error}`);
    process.exit(mode === "enforce" ? 1 : 0);
  }
  report.mode = mode;
  const markdown = toMarkdown(report);
  if (typeof args.json === "string") fs.writeFileSync(path.resolve(args.json), JSON.stringify(report, null, 2));
  if (typeof args.markdown === "string") fs.writeFileSync(path.resolve(args.markdown), markdown);
  console.log(markdown);
  if (report.candidates.length > 0) {
    console.log(`::notice title=ResourceScope (informativo)::${report.candidates.length} endpoint(s) con identificador de recurso sin evidencia de scope; revisar el resumen.`);
  }
  const failing = report.candidates.length > 0 || report.allowlistErrors.length > 0;
  process.exit(mode === "enforce" && failing ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
