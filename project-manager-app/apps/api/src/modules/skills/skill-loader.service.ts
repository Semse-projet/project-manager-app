import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import type { LoadedSkill, SkillFrontmatter } from "./skill.types.js";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");
const EXCLUDED_DIRS = new Set([".git", ".archive", ".hub"]);
const MAX_BODY_CHARS = 4_000;

@Injectable()
export class SkillLoaderService implements OnModuleInit {
  private readonly logger = new Logger(SkillLoaderService.name);
  private skills: Map<string, LoadedSkill> = new Map();
  private lastLoadAt: number = 0;
  private readonly TTL_MS = 5 * 60 * 1_000; // 5 min cache

  onModuleInit(): void {
    this.reload();
  }

  getAll(): LoadedSkill[] {
    this.maybeReload();
    return [...this.skills.values()].filter((s) => s.state === "active");
  }

  getByName(name: string): LoadedSkill | undefined {
    this.maybeReload();
    return this.skills.get(name);
  }

  reload(): void {
    if (!fs.existsSync(SKILLS_DIR)) {
      this.logger.warn(`[skills] directory not found: ${SKILLS_DIR}`);
      return;
    }

    const loaded: LoadedSkill[] = [];
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (EXCLUDED_DIRS.has(entry.name)) continue;

      const skillFile = path.join(SKILLS_DIR, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;

      try {
        const raw = fs.readFileSync(skillFile, "utf-8");
        const skill = this.parseSkillFile(raw, skillFile);
        if (skill) loaded.push(skill);
      } catch (err) {
        this.logger.warn(`[skills] failed to parse ${skillFile}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.skills.clear();
    for (const s of loaded) this.skills.set(s.name, s);
    this.lastLoadAt = Date.now();
    this.logger.log(`[skills] loaded ${this.skills.size} skills from ${SKILLS_DIR}`);
  }

  private maybeReload(): void {
    if (Date.now() - this.lastLoadAt > this.TTL_MS) this.reload();
  }

  private parseSkillFile(raw: string, filePath: string): LoadedSkill | null {
    const { frontmatter, body } = this.parseFrontmatter(raw);
    if (!frontmatter.name) return null;

    const semse = frontmatter.metadata?.semse ?? {};
    return {
      name: frontmatter.name,
      description: frontmatter.description ?? "",
      version: frontmatter.version ?? "1.0.0",
      tags: semse.tags ?? [],
      intents: semse.intents ?? [],
      relatedSkills: semse.related_skills ?? [],
      body: body.trim().slice(0, MAX_BODY_CHARS),
      filePath,
      state: "active",
    };
  }

  private parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
    const empty = { frontmatter: {} as SkillFrontmatter, body: content };
    if (!content.startsWith("---")) return empty;

    const endIdx = content.indexOf("\n---", 3);
    if (endIdx === -1) return empty;

    const yamlPart = content.slice(3, endIdx).trim();
    const body = content.slice(endIdx + 4).trimStart();

    try {
      // Simple YAML parser (no external dependency for frontmatter)
      const fm = this.simpleYamlParse(yamlPart);
      return { frontmatter: fm as SkillFrontmatter, body };
    } catch {
      return { frontmatter: {} as SkillFrontmatter, body };
    }
  }

  // Minimal YAML parser for skill frontmatter (avoids yaml package dep)
  private simpleYamlParse(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i]!;
      if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) { i++; continue; }

      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();

      if (rawVal === "" || rawVal === "|" || rawVal === ">") {
        // Block scalar or nested object — parse nested
        const nested: Record<string, unknown> = {};
        i++;
        while (i < lines.length && (lines[i]!.startsWith("  ") || lines[i]!.startsWith("\t"))) {
          const innerLine = lines[i]!;
          const innerColon = innerLine.indexOf(":");
          if (innerColon !== -1) {
            const innerKey = innerLine.slice(0, innerColon).trim();
            const innerVal = innerLine.slice(innerColon + 1).trim();
            if (innerVal.startsWith("[")) {
              nested[innerKey] = innerVal.slice(1, -1).split(",").map((v) => v.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
            } else {
              nested[innerKey] = innerVal.replace(/^['"]|['"]$/g, "");
            }
          }
          i++;
        }
        result[key] = nested;
      } else if (rawVal.startsWith("[")) {
        result[key] = rawVal.slice(1, -1).split(",").map((v) => v.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
        i++;
      } else {
        result[key] = rawVal.replace(/^['"]|['"]$/g, "");
        i++;
      }
    }

    return result;
  }
}
