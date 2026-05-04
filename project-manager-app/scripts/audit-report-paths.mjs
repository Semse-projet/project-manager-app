#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/yoni/labsemse";
const REPORTS = join(ROOT, "reportes");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function collectReportPaths(text) {
  const paths = new Set();

  for (const match of text.matchAll(/`(\/home\/yoni\/labsemse[^`]+)`/g)) {
    paths.add(match[1]);
  }

  for (const match of text.matchAll(/(?:^|\s)(\/home\/yoni\/labsemse[^\s)]+)(?=$|\s)/gm)) {
    paths.add(match[1]);
  }

  return [...paths];
}

const files = walk(REPORTS).filter((file) => file.endsWith(".md"));
const missing = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const referencedPath of collectReportPaths(content)) {
    if (!existsSync(referencedPath)) {
      missing.push({ file, referencedPath });
    }
  }
}

if (missing.length === 0) {
  console.log("OK: no missing absolute paths in reportes/");
  process.exit(0);
}

console.log(JSON.stringify({ missingCount: missing.length, missing }, null, 2));
process.exit(1);
