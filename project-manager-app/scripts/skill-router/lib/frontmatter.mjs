// Minimal YAML-frontmatter parser for SKILL.md files.
//
// Only supports the subset actually used by SEMSE skill frontmatter today
// (scalars, inline flow lists `[a, b]`, block lists `- item`, and one level
// of nested mappings such as `routing.precedence`). This is deliberately
// hand-rolled instead of depending on a YAML library: the schema this reads
// (docs: 02_METADATA_SCHEMA.yaml in the Skill Router kit) is small and
// fixed, and avoiding a new dependency keeps this tool runnable with zero
// install step, matching the kit's "no overengineering" directive.

const FRONTMATTER_DELIM = "---";

const KNOWN_CATEGORIES = new Set(["governance", "execution", "domain", "support"]);
const KNOWN_PHASES = new Set([
  "discovery",
  "spec",
  "implementation",
  "verification",
  "release",
  "post_release",
  "report",
]);
const KNOWN_STATUS = new Set(["active", "experimental", "deprecated"]);

export function extractFrontmatterBlock(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== FRONTMATTER_DELIM) {
    return { frontmatter: "", hasFrontmatter: false, malformed: false };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_DELIM) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { frontmatter: "", hasFrontmatter: false, malformed: true };
  }
  return { frontmatter: lines.slice(1, end).join("\n"), hasFrontmatter: true, malformed: false };
}

function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

function coerceScalar(value) {
  const v = value.trim();
  if (v === "") return null;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number.parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return Number.parseFloat(v);
  return v;
}

/**
 * Parses a minimal YAML subset (nested mappings + scalar block/flow lists).
 * Never throws: unparseable lines are dropped with a warning so a malformed
 * skill file degrades to "missing metadata", not a crash.
 */
export function parseYamlSubset(text) {
  const warnings = [];
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (const line of rawLines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    lines.push(line);
  }

  let pos = 0;

  function parseList(minIndent) {
    const items = [];
    while (pos < lines.length) {
      const line = lines[pos];
      const indent = indentOf(line);
      if (indent < minIndent) break;
      const trimmed = line.trim();
      if (!trimmed.startsWith("- ") && trimmed !== "-") break;
      const value = trimmed === "-" ? "" : trimmed.slice(2).trim();
      pos++;
      items.push(coerceScalar(value));
    }
    return items;
  }

  function parseBlockScalar(indent, style) {
    const collected = [];
    let blockIndent = null;
    while (pos < lines.length) {
      const line = lines[pos];
      if (line.trim() === "") {
        collected.push("");
        pos++;
        continue;
      }
      const lineIndent = indentOf(line);
      if (lineIndent <= indent) break;
      if (blockIndent === null) blockIndent = lineIndent;
      collected.push(line.slice(blockIndent));
      pos++;
    }
    while (collected.length > 0 && collected[collected.length - 1] === "") collected.pop();
    const folded = style.startsWith(">");
    return folded ? collected.join(" ").trim() : collected.join("\n").trim();
  }

  function parseBlock(minIndent) {
    const result = {};
    while (pos < lines.length) {
      const line = lines[pos];
      const indent = indentOf(line);
      if (indent < minIndent) break;
      const trimmed = line.trim();

      if (trimmed.startsWith("- ") || trimmed === "-") {
        warnings.push(`unexpected list item outside a list context: "${trimmed}"`);
        pos++;
        continue;
      }

      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) {
        warnings.push(`unparseable line ignored: "${trimmed}"`);
        pos++;
        continue;
      }

      const key = trimmed.slice(0, colonIdx).trim();
      const rest = trimmed.slice(colonIdx + 1).trim();
      pos++;

      if (/^[>|][-+]?$/.test(rest)) {
        result[key] = parseBlockScalar(indent, rest);
        continue;
      }

      if (rest !== "") {
        if (rest.startsWith("[") && rest.endsWith("]")) {
          const inner = rest.slice(1, -1).trim();
          result[key] = inner === "" ? [] : inner.split(",").map((s) => coerceScalar(s));
        } else {
          result[key] = coerceScalar(rest);
        }
        continue;
      }

      if (pos >= lines.length) {
        result[key] = null;
        continue;
      }
      const nextLine = lines[pos];
      const nextIndent = indentOf(nextLine);
      if (nextIndent <= indent) {
        result[key] = null;
        continue;
      }
      const nextTrimmed = nextLine.trim();
      result[key] = nextTrimmed.startsWith("- ") || nextTrimmed === "-"
        ? parseList(nextIndent)
        : parseBlock(nextIndent);
    }
    return result;
  }

  return { value: parseBlock(0), warnings };
}

function asStringArray(value, fieldName, skillId, warnings) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    warnings.push({
      code: "INVALID_METADATA",
      message: `${skillId ?? "skill"}: routing.${fieldName} should be a list; ignoring value`,
    });
    return [];
  }
  return value.filter((v) => typeof v === "string" || typeof v === "number").map(String);
}

