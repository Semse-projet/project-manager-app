// Dynamic skill discovery: scans one or more configured roots for
// `<root>/<skill-id>/SKILL.md` directories. Adding a new skill never
// requires a change here — the walk is purely filesystem-driven.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parseSkillFrontmatter } from "./frontmatter.mjs";

export function discoverSkills(roots, { cwd = process.cwd() } = {}) {
  const entries = [];
  const warnings = [];
  const seenIds = new Map();

  for (const root of roots) {
    const absRoot = isAbsolute(root) ? root : join(cwd, root);
    if (!existsSync(absRoot)) {
      warnings.push({ code: "ROOT_NOT_FOUND", message: `skill root not found: ${root}` });
      continue;
    }

    let dirents;
    try {
      dirents = readdirSync(absRoot, { withFileTypes: true });
    } catch (err) {
      warnings.push({ code: "ROOT_UNREADABLE", message: `cannot read skill root ${root}: ${err.message}` });
      continue;
    }

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) continue;
      const id = dirent.name;
      const skillFile = join(absRoot, id, "SKILL.md");
      if (!existsSync(skillFile)) {
        warnings.push({ code: "MISSING_SKILL_MD", message: `${root}/${id}: no SKILL.md found; skipped` });
        continue;
      }

      let raw;
      try {
        raw = readFileSync(skillFile, "utf8");
      } catch (err) {
        warnings.push({ code: "SKILL_MD_UNREADABLE", message: `${root}/${id}: cannot read SKILL.md: ${err.message}` });
        continue;
      }

      const parsed = parseSkillFrontmatter(raw, { skillId: id });
      entries.push({
        id,
        root,
        path: skillFile,
        name: parsed.name,
        description: parsed.description,
        routing: parsed.routing,
        parseWarnings: parsed.warnings,
      });

      if (!seenIds.has(id)) seenIds.set(id, []);
      seenIds.get(id).push({ root, path: skillFile });
    }
  }

  const duplicates = [];
  for (const [id, locations] of seenIds) {
    if (locations.length > 1) {
      duplicates.push({ id, locations });
      warnings.push({
        code: "DUPLICATE_SKILL_ID",
        message: `duplicate skill id "${id}" found in ${locations.length} roots: ${locations.map((l) => l.root).join(", ")}`,
      });
    }
  }

  return { entries, warnings, duplicates };
}
