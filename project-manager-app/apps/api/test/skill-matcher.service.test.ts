import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { SkillMatcherService } from "../dist/modules/skills/skill-matcher.service.js";

type MockSkill = {
  name: string;
  description: string;
  intents: string[];
  tags: string[];
  body: string;
  version: string;
  relatedSkills: string[];
  filePath: string;
  state: "active";
};

function makeSkill(overrides: Partial<MockSkill>): MockSkill {
  return {
    name: overrides.name ?? "test-skill",
    description: overrides.description ?? "A test skill",
    intents: overrides.intents ?? [],
    tags: overrides.tags ?? [],
    body: overrides.body ?? "This skill helps with testing.",
    version: "1.0.0",
    relatedSkills: [],
    filePath: "/skills/test-skill/SKILL.md",
    state: "active",
  };
}

function makeLoader(skills: MockSkill[]) {
  return { getAll: () => skills } as never;
}

// ── matchForIntent ────────────────────────────────────────────────────────────

test("skill-matcher: exact intent match scores highest", () => {
  const skills = [
    makeSkill({ name: "payments", intents: ["process_payment"], tags: ["payment", "escrow"] }),
    makeSkill({ name: "disputes", intents: ["open_dispute"], tags: ["dispute", "resolution"] }),
  ];
  const service = new SkillMatcherService(makeLoader(skills));

  const results = service.matchForIntent("process_payment");

  assert.equal(results.length, 1);
  assert.equal(results[0]!.skill.name, "payments");
  assert.equal(results[0]!.matchedBy, "intent");
});

test("skill-matcher: tag match scores when no intent match", () => {
  const skills = [
    makeSkill({ name: "payments", intents: ["process_payment"], tags: ["payment", "stripe"] }),
    makeSkill({ name: "billing", intents: ["billing_cycle"], tags: ["billing"] }),
  ];
  const service = new SkillMatcherService(makeLoader(skills));

  const results = service.matchForIntent("payment_gateway"); // not an exact intent

  assert.ok(results.length > 0);
  assert.equal(results[0]!.matchedBy, "tag");
});

test("skill-matcher: returns at most 3 results", () => {
  const skills = Array.from({ length: 10 }, (_, i) =>
    makeSkill({ name: `skill_${i}`, intents: ["common_intent"], tags: [] })
  );
  const service = new SkillMatcherService(makeLoader(skills));

  const results = service.matchForIntent("common_intent");

  assert.ok(results.length <= 3);
});

test("skill-matcher: returns empty array when no match found", () => {
  const skills = [
    makeSkill({ name: "payments", intents: ["process_payment"], tags: ["payment"] }),
  ];
  const service = new SkillMatcherService(makeLoader(skills));

  const results = service.matchForIntent("totally_unrelated_xyz");

  assert.equal(results.length, 0);
});

test("skill-matcher: query boosts score for keyword overlap", () => {
  const skills = [
    makeSkill({ name: "payments", intents: [], tags: ["stripe", "payment"] }),
    makeSkill({ name: "analytics", intents: [], tags: ["metrics", "charts"] }),
  ];
  const service = new SkillMatcherService(makeLoader(skills));

  const results = service.matchForIntent("general", "stripe payment processing");

  assert.ok(results.length > 0);
  assert.equal(results[0]!.skill.name, "payments");
});

// ── buildContextBlock ─────────────────────────────────────────────────────────

test("skill-matcher: buildContextBlock returns empty string for no matches", () => {
  const service = new SkillMatcherService(makeLoader([]));

  const block = service.buildContextBlock([]);

  assert.equal(block, "");
});

test("skill-matcher: buildContextBlock includes skill description and body", () => {
  const skill = makeSkill({
    name: "payments",
    description: "Handles payment processing",
    body: "Use Stripe for escrow payments.",
  });
  const service = new SkillMatcherService(makeLoader([skill]));

  const block = service.buildContextBlock([{ skill, score: 10, matchedBy: "intent" }]);

  assert.ok(block.includes("Handles payment processing"));
  assert.ok(block.includes("Use Stripe for escrow payments."));
  assert.ok(block.includes("Conocimiento de dominio"));
});

// ── buildForIntent ────────────────────────────────────────────────────────────

test("skill-matcher: buildForIntent returns empty string when no skills loaded", () => {
  const service = new SkillMatcherService(makeLoader([]));

  const result = service.buildForIntent("any_intent");

  assert.equal(result, "");
});

test("skill-matcher: buildForIntent combines match and context build", () => {
  const skill = makeSkill({
    name: "invoicing",
    intents: ["create_invoice"],
    tags: ["invoice"],
    body: "Invoice generation guide.",
  });
  const service = new SkillMatcherService(makeLoader([skill]));

  const result = service.buildForIntent("create_invoice");

  assert.ok(result.includes("Invoice generation guide."));
});

// ── listAvailable ─────────────────────────────────────────────────────────────

test("skill-matcher: listAvailable returns skill metadata without body", () => {
  const skills = [
    makeSkill({ name: "skill_a", description: "Skill A", intents: ["intent_a"], tags: ["tag_a"] }),
    makeSkill({ name: "skill_b", description: "Skill B", intents: [], tags: ["tag_b"] }),
  ];
  const service = new SkillMatcherService(makeLoader(skills));

  const list = service.listAvailable();

  assert.equal(list.length, 2);
  assert.equal(list[0]!.name, "skill_a");
  assert.ok(!("body" in list[0]!));
  assert.ok(Array.isArray(list[0]!.tags));
  assert.ok(Array.isArray(list[0]!.intents));
});
