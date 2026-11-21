#!/usr/bin/env node
// Plan 2 — evidencia estática reproducible (solo lectura del repositorio).
//
// No contacta servicios, no lee datos de usuarios ni de producción, no escribe
// en el repositorio. Recorre archivos fuente y comprueba patrones concretos que
// sostienen (o refutan) los bloqueos C (extracción TimeEntry) y D (Evidence)
// del Plan 2. Imprime JSON con ruta, línea, blob SHA de git y resultado.
//
// Uso (desde project-manager-app/):
//   node scripts/plan2/static-evidence.mjs [--root <dir>] [--rev <commit>] [--out <archivo.json>] [--since <sha>]
// Todo se lee de UN commit fijo (--rev, por defecto HEAD) con `git show`/`git grep <rev>`:
// los cambios locales sin commit no alteran el resultado ni su atribución.
// --since lista los archivos relevantes que cambiaron entre <sha> y ese commit.
// --out crea el archivo en exclusiva (nunca sobrescribe) y rechaza destinos dentro del checkout.
//
// Un "found: false" en un control de bloqueo significa que el patrón que
// sostenía el bloqueo ya no aparece: hay que re-evaluar, no cerrar el gate.
import { execFileSync } from 'node:child_process';
import { realpath, writeFile } from 'node:fs/promises';
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
  {
    id: 'D-06',
    claim: 'UPLOADS_SIGNED_GET_MODE vale "off" si no está definida (lectura de archivos sin firma por defecto)',
    file: 'apps/api/src/infrastructure/storage/signed-url.ts',
    pattern: /UPLOADS_SIGNED_GET_MODE \?\? "off"/,
  },
  {
    id: 'D-07',
    claim: 'EVIDENCE_ORIGINAL_SHA256_MODE vale "off" si no está definida (sin checksum del original por defecto)',
    file: 'apps/api/src/modules/evidence/evidence-original-integrity.ts',
    pattern: /EVIDENCE_ORIGINAL_SHA256_MODE \?\? "off"/,
  },
  {
    id: 'D-08',
    claim: 'GET /v1/uploads/files/* está declarado @Public()',
    file: 'apps/api/src/infrastructure/storage/uploads.controller.ts',
    pattern: /@Public\(\)\s*\n\s*@Get\("files\/\*"\)/,
  },
];

/** Rutas cuyo cambio obliga a re-evaluar C/D/E. */
export const RELEVANT_PATHS = [
  'apps/api/src/modules/labor-engine', 'apps/api/src/modules/field-ops', 'apps/api/src/modules/evidence',
  'apps/api/src/infrastructure/storage', 'apps/api/src/common/parse-query.ts', 'packages/db/prisma/schema.prisma',
  'docs/specs/labor/personal-record-export.spec.md', 'docs/runbooks/BACKUP_RESTORE.md', 'docs/runbooks/FIELD_MEMORY_STORAGE_PREFLIGHT.md',
  'scripts/field-memory-offsite-recovery-windows.ps1', 'scripts/field-memory-custody-gate.mjs', 'scripts/field-memory-source-inventory.mjs',
];

/** Archivos relevantes que cambiaron entre `since` y HEAD (null si `since` no está disponible localmente). */
function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

/** Resuelve un único commit para toda la ejecución. */
export function resolveRev(root, rev = 'HEAD') {
  try { return git(root, ['rev-parse', '--verify', `${rev}^{commit}`]).trim(); } catch { return null; }
}

/** Archivos relevantes que cambiaron entre `since` y `rev` (null si alguno no está disponible). */
export function changedSince(root, since, rev = 'HEAD') {
  try {
    execFileSync('git', ['-C', root, 'cat-file', '-e', `${since}^{commit}`], { stdio: 'ignore' });
  } catch { return null; }
  const out = execFileSync('git', ['-C', root, 'diff', '--name-only', since, rev, '--', ...RELEVANT_PATHS], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return out.trim().split('\n').filter(Boolean);
}

function gitBlobSha(root, rev, file) {
  try { return git(root, ['rev-parse', `${rev}:./${file}`]).trim(); } catch { return null; }
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

export async function runStaticEvidence(root, rev = 'HEAD') {
  const head = resolveRev(root, rev);
  if (!head) throw new Error(`No se pudo resolver el commit ${rev}`);
  const results = [];
  for (const check of CHECKS) {
    let text;
    let fullText;
    try {
      text = git(root, ['show', `${head}:./${check.file}`]);
      fullText = text;
    } catch {
      results.push({ ...pick(check), status: 'FILE_MISSING', line: null, blobSha: null });
      continue;
    }
    let offset = 0;
    if (check.section) {
      const start = check.section[0].exec(text);
      if (!start) {
        results.push({ ...pick(check), status: 'SECTION_MISSING', line: null, blobSha: gitBlobSha(root, head, check.file) });
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
      blobSha: gitBlobSha(root, head, check.file),
    });
  }
  // Uso de TimeEvidence fuera del esquema (lecturas/escrituras en código de app).
  let timeEvidenceUsages = [];
  try {
    const out = git(root, ['grep', '-n', '-E', 'timeEvidence\\.', head, '--', 'apps', 'packages']);
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
  return { generatedAt: new Date().toISOString(), head, source: 'commit (git show/git grep), no el árbol de trabajo', scope: 'static-source-only', results };
}

export async function runWithSince(root, since, rev = 'HEAD') {
  const report = await runStaticEvidence(root, rev);
  if (since) {
    const changed = changedSince(root, since, report.head);
    report.since = { commit: since, available: changed !== null, changedRelevantFiles: changed };
  }
  return report;
}

/** true si `target` (o su directorio, resuelto con realpath) está dentro del checkout de git. */
export async function isInsideCheckout(root, target) {
  let top;
  try { top = await realpath(git(root, ['rev-parse', '--show-toplevel']).trim()); } catch { top = await realpath(root); }
  let dir;
  try { dir = await realpath(path.dirname(target)); } catch { dir = path.resolve(path.dirname(target)); }
  return dir === top || dir.startsWith(top + path.sep);
}

function pick(check) {
  return { id: check.id, claim: check.claim, file: check.file, expectAbsent: Boolean(check.expectAbsent) };
}

async function main() {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf('--root');
  const outIdx = args.indexOf('--out');
  const sinceIdx = args.indexOf('--since');
  const revIdx = args.indexOf('--rev');
  const root = path.resolve(rootIdx >= 0 ? args[rootIdx + 1] : process.cwd());
  const report = await runWithSince(root, sinceIdx >= 0 ? args[sinceIdx + 1] : undefined, revIdx >= 0 ? args[revIdx + 1] : 'HEAD');
  const json = JSON.stringify(report, null, 2);
  if (outIdx >= 0) {
    const out = path.resolve(args[outIdx + 1]);
    if (await isInsideCheckout(root, out)) {
      console.error('Rechazado: --out no puede apuntar dentro del checkout (el verificador es de solo lectura).');
      process.exit(2);
    }
    await writeFile(out, json + '\n', { flag: 'wx' });
  }
  process.stdout.write(json + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
