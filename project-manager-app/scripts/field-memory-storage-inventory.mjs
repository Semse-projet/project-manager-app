#!/usr/bin/env node
/**
 * Read-only SHA-256 inventory of a storage root, plus comparison of two
 * manifests. Reuses field-memory-source-inventory and
 * field-memory-compare-inventories. Never writes under the source root.
 * Manifest stdout contains relative paths: redirect it to a private disk
 * and do not commit it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compareSourceInventories } from "./field-memory-compare-inventories.mjs";
import { inventory } from "./field-memory-source-inventory.mjs";

export async function buildStorageInventory(storageRoot, backupReference, options = {}) {
  return inventory(storageRoot, backupReference, {
    enforceProductionRoot: options.isolatedRoot !== true,
  });
}

export function compareStorageInventories(before, after) {
  return compareSourceInventories(before, after);
}

function option(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")
    ? process.argv[index + 1]
    : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === "inventory") {
    const reference = option("--reference");
    const root = option("--root") || process.env.SEMSE_STORAGE_ROOT;
    if (!reference || !root) throw Error("Inventory requires --reference and a storage root");
    const manifest = await buildStorageInventory(root, reference, {
      isolatedRoot: process.argv.includes("--isolated-root"),
    });
    process.stdout.write(JSON.stringify(manifest) + "\n");
    return;
  }
  if (command === "compare") {
    const beforePath = option("--before");
    const afterPath = option("--after");
    if (!beforePath || !afterPath) throw Error("Compare requires --before and --after");
    const [beforeText, afterText] = await Promise.all([
      readFile(beforePath, "utf8"),
      readFile(afterPath, "utf8"),
    ]);
    const result = compareStorageInventories(JSON.parse(beforeText), JSON.parse(afterText));
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.status !== "PASS") process.exitCode = 2;
    return;
  }
  throw Error("Use inventory or compare");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await main();
  } catch {
    process.stderr.write("Storage inventory aborted. No file paths printed.\n");
    process.exitCode = 1;
  }
}