function normalizeRoutingMetadata(raw, { skillId, warnings }) {
  // Unknown fields are preserved untouched (schema's unknown_field_behavior:
  // ignore_and_preserve) so a future metadata version can add fields without
  // this parser dropping them.
  const out = { ...raw };

  out.version = typeof raw.version === "number" ? raw.version : 1;

  if (raw.category !== undefined && !KNOWN_CATEGORIES.has(raw.category)) {
    warnings.push({ code: "INVALID_METADATA", message: `${skillId ?? "skill"}: unknown routing.category "${raw.category}"` });
  }
  out.category = KNOWN_CATEGORIES.has(raw.category) ? raw.category : undefined;

  out.scope = asStringArray(raw.scope, "scope", skillId, warnings);
  out.triggers = asStringArray(raw.triggers, "triggers", skillId, warnings);
  out.excludes = asStringArray(raw.excludes, "excludes", skillId, warnings);

  const phases = asStringArray(raw.phases, "phases", skillId, warnings);
  const invalidPhases = phases.filter((p) => !KNOWN_PHASES.has(p));
  if (invalidPhases.length > 0) {
    warnings.push({
      code: "INVALID_METADATA",
      message: `${skillId ?? "skill"}: unknown routing.phases values: ${invalidPhases.join(", ")}`,
    });
  }
  out.phases = phases.filter((p) => KNOWN_PHASES.has(p));

  const precedence = raw.precedence && typeof raw.precedence === "object" && !Array.isArray(raw.precedence)
    ? raw.precedence
    : {};
  out.precedence = {
    subordinate_to: asStringArray(precedence.subordinate_to, "precedence.subordinate_to", skillId, warnings),
    may_constrain: asStringArray(precedence.may_constrain, "precedence.may_constrain", skillId, warnings),
  };

  if (raw.specificity !== undefined) {
    const n = Number(raw.specificity);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      warnings.push({ code: "INVALID_METADATA", message: `${skillId ?? "skill"}: routing.specificity out of range [0,100]; ignoring` });
      out.specificity = undefined;
    } else {
      out.specificity = n;
    }
  }

  if (raw.status !== undefined && !KNOWN_STATUS.has(raw.status)) {
    warnings.push({ code: "INVALID_METADATA", message: `${skillId ?? "skill"}: unknown routing.status "${raw.status}"` });
  }
  out.status = KNOWN_STATUS.has(raw.status) ? raw.status : "active";

  out.supersedes = asStringArray(raw.supersedes, "supersedes", skillId, warnings);
  out.superseded_by = asStringArray(raw.superseded_by, "superseded_by", skillId, warnings);
  out.notes = typeof raw.notes === "string" ? raw.notes : undefined;

  return out;
}

/**
 * Parses a SKILL.md's frontmatter into { name, description, routing, warnings }.
 * `routing` is undefined when the optional metadata block is absent —
 * callers apply legacy inference in that case (see registry.mjs).
 */
export function parseSkillFrontmatter(raw, { skillId } = {}) {
  const warnings = [];
  const { frontmatter, hasFrontmatter, malformed } = extractFrontmatterBlock(raw);

  if (!hasFrontmatter) {
    warnings.push({ code: "NO_FRONTMATTER", message: `${skillId ?? "skill"}: SKILL.md has no --- frontmatter block` });
    return { name: undefined, description: undefined, routing: undefined, warnings };
  }
  if (malformed) {
    warnings.push({ code: "MALFORMED_FRONTMATTER", message: `${skillId ?? "skill"}: frontmatter opening --- has no closing ---` });
    return { name: undefined, description: undefined, routing: undefined, warnings };
  }

  let parsed;
  try {
    const { value, warnings: parseWarnings } = parseYamlSubset(frontmatter);
    parsed = value;
    for (const w of parseWarnings) {
      warnings.push({ code: "FRONTMATTER_PARSE_WARNING", message: `${skillId ?? "skill"}: ${w}` });
    }
  } catch (err) {
    warnings.push({ code: "INVALID_METADATA", message: `${skillId ?? "skill"}: failed to parse frontmatter: ${err.message}` });
    return { name: undefined, description: undefined, routing: undefined, warnings };
  }

  const name = typeof parsed.name === "string" ? parsed.name : undefined;
  const description = typeof parsed.description === "string" ? parsed.description : undefined;

  let routing;
  if (parsed.routing !== undefined && parsed.routing !== null) {
    if (typeof parsed.routing === "object" && !Array.isArray(parsed.routing)) {
      routing = normalizeRoutingMetadata(parsed.routing, { skillId, warnings });
    } else {
      warnings.push({ code: "INVALID_METADATA", message: `${skillId ?? "skill"}: routing field is not a mapping; ignoring` });
    }
  }

  return { name, description, routing, warnings };
}
