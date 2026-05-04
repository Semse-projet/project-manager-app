import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = "/home/yoni/labsemse/project-manager-app";
const reportRoot = "/home/yoni/labsemse/reportes";
const evidenceRoot = path.join(root, "docs/bcp/evidence");

const filesToInspect = [
  "apps/api/src/modules/evidence/evidence.controller.ts",
  "apps/web/app/jobs/[jobId]/evidence/page.tsx",
  "apps/web/app/(app)/admin/disputes/page.tsx",
  "apps/web/app/(app)/worker/tracker/page.tsx",
  "apps/web/app/(app)/worker/field-ops/page.tsx",
  "apps/web/app/api/semse/field-ops/facts/route.ts",
  "apps/web/app/semse-api.ts"
];

const legacyScanTargets = [
  "apps/api/src",
  "apps/web/app",
  "packages/knowledge/src"
];

async function walk(dir) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(rel));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(rel);
    }
  }
  return files;
}

async function main() {
  const legacyMentions = [];
  for (const target of legacyScanTargets) {
    const files = await walk(target);
    for (const rel of files) {
      const content = await readFile(path.join(root, rel), "utf8");
      if (content.includes("KnowledgeFact")) {
        legacyMentions.push(rel);
      }
    }
  }

  const inspected = {};
  for (const rel of filesToInspect) {
    const content = await readFile(path.join(root, rel), "utf8");
    inspected[rel] = {
      multipart: content.includes("multipart"),
      uploadMultipartPart: content.includes("uploadMultipartPart"),
      contextMemoryNaming: /Memoria contextual|ContextMemory|contextual/i.test(content)
    };
  }

  const status = {
    observedAt: new Date().toISOString(),
    summary: {
      multipartProvider: "filesystem_multipart",
      legacyMentionsInRuntimePaths: legacyMentions.length,
      contextualSurfacesObserved: Object.values(inspected).filter((item) => item.contextMemoryNaming || item.multipart).length
    },
    legacyMentions,
    inspected
  };

  await mkdir(evidenceRoot, { recursive: true });
  await mkdir(reportRoot, { recursive: true });

  const jsonPath = path.join(evidenceRoot, "post-legacy-observation-latest.json");
  const mdPath = path.join(reportRoot, "observacion_post_legado_operacion_asistida_2026-04-17.md");

  await writeFile(jsonPath, JSON.stringify(status, null, 2), "utf8");

  const markdown = `# Observacion Post-Legado de Operacion Asistida

- Fecha: 2026-04-17
- Estado: activo

## Resumen

- proveedor multipart actual: \`${status.summary.multipartProvider}\`
- menciones legacy en runtime: \`${status.summary.legacyMentionsInRuntimePaths}\`
- superficies observadas: \`${status.summary.contextualSurfacesObserved}\`

## Menciones legacy encontradas

${status.legacyMentions.length === 0 ? "- ninguna" : status.legacyMentions.map((item) => `- \`${item}\``).join("\n")}

## Superficies inspeccionadas

${Object.entries(inspected).map(([file, meta]) => `- \`${file}\`: multipart=${meta.multipart}, uploadMultipartPart=${meta.uploadMultipartPart}, contextMemoryNaming=${meta.contextMemoryNaming}`).join("\n")}
`;

  await writeFile(mdPath, markdown, "utf8");

  process.stdout.write(`${jsonPath}\n${mdPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
