import test from "node:test";
import assert from "node:assert/strict";
import { CONSTRUCTION_LIBRARY_SEED } from "@semse/schemas";
import {
  DEFAULT_CONFIDENCE_THRESHOLDS,
  decideRecognition,
  matchCandidateToLibrary,
  rankLibrarySearch,
  resolveConfidenceThresholds,
  scoreLibraryMatch,
} from "../dist/modules/vision/vision-library.logic.js";

// Sense Vision — search ranking, candidate matching and the confidence policy.
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §4 (P1–P3, P9, P10).
// Uses the real canonical seed so alias coverage is tested against the data
// that actually ships in the migration.

const ROWS = CONSTRUCTION_LIBRARY_SEED.map((item: any) => ({
  ...item,
  id: `cli_${item.slug.replace(/-/g, "_")}`,
  canonicalName: item.nameEn,
  active: true,
}));

function topSlug(query: string): string | undefined {
  return rankLibrarySearch(ROWS, query, 5)[0]?.slug;
}

test("manual search finds items by English name, Spanish name and aliases (P10)", () => {
  assert.equal(topSlug("fish tape"), "fish-tape");
  assert.equal(topSlug("cinta guía"), "fish-tape");
  assert.equal(topSlug("cinta guia"), "fish-tape");
  assert.equal(topSlug("channel locks"), "tongue-and-groove-pliers");
  assert.equal(topSlug("Channellocks"), "tongue-and-groove-pliers");
  assert.equal(topSlug("pinza de canal"), "tongue-and-groove-pliers");
  assert.equal(topSlug("water pump pliers"), "tongue-and-groove-pliers");
  assert.equal(topSlug("copla emt"), "emt-coupling");
  assert.equal(topSlug("EMT connector"), "emt-connector");
  assert.equal(topSlug("romex"), "nm-b-cable");
});

test("exact name outranks partial matches", () => {
  const results = rankLibrarySearch(ROWS, "EMT coupling", 5).map((r: any) => r.slug);
  assert.equal(results[0], "emt-coupling");
  assert.ok(scoreLibraryMatch(ROWS.find((r: any) => r.slug === "emt-coupling"), "emt coupling") >
    scoreLibraryMatch(ROWS.find((r: any) => r.slug === "compression-coupling"), "emt coupling"));
});

test("search with no match returns nothing, empty query lists alphabetically", () => {
  assert.deepEqual(rankLibrarySearch(ROWS, "flux capacitor", 5), []);
  const listed = rankLibrarySearch(ROWS, "", 3).map((r: any) => r.nameEn);
  assert.deepEqual(listed, [...listed].sort((a, b) => a.localeCompare(b)));
  assert.equal(listed.length, 3);
});

test("candidate matching uses slug first, then exact name/alias — never a partial guess", () => {
  assert.equal(matchCandidateToLibrary({ slug: "emt-coupling" }, ROWS)?.slug, "emt-coupling");
  assert.equal(matchCandidateToLibrary({ slug: "nope", label: "Channel Locks" }, ROWS)?.slug, "tongue-and-groove-pliers");
  assert.equal(matchCandidateToLibrary({ label: "coupling" }, ROWS), null);
  assert.equal(matchCandidateToLibrary({ label: "" }, ROWS), null);
  assert.equal(matchCandidateToLibrary({}, ROWS), null);
});

test("confidence ≥ 0.80 is recognized, with the library's bilingual enrichment (P1)", () => {
  const decision = decideRecognition([{ slug: "emt-coupling", label: "EMT coupling", confidence: 0.912 }], ROWS);
  assert.equal(decision.status, "recognized");
  assert.equal(decision.object?.nameEn, "EMT coupling");
  assert.equal(decision.object?.nameEs, "Copla EMT");
  assert.equal(decision.object?.confidence, 0.91);
  assert.match(decision.object?.exampleSentenceEn ?? "", /EMT couplings/);
  assert.deepEqual(decision.alternatives, []);
});

test("0.50–0.79 is uncertain with alternatives (P2)", () => {
  const decision = decideRecognition(
    [
      { slug: "emt-coupling", confidence: 0.62 },
      { slug: "emt-connector", confidence: 0.55 },
      { slug: "compression-coupling", confidence: 0.3 },
      { label: "Set-screw coupling", confidence: 0.2 },
      { slug: "locknut", confidence: 0.1 },
    ],
    ROWS,
  );
  assert.equal(decision.status, "uncertain");
  assert.equal(decision.object?.slug, "emt-coupling");
  assert.deepEqual(decision.alternatives.map((a: any) => a.slug), ["emt-connector", "compression-coupling", "set-screw-coupling"]);
});

test("< 0.50 is unknown and never returns a guessed object (P3)", () => {
  const decision = decideRecognition([{ slug: "emt-coupling", confidence: 0.49 }], ROWS);
  assert.equal(decision.status, "unknown");
  assert.equal(decision.reason, "low_confidence");
  assert.equal(decision.object, null);
});

test("a confident candidate outside the library is unknown, not invented (P3)", () => {
  const decision = decideRecognition([{ slug: null, label: "Flux capacitor", confidence: 0.99 }], ROWS);
  assert.equal(decision.status, "unknown");
  assert.equal(decision.reason, "not_in_library");
  assert.equal(decision.object, null);
});

test("malformed recognizer output is unknown, never success (P9)", () => {
  assert.equal(decideRecognition(undefined, ROWS).reason, "malformed_result");
  assert.equal(decideRecognition("oops", ROWS).reason, "malformed_result");
  assert.equal(decideRecognition([{ slug: "emt-coupling", confidence: "high" }, 3, null], ROWS).reason, "malformed_result");
  assert.equal(decideRecognition([], ROWS).reason, "no_candidates");
  for (const bad of [undefined, "oops", []]) assert.equal(decideRecognition(bad, ROWS).status, "unknown");
});

test("duplicate candidates for one item keep the highest confidence; values are clamped", () => {
  const decision = decideRecognition(
    [
      { slug: "fish-tape", confidence: 0.4 },
      { label: "Cinta guía", confidence: 1.8 },
    ],
    ROWS,
  );
  assert.equal(decision.status, "recognized");
  assert.equal(decision.object?.confidence, 1);
  assert.deepEqual(decision.alternatives, []);
});

test("thresholds are configurable and fall back when inconsistent", () => {
  assert.deepEqual(resolveConfidenceThresholds({}), DEFAULT_CONFIDENCE_THRESHOLDS);
  assert.deepEqual(
    resolveConfidenceThresholds({ VISION_CONFIDENCE_RECOGNIZED: "0.9", VISION_CONFIDENCE_UNCERTAIN: "0.6" }),
    { recognized: 0.9, uncertain: 0.6 },
  );
  assert.deepEqual(
    resolveConfidenceThresholds({ VISION_CONFIDENCE_RECOGNIZED: "0.5", VISION_CONFIDENCE_UNCERTAIN: "0.7" }),
    DEFAULT_CONFIDENCE_THRESHOLDS,
  );
  const decision = decideRecognition([{ slug: "emt-coupling", confidence: 0.85 }], ROWS, { recognized: 0.9, uncertain: 0.6 });
  assert.equal(decision.status, "uncertain");
});
