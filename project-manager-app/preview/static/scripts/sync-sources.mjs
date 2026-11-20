import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const previewRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = process.env.SEMSE_REPO_ROOT
  ? resolve(process.env.SEMSE_REPO_ROOT)
  : resolve(previewRoot, "../..");
const targetRoot = resolve(previewRoot, ".sources");

const copies = [
  ["apps/web/components/semse/digital-twin", "directory"],
  ["apps/web/components/semse/semse-consciousness-map.tsx", "file"],
  ["apps/web/lib/digital-twin", "directory"],
  ["apps/web/lib/data/semse-consciousness-topology.ts", "file"],
  ["apps/web/app/globals.css", "file"],
];

await rm(targetRoot, { recursive: true, force: true });
for (const [relativePath, kind] of copies) {
  const source = resolve(repoRoot, relativePath);
  const target = resolve(targetRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: kind === "directory" });
}
console.log(`Static preview sources synchronized from ${repoRoot}`);
