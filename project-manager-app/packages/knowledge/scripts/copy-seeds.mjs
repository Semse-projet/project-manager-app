import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seeds = [
  ["src/anatomy/seed/anatomy.seed.json", "dist/anatomy/seed/anatomy.seed.json"],
  ["src/repo/seed/repo.seed.json", "dist/repo/seed/repo.seed.json"],
  ["src/runtime/seed/runtime.seed.json", "dist/runtime/seed/runtime.seed.json"],
];

for (const [source, destination] of seeds) {
  const outputPath = resolve(packageRoot, destination);
  await mkdir(dirname(outputPath), { recursive: true });
  await copyFile(resolve(packageRoot, source), outputPath);
}
