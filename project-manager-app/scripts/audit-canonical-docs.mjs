import fs from "node:fs";
import path from "node:path";

const roots = [
  "/home/yoni/labsemse/agents",
  "/home/yoni/labsemse/program",
  "/home/yoni/labsemse/vision",
  "/home/yoni/labsemse/constitution",
  "/home/yoni/labsemse/repository-rules",
  "/home/yoni/labsemse/_governance"
];

const legacyPatterns = [
  "/home/yoni/project-manager-app",
  "/home/yoni/labsemse/labsemse_project/project-manager-app"
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

const findings = [];

for (const root of roots) {
  for (const file of walk(root)) {
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of legacyPatterns) {
      if (content.includes(pattern)) {
        findings.push({ file, pattern });
      }
    }
  }
}

if (findings.length === 0) {
  console.log("OK: no legacy canonical paths in stable documentation zones");
  process.exit(0);
}

console.error(JSON.stringify(findings, null, 2));
process.exit(1);
