import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const SPEC_ROOT = "docs/specs";
export const SDD_VERSION = "2.0";

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

export const DELIVERY_METADATA_FIELDS = [
  "sdd_version",
  "code_status",
  "ci_status",
  "merge_status",
  "deploy_status",
  "activation_status",
  "migration_status",
  "feature_flags",
  "production_evidence",
];

export const DELIVERY_STATUS_VALUES = {
  code_status: new Set(["NOT_STARTED", "IN_PROGRESS", "COMPLETE"]),
  ci_status: new Set(["NOT_RUN", "PASS", "FAIL"]),
  merge_status: new Set(["UNMERGED", "MERGED"]),
  deploy_status: new Set(["NOT_DEPLOYED", "DEPLOYING", "DEPLOYED", "FAILED", "ROLLED_BACK"]),
  activation_status: new Set(["INACTIVE", "CANARY", "ACTIVE", "PAUSED", "ROLLED_BACK"]),
  migration_status: new Set(["NOT_APPLICABLE", "PENDING", "APPLIED", "VERIFIED", "ROLLED_BACK"]),
};

const LIST_METADATA_FIELDS = new Set([
  "related_files",
  "related_tests",
  "related_endpoints",
  "related_events",
  "related_agents",
  "feature_flags",
  "production_evidence",
]);

const textSearchCache = new Map();

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
      sdd_version: normalizeScalar(frontmatter.sdd_version),
      code_status: normalizeStatus(frontmatter.code_status),
      ci_status: normalizeStatus(frontmatter.ci_status),
      merge_status: normalizeStatus(frontmatter.merge_status),
      deploy_status: normalizeStatus(frontmatter.deploy_status),
      activation_status: normalizeStatus(frontmatter.activation_status),
      migration_status: normalizeStatus(frontmatter.migration_status),
      feature_flags: normalizeList(frontmatter.feature_flags),
      production_evidence: normalizeList(frontmatter.production_evidence),
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
    if (LIST_METADATA_FIELDS.has(field) && Object.prototype.hasOwnProperty.call(spec.rawFrontmatter, field)) {
      return true;
    }

    const value = spec.metadata[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

export function missingCanonicalMetadata(spec) {
  const present = new Set(hasCanonicalMetadata(spec));
  return CANONICAL_METADATA_FIELDS.filter((field) => !present.has(field));
}

export function missingDeliveryMetadata(spec) {
  const present = new Set(hasMetadataFields(spec, DELIVERY_METADATA_FIELDS));
  return DELIVERY_METADATA_FIELDS.filter((field) => !present.has(field));
}

export function isSddV2(spec) {
  return spec.metadata.sdd_version === SDD_VERSION;
}

export function deliveryStateErrors(label, metadata) {
  const errors = [];

  if (["IMPLEMENTED", "VERIFIED"].includes(metadata.status) && metadata.code_status !== "COMPLETE") {
    errors.push(`${label}: ${metadata.status} requires code_status COMPLETE`);
  }

  if (metadata.status === "VERIFIED") {
    if (metadata.ci_status !== "PASS") errors.push(`${label}: VERIFIED requires ci_status PASS`);
    if (metadata.merge_status !== "MERGED") errors.push(`${label}: VERIFIED requires merge_status MERGED`);
    if (metadata.deploy_status !== "DEPLOYED") errors.push(`${label}: VERIFIED requires deploy_status DEPLOYED`);
    if (!["CANARY", "ACTIVE"].includes(metadata.activation_status)) {
      errors.push(`${label}: VERIFIED requires activation_status CANARY or ACTIVE`);
    }
  }

  if (metadata.deploy_status === "DEPLOYED") {
    if (metadata.ci_status !== "PASS") errors.push(`${label}: DEPLOYED requires ci_status PASS`);
    if (metadata.merge_status !== "MERGED") errors.push(`${label}: DEPLOYED requires merge_status MERGED`);
  }

  if (["CANARY", "ACTIVE"].includes(metadata.activation_status)) {
    if (metadata.deploy_status !== "DEPLOYED") {
      errors.push(`${label}: ${metadata.activation_status} activation requires deploy_status DEPLOYED`);
    }
    if (metadata.production_evidence.length === 0) {
      errors.push(`${label}: ${metadata.activation_status} requires at least one production_evidence entry`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.last_verified)) {
      errors.push(`${label}: ${metadata.activation_status} requires last_verified in YYYY-MM-DD format`);
    }
  }

  return errors;
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

  const cacheKey = [...paths].sort().join("\u0000");
  let haystack = textSearchCache.get(cacheKey);
  if (!haystack) {
    haystack = [];
    for (const searchPath of paths) {
      collectTextFiles(searchPath, haystack);
    }
    textSearchCache.set(cacheKey, haystack);
  }

  if (haystack.length === 0) return false;
  const joined = haystack.join("\n");
  return normalizedNeedles.some((needle) => {
    const pathNeedle = endpointPathOnly(needle);
    if (joined.includes(needle) || joined.includes(pathNeedle)) return true;

    // NestJS commonly composes a route from @Controller("v1/base") and
    // @Get/@Post("child") instead of storing the full endpoint contiguously.
    // Require both halves to occur in the same source file so the validator
    // can recognize that composition without accepting unrelated repo hits.
    const segments = pathNeedle.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    for (let splitAt = 1; splitAt < segments.length; splitAt += 1) {
      const controllerPath = segments.slice(0, splitAt).join("/");
      const handlerPath = segments.slice(splitAt).join("/");
      if (haystack.some((content) => content.includes(controllerPath) && content.includes(handlerPath))) {
        return true;
      }
    }

    return false;
  });
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

function hasMetadataFields(spec, fields) {
  return fields.filter((field) => {
    if (LIST_METADATA_FIELDS.has(field) && Object.prototype.hasOwnProperty.call(spec.rawFrontmatter, field)) {
      return true;
    }

    const value = spec.metadata[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
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
