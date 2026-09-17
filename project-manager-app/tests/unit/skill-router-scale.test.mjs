// Scale tests (08_NEGATIVE_AND_SCALE_TESTS.md): dynamic discovery,
// deterministic output, and no per-skill router-code edits required as the
// skill count grows to 20/50/100/250.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills } from "../../scripts/skill-router/lib/discover.mjs";
import { buildRegistry } from "../../scripts/skill-router/lib/registry.mjs";
import { route } from "../../scripts/skill-router/lib/router.mjs";

const TOPICS = [
  "billing reconciliation", "inventory sync", "notification templates", "search ranking",
  "media transcoding", "calendar scheduling", "geo fencing", "chat moderation",
  "rate limiting", "feature flags", "tenant onboarding", "webhook delivery",
];

function generateSyntheticSkills(root, count) {
  for (let i = 0; i < count; i++) {
    const id = `synthetic-skill-${String(i).padStart(4, "0")}`;
    const topic = TOPICS[i % TOPICS.length];
    const dir = join(root, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "SKILL.md"),
      `---\nname: ${id}\ndescription: Handles ${topic} scenario number ${i} for scale testing purposes only.\n---\n# ${id}\n`,
      "utf8",
    );
  }
}

for (const count of [20, 50, 100, 250]) {
  test(`scale: ${count} synthetic skills discover cleanly with no crash and no router-code edits needed`, () => {
    const root = mkdtempSync(join(tmpdir(), `skill-router-scale-${count}-`));
    try {
      generateSyntheticSkills(root, count);
      const discovery = discoverSkills([root]);
      assert.equal(discovery.entries.length, count);
      assert.equal(discovery.duplicates.length, 0);

      const registry = buildRegistry(discovery);
      assert.equal(registry.skills.length, count);

      // Every synthetic skill is legacy (no routing: metadata) by
      // construction, so metadata coverage should read 0% without crashing
      // the coverage computation on a large registry.
      assert.ok(registry.skills.every((s) => s.hasRoutingMetadata === false));

      const started = Date.now();
      const decisionA = route("Handle billing reconciliation for scenario number 3", registry);
      const decisionB = route("Handle billing reconciliation for scenario number 3", registry);
      const elapsedMs = Date.now() - started;

      // Deterministic: identical input + registry => identical selection.
      assert.equal(decisionA.primary, decisionB.primary);
      assert.deepEqual(decisionA.supporting, decisionB.supporting);

      // Not a hard SLA, just a sanity bound that routing stays cheap even
      // at 250 synthetic skills (well under a second on a laptop-class CPU).
      assert.ok(elapsedMs < 2000, `routing took ${elapsedMs}ms for ${count} skills`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("scale: adding a 21st real-shaped skill to an existing 20 requires no registry restructuring", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-router-scale-add-one-"));
  try {
    generateSyntheticSkills(root, 20);
    const before = buildRegistry(discoverSkills([root]));
    assert.equal(before.skills.length, 20);

    mkdirSync(join(root, "one-more-skill"), { recursive: true });
    writeFileSync(
      join(root, "one-more-skill", "SKILL.md"),
      "---\nname: one-more-skill\ndescription: A 21st skill added after the fact.\n---\n# body\n",
      "utf8",
    );
    const after = buildRegistry(discoverSkills([root]));
    assert.equal(after.skills.length, 21);
    assert.ok(after.skills.some((s) => s.id === "one-more-skill"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
