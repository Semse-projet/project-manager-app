import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedPaths = [
  "anatomy/seed/anatomy.seed.json",
  "repo/seed/repo.seed.json",
  "runtime/seed/runtime.seed.json",
];

for (const seedPath of seedPaths) {
  const source = resolve(packageRoot, "src", seedPath);
  const destination = resolve(packageRoot, "dist", seedPath);

  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}
