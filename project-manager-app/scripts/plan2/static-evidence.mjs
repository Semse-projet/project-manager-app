#!/usr/bin/env node
// Plan 2 — evidencia estática reproducible (solo lectura del repositorio).
//
// No contacta servicios, no lee datos de usuarios ni de producción, no escribe
// en el repositorio. Recorre archivos fuente y comprueba patrones concretos que
// sostienen (o refutan) los bloqueos C (extracción TimeEntry) y D (Evidence)
// del Plan 2. Imprime JSON con ruta, línea, blob SHA de git y resultado.
//
// Uso (desde project-manager-app/):
//   node scripts/plan2/static-evidence.mjs [--root <dir>] [--out <archivo.json>]
//
// Un "found: false" en un control de bloqueo significa que el patrón que
// sostenía el bloqueo ya no aparece: hay que re-evaluar, no cerrar el gate.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CHECKS = [
  {
    id: 'C-01',
    claim: 'GET /v1/labor/entries filtra por el actor (createdBy = userId de la sesión): ruta personal, no extracción por organización',
    file: 'apps/api/src/modules/labor-engine/labor-engine.controller.ts',
    section: [/@Get\("entries"\)/, /@Get\("summary\/week"\)/],
    pattern: /createdBy:\s*a\.userId/,
  },
  {
    id: 'C-02',
    claim: 'GET /v1/labor/entries no acepta cursor ni offset en la query',
    file: 'apps/api/src/modules/labor-engine/labor-engine.controller.ts',
    section: [/@Get\("entries"\)/, /@Get\("summary\/week"\)/],
    pattern: /@Query\("(cursor|offset|after|pageToken)"\)/,
    expectAbsent: true,
  },
  {
    id: 'C-03',
    claim: 'limit se parsea sin tope superior (parsePositiveInt sin max): un límite grande no es paginación',
    file: 'apps/api/src/common/parse-query.ts',
    pattern: /export function parsePositiveInt\(value: string \| undefined, fallback: number\): number/,
  },
  {
    id: 'C-04',
    claim: 'listTimeEntries ordena solo por startedAt (sin desempate por id)',
    file: 'apps/api/src/modules/labor-engine/labor-engine.repository.ts',
    pattern: /orderBy:\s*\{\s*startedAt:\s*"desc"\s*\},\s*\n\s*take:\s*params\.limit \?\? 50,\s*\n\s*skip:\s*params\.offset \?\? 0,/,
  },
  {
    id: 'C-05',
    claim: 'listTimeEntries filtra por tenantId, no por orgId',
    file: 'apps/api/src/modules/labor-engine/labor-engine.repository.ts',
    pattern: /async listTimeEntries\(params: \{\s*\n\s*tenantId: string;[\s\S]{0,400}?where: \{\s*\n\s*tenantId: params\.tenantId,/,
  },
  {
    id: 'C-06',
    claim: 'admin/overview: vistas acotadas a la semana y take: 50 (QualityGuard), no exportación',
    file: 'apps/api/src/modules/labor-engine/labor-engine.repository.ts',
    pattern: /orderBy:\s*\{\s*durationMinutes:\s*"desc"\s*\},\s*\n\s*take:\s*50,/,
  },
  {
    id: 'C-07',
    claim: 'Spec labor.personal-record-export sigue en DRAFT (sin contrato aprobado de exportación)',
    file: 'docs/specs/labor/personal-record-export.spec.md',
    pattern: /^status:\s*"DRAFT"/m,
  },
  {
    id: 'D-01',
    claim: 'TimeEvidence no tiene FK a Evidence (solo fileUrl libre)',
    file: 'packages/db/prisma/schema.prisma',
    pattern: /model TimeEvidence \{[^}]*evidenceId/,
    expectAbsent: true,
  },
  {
    id: 'D-02',
    claim: 'TimeEvidence no tiene tenantId propio (alcance solo transitivo vía TimeEntry)',
    file: 'packages/db/prisma/schema.prisma',
    pattern: /model TimeEvidence \{[^}]*tenantId/,
    expectAbsent: true,
  },
  {
    id: 'D-03',
    claim: 'TimeEvidence no tiene checksum ni versionado',
    file: 'packages/db/prisma/schema.prisma',
    pattern: /model TimeEvidence \{[^}]*(checksum|version)/,
    expectAbsent: true,
  },
  {
    id: 'D-04',
    claim: 'Evidence tiene checksum opcional (String?) — no garantizado por esquema',
    file: 'packages/db/prisma/schema.prisma',
    pattern: /model Evidence \{[^}]*checksum\s+String\?/,
  },
];

function gitBlobSha(root, file) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', `HEAD:./${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

export async function runStaticEvidence(root) {
  const head = (() => {
    try { return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { return null; }
  })();
  const results = [];
  for (const check of CHECKS) {
    let text;
    let fullText;
    try {
      text = await readFile(path.join(root, check.file), 'utf8');
      fullText = text;
    } catch {
      results.push({ ...pick(check), status: 'FILE_MISSING', line: null, blobSha: null });
      continue;
    }
    let offset = 0;
    if (check.section) {
      const start = check.section[0].exec(text);
      if (!start) {
        results.push({ ...pick(check), status: 'SECTION_MISSING', line: null, blobSha: gitBlobSha(root, check.file) });
        continue;
      }
      const rest = text.slice(start.index + start[0].length);
      const end = check.section[1].exec(rest);
      offset = start.index;
      text = text.slice(start.index, start.index + start[0].length + (end ? end.index : rest.length));
    }
    const m = check.pattern.exec(text);
    const found = Boolean(m);
    const holds = check.expectAbsent ? !found : found;
    results.push({
      ...pick(check),
      status: holds ? 'HOLDS' : 'DOES_NOT_HOLD',
      line: m ? lineOf(fullText, offset + m.index) : null,
      section: check.section ? check.section.map(String) : undefined,
      blobSha: gitBlobSha(root, check.file),
    });
  }
  // Uso de TimeEvidence fuera del esquema (lecturas/escrituras en código de app).
  let timeEvidenceUsages = [];
  try {
    const out = execFileSync('git', ['-C', root, 'grep', '-n', '-E', 'timeEvidence\\.', '--', 'apps', 'packages'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    timeEvidenceUsages = out.trim().split('\n').filter(Boolean);
  } catch { /* git grep sale 1 cuando no hay coincidencias */ }
  results.push({
    id: 'D-05',
    claim: 'Ningún código de apps/ o packages/ lee o escribe prisma.timeEvidence',
    file: 'apps/**, packages/**',
    status: timeEvidenceUsages.length === 0 ? 'HOLDS' : 'DOES_NOT_HOLD',
    line: null,
    blobSha: null,
    matches: timeEvidenceUsages,
  });
  return { generatedAt: new Date().toISOString(), head, scope: 'static-source-only', results };
}

function pick(check) {
  return { id: check.id, claim: check.claim, file: check.file, expectAbsent: Boolean(check.expectAbsent) };
}

async function main() {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf('--root');
  const outIdx = args.indexOf('--out');
  const root = path.resolve(rootIdx >= 0 ? args[rootIdx + 1] : process.cwd());
  const report = await runStaticEvidence(root);
  const json = JSON.stringify(report, null, 2);
  if (outIdx >= 0) await writeFile(args[outIdx + 1], json + '\n');
  process.stdout.write(json + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
