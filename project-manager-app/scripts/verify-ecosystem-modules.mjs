#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const modules = [
  {
    id: "core",
    title: "SEMSE Core",
    nestModules: ["AuthModule", "UsersModule", "OrganizationsModule"],
    controller: "apps/api/src/modules/users/users.controller.ts",
    routeToken: '@Controller("v1/users")',
    apiProbe: "/v1/users",
  },
  {
    id: "connect",
    title: "SEMSE Connect",
    nestModules: ["JobsModule", "MarketplaceModule", "MatchingModule"],
    controller: "apps/api/src/modules/jobs/jobs.controller.ts",
    routeToken: '@Controller("v1/jobs")',
    apiProbe: "/v1/jobs",
  },
  {
    id: "payments",
    title: "SEMSE Payments",
    nestModules: ["PaymentsModule", "PaymentGovernanceModule", "FinanceModule"],
    controller: "apps/api/src/modules/payments/payments.controller.ts",
    routeToken: '@Get("v1/payments/provider-readiness")',
    apiProbe: "/v1/payments/provider-readiness",
  },
  {
    id: "trust",
    title: "SEMSE Trust",
    nestModules: ["TrustModule", "RatingsModule", "GovernanceModule"],
    controller: "apps/api/src/modules/trust/trust.controller.ts",
    routeToken: '@Get("v1/jobs/:jobId/trust")',
    apiProbe: "/v1/jobs/module-probe/trust",
  },
  {
    id: "ai",
    title: "SEMSE AI",
    nestModules: ["PrometeoModule", "AgentsModule", "AiModelsModule", "VisionModule"],
    controller: "apps/api/src/modules/prometeo/prometeo.controller.ts",
    routeToken: '@Get("tools")',
    apiProbe: "/v1/prometeo/tools",
  },
  {
    id: "agro",
    title: "SEMSE Agro",
    nestModules: ["AgroModule"],
    controller: "apps/api/src/modules/agro/agro-farm.controller.ts",
    routeToken: '@Get("farms")',
    apiProbe: "/v1/agro/farms",
  },
  {
    id: "buildops",
    title: "SEMSE BuildOps",
    nestModules: ["BuildOpsModule", "ProjectsModule", "MilestonesModule", "ToolsModule"],
    controller: "apps/api/src/modules/buildops/buildops.controller.ts",
    routeToken: '@Get("overview")',
    apiProbe: "/v1/buildops/overview",
  },
  {
    id: "knowledge",
    title: "SEMSE Knowledge",
    nestModules: ["KnowledgeModule", "RepoKnowledgeModule", "RuntimeKnowledgeModule"],
    controller: "apps/api/src/modules/knowledge/knowledge.controller.ts",
    routeToken: '@Get("overview")',
    apiProbe: "/v1/knowledge/overview",
  },
  {
    id: "integrations",
    title: "SEMSE Integrations",
    nestModules: ["CommunicationsModule", "SatellitesModule", "DomainEventsModule"],
    controller: "apps/api/src/modules/satellites/satellites.controller.ts",
    routeToken: '@Get("me")',
    apiProbe: "/v1/satellites/me",
  },
];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function count(source, token) {
  return source.split(token).length - 1;
}

function detailBlock(source, id) {
  const startToken = `\n  ${id}: {`;
  const start = source.indexOf(startToken);
  if (start === -1) return "";
  const end = source.indexOf("\n  },", start + startToken.length);
  return end === -1 ? source.slice(start) : source.slice(start, end + 5);
}

const appModule = read("apps/api/src/app.module.ts");
const appImportsMatch = appModule.match(/@Module\(\{[\s\S]*?imports:\s*\[([\s\S]*?)\],\s*controllers:/);
const appImports = appImportsMatch?.[1] ?? "";
const landing = read("apps/web/components/landing/landing-routes.ts");
const hubStart = landing.indexOf("export const hubModules");
const hubEnd = landing.indexOf("export const operatingFlowSteps", hubStart);
const hub = hubStart === -1 || hubEnd === -1 ? "" : landing.slice(hubStart, hubEnd);
const detailPage = read("apps/web/app/(public)/modules/[id]/page.tsx");
const taxonomy = read("docs/SEMSE_CONNECT_TAXONOMY.md");
const productionGate = read(path.join("..", ".github", "workflows", "deploy.yml"));
const errors = [];

if (!appImportsMatch) errors.push("No se pudo resolver el array imports de AppModule");
if (!hub) errors.push("No se pudo resolver el catálogo hubModules");

for (const [index, module] of modules.entries()) {
  const webProbe = `/modules/${module.id}`;
  const heading = `### ${index + 1}. ${module.title}`;
  const block = detailBlock(detailPage, module.id);

  if (count(hub, `id: "${module.id}"`) !== 1) {
    errors.push(`${module.id}: debe existir exactamente una vez en hubModules`);
  }
  if (!hub.includes(`title: "${module.title}"`)) {
    errors.push(`${module.id}: hubModules no usa el título canónico '${module.title}'`);
  }
  if (!hub.includes(`href: "${webProbe}"`)) {
    errors.push(`${module.id}: hubModules no enlaza ${webProbe}`);
  }
  if (!block || !block.includes(`title: "${module.title}"`)) {
    errors.push(`${module.id}: la página pública no usa el título canónico '${module.title}'`);
  }
  if (!taxonomy.includes(heading)) {
    errors.push(`${module.id}: falta heading canónico '${heading}' en la taxonomía`);
  }

  for (const nestModule of module.nestModules) {
    if (!new RegExp(`\\b${nestModule}\\b`).test(appImports)) {
      errors.push(`${module.id}: ${nestModule} no está montado en AppModule`);
    }
  }

  const controller = read(module.controller);
  if (!controller.includes(module.routeToken)) {
    errors.push(`${module.id}: no se encontró la ruta representativa en ${module.controller}`);
  }
  if (!productionGate.includes(module.apiProbe)) {
    errors.push(`${module.id}: Production Health Gate no prueba ${module.apiProbe}`);
  }
  if (!productionGate.includes(webProbe)) {
    errors.push(`${module.id}: Production Health Gate no prueba ${webProbe}`);
  }
}

if (errors.length > 0) {
  console.error("verify-ecosystem-modules: failed");
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log("verify-ecosystem-modules");
console.log(`  módulos canónicos: ${modules.length}`);
console.log("  capas: taxonomía, catálogo web, página pública, AppModule, ruta API y gate Railway");
for (const module of modules) {
  console.log(`  ✓ ${module.title}: ${module.apiProbe} · /modules/${module.id}`);
}
