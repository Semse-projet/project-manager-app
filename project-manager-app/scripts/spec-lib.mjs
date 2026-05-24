import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const SPEC_ROOT = "docs/specs";

export const CANONICAL_STATUSES = new Set([
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "IMPLEMENTED",
  "VERIFIED",
  "DEPRECATED",
]);

export const LEGACY_STATUSES = new Set(["PARTIAL", "MISSING", "REVIEW_REQUIRED", "ACTIVE"]);

export const ALLOWED_STATUSES = new Set([...CANONICAL_STATUSES, ...LEGACY_STATUSES]);

export const CANONICAL_METADATA_FIELDS = [
  "id",
  "title",
  "domain",
  "status",
  "owner",
  "risk",
  "related_files",
  "related_tests",
  "related_endpoints",
  "related_events",
  "related_agents",
  "last_verified",
];

export function findSpecFiles(rootDir = SPEC_ROOT) {
  const files = [];

  function walk(dir) {
    if (!existsSync(dir)) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".spec.md")) {
        files.push(absolute);
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

export function readSpec(filePath) {
  const content = readFileSync(filePath, "utf8");
  const frontmatter = parseFrontmatter(content);
  const legacy = parseLegacyMetadata(content);
  const title = normalizeScalar(frontmatter.title ?? frontmatter.feature ?? legacy.title ?? inferTitle(content));
  const id = normalizeScalar(frontmatter.id ?? slugFromPath(filePath));
  const domain = normalizeScalar(frontmatter.domain ?? legacy.domain);
  const status = normalizeStatus(frontmatter.status ?? legacy.status);
  const owner = normalizeScalar(frontmatter.owner ?? frontmatter.author ?? legacy.owner);
  const risk = normalizeRisk(frontmatter.risk ?? legacy.risk ?? legacy.priority);

  return {
    filePath,
    relativePath: toPosix(path.relative(process.cwd(), filePath)),
    content,
    metadata: {
      ...frontmatter,
      id,
      title,
      domain,
      status,
      owner,
      risk,
      related_files: normalizeList(frontmatter.related_files),
      related_tests: normalizeList(frontmatter.related_tests),
      related_endpoints: normalizeList(frontmatter.related_endpoints),
      related_events: normalizeList(frontmatter.related_events),
      related_agents: normalizeList(frontmatter.related_agents),
      last_verified: normalizeScalar(frontmatter.last_verified),
    },
    rawFrontmatter: frontmatter,
  };
}

export function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return {};

  const end = content.indexOf("\n---", 4);
  if (end === -1) return {};

  const lines = content.slice(4, end).split(/\r?\n/);
  const metadata = {};
  let currentKey = null;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && currentKey) {
      const value = parseScalar(listMatch[1]);
      metadata[currentKey] = Array.isArray(metadata[currentKey]) ? metadata[currentKey] : [];
      metadata[currentKey].push(value);
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) {
      currentKey = null;
      continue;
    }

    currentKey = keyMatch[1];
    const rawValue = keyMatch[2].trim();
    metadata[currentKey] = rawValue ? parseScalar(rawValue) : [];
  }

  return metadata;
}

export function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeScalar).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = normalizeScalar(value);
    if (!trimmed || trimmed === "[]") return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((item) => normalizeScalar(item))
        .filter(Boolean);
    }
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((item) => normalizeScalar(item))
        .filter(Boolean);
    }
    return [trimmed];
  }

  return [];
}

