export type SkillState = "active" | "stale" | "archived";

export type SkillFrontmatter = {
  name: string;
  description: string;
  version: string;
  author?: string;
  metadata?: {
    semse?: {
      tags?: string[];
      intents?: string[];
      related_skills?: string[];
      platforms?: string[];
    };
  };
};

export type LoadedSkill = {
  name: string;
  description: string;
  version: string;
  tags: string[];
  intents: string[];
  relatedSkills: string[];
  body: string;
  filePath: string;
  state: SkillState;
};

export type SkillMatchResult = {
  skill: LoadedSkill;
  score: number;
  matchedBy: "intent" | "tag" | "keyword";
};
