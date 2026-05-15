import { Injectable } from "@nestjs/common";
import { SkillLoaderService } from "./skill-loader.service.js";
import type { SkillMatchResult } from "./skill.types.js";

const MAX_SKILLS_PER_CONTEXT = 3;
const MAX_CONTEXT_CHARS = 5_000;

@Injectable()
export class SkillMatcherService {
  constructor(private readonly loader: SkillLoaderService) {}

  // Find skills relevant to a given intent + optional query
  matchForIntent(intent: string, query?: string): SkillMatchResult[] {
    const skills = this.loader.getAll();
    const results: SkillMatchResult[] = [];

    for (const skill of skills) {
      let score = 0;
      let matchedBy: SkillMatchResult["matchedBy"] = "keyword";

      // Exact intent match — highest priority
      if (skill.intents.includes(intent)) {
        score += 10;
        matchedBy = "intent";
      }

      // Tag overlap with intent string
      const intentWords = intent.toLowerCase().split("_");
      for (const tag of skill.tags) {
        if (intentWords.some((w) => tag.includes(w) || w.includes(tag))) {
          score += 3;
          matchedBy = matchedBy === "intent" ? "intent" : "tag";
        }
      }

      // Query keyword overlap
      if (query) {
        const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        for (const word of queryWords) {
          if (skill.tags.some((t) => t.includes(word) || word.includes(t))) {
            score += 2;
          }
          if (skill.name.includes(word) || skill.description.toLowerCase().includes(word)) {
            score += 1;
          }
        }
      }

      if (score > 0) results.push({ skill, score, matchedBy });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, MAX_SKILLS_PER_CONTEXT);
  }

  // Build the context block to inject into the system prompt
  buildContextBlock(matches: SkillMatchResult[]): string {
    if (matches.length === 0) return "";

    const parts: string[] = [];
    let usedChars = 0;

    for (const { skill } of matches) {
      const block = `### Skill: ${skill.description}\n\n${skill.body}`;
      if (usedChars + block.length > MAX_CONTEXT_CHARS) break;
      parts.push(block);
      usedChars += block.length;
    }

    if (parts.length === 0) return "";

    return [
      "## Conocimiento de dominio aplicable",
      "",
      ...parts,
    ].join("\n");
  }

  // Convenience: match + build in one call
  buildForIntent(intent: string, query?: string): string {
    const matches = this.matchForIntent(intent, query);
    return this.buildContextBlock(matches);
  }

  // List all available skills (for admin/debug)
  listAvailable(): Array<{ name: string; description: string; intents: string[]; tags: string[] }> {
    return this.loader.getAll().map((s) => ({
      name: s.name,
      description: s.description,
      intents: s.intents,
      tags: s.tags,
    }));
  }
}