export function hasCanonicalMetadata(spec) {
  return CANONICAL_METADATA_FIELDS.filter((field) => {
    const value = spec.metadata[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

export function missingCanonicalMetadata(spec) {
  const present = new Set(hasCanonicalMetadata(spec));
  return CANONICAL_METADATA_FIELDS.filter((field) => !present.has(field));
}

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export function pathExists(repoRelativePath) {
  if (!repoRelativePath || hasGlob(repoRelativePath)) return true;
  return existsSync(path.resolve(process.cwd(), repoRelativePath));
}

export function isFile(repoRelativePath) {
  if (!repoRelativePath || hasGlob(repoRelativePath)) return true;
  const absolute = path.resolve(process.cwd(), repoRelativePath);
  return existsSync(absolute) && statSync(absolute).isFile();
}

export function searchRepo(paths, needles) {
  const normalizedNeedles = normalizeList(needles).filter(Boolean);
  if (normalizedNeedles.length === 0) return true;

  const haystack = [];
  for (const searchPath of paths) {
    collectTextFiles(searchPath, haystack);
  }

  if (haystack.length === 0) return false;
  const joined = haystack.join("\n");
  return normalizedNeedles.some((needle) => joined.includes(needle) || joined.includes(endpointPathOnly(needle)));
}

export function classifyCoverage(spec) {
  const metadata = spec.metadata;
  const relatedFiles = metadata.related_files;
  const relatedTests = metadata.related_tests;
  const pathHint = spec.relativePath;
  const content = spec.content;

  return {
    api: metadata.related_endpoints.length > 0 || pathHint.includes("/api/") || /(?:GET|POST|PATCH|PUT|DELETE)\s+\/v1\//.test(content),
    ui: relatedFiles.some((file) => file.startsWith("apps/web/") || file.startsWith("apps/angular/")) || pathHint.includes("/ui/"),
    tests: relatedTests.length > 0,
    relatedFiles: relatedFiles.length,
  };
}

function parseLegacyMetadata(content) {
  const legacy = {};
  const heading = inferTitle(content);
  if (heading) legacy.title = heading;

  const patterns = {
    domain: /\*\*(?:Dominio|Domain):\*\*\s*([^\n]+)/i,
    status: /\*\*(?:Estado|Status):\*\*\s*([^\n]+)/i,
    owner: /\*\*(?:Owner|Responsable):\*\*\s*([^\n]+)/i,
    risk: /\*\*(?:Risk|Riesgo):\*\*\s*([^\n]+)/i,
    priority: /\*\*(?:Prioridad|Priority):\*\*\s*([^\n]+)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = content.match(pattern);
    if (match) legacy[key] = match[1].trim();
  }

  return legacy;
}

function parseScalar(value) {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeScalar(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(normalizeScalar).filter(Boolean).join(", ");
  return String(value).trim().replace(/^["']|["']$/g, "");
}

function normalizeStatus(value) {
  return normalizeScalar(value).split(/\s+/)[0]?.toUpperCase() ?? "";
}

function normalizeRisk(value) {
  const normalized = normalizeScalar(value).toLowerCase();
  if (!normalized) return "";
  if (["critical", "critico", "p0"].some((item) => normalized.includes(item))) return "critical";
  if (["high", "alto", "alta", "p1"].some((item) => normalized.includes(item))) return "high";
  if (["medium", "medio", "media", "p2"].some((item) => normalized.includes(item))) return "medium";
  if (["low", "bajo", "baja", "p3"].some((item) => normalized.includes(item))) return "low";
  return normalized;
}

function inferTitle(content) {
  const match = content.match(/^#\s+(?:SPEC:\s+|Spec:\s+|FSM Spec:\s+)?(.+)$/im);
  return match ? match[1].trim() : "";
}

function slugFromPath(filePath) {
  return toPosix(path.relative(SPEC_ROOT, filePath))
    .replace(/\.spec\.md$/, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function hasGlob(value) {
  return /[*?[\]{}]/.test(value);
}

function endpointPathOnly(value) {
  return normalizeScalar(value).replace(/^(GET|POST|PATCH|PUT|DELETE)\s+/i, "");
}

function collectTextFiles(repoRelativePath, output) {
  const absolute = path.resolve(process.cwd(), repoRelativePath);
  if (!existsSync(absolute)) return;

  const stat = statSync(absolute);
  if (stat.isFile()) {
    if (isTextLike(absolute)) output.push(readFileSync(absolute, "utf8"));
    return;
  }

  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") continue;
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      collectTextFiles(toPosix(path.relative(process.cwd(), child)), output);
    } else if (entry.isFile() && isTextLike(child)) {
      output.push(readFileSync(child, "utf8"));
    }
  }
}

function isTextLike(filePath) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|prisma)$/.test(filePath);
}
