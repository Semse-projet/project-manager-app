/**
 * Unit tests for marketplace matching algorithm — pure functions, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/matching-algorithm.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline pure functions (mirrors apps/api/src/modules/matching/matching.algorithm.ts) ──

const WEIGHTS = { text: 0.40, trust: 0.25, verification: 0.15, rating: 0.20 };
const STOP_WORDS = new Set(["de","la","el","en","y","a","los","las","un","una","con","por","para","que","del","al","se","su","sus","es","son","ser","fue","the","and","for","with","this","that","from","have","are","was"]);
const VERIFICATION_SCORE: Record<string, number> = { verified: 1.0, pending: 0.5, unverified: 0.0, suspended: 0.0 };

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length >= 3 && !STOP_WORDS.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

type CandidateInput = { userId: string; email: string; trustScore: number; verificationStatus: string; avgRating: number; totalRatings: number; completedJobs: number; historicalJobText: string };

function scoreCandidate(jobTokens: Set<string>, c: CandidateInput) {
  const candidateTokens = tokenize(c.historicalJobText);
  const textSimilarity = jaccard(jobTokens, candidateTokens);
  const trustSignal = Math.min(1, Math.max(0, c.trustScore));
  const verificationSignal = VERIFICATION_SCORE[c.verificationStatus] ?? 0;
  const ratingSignal = c.totalRatings > 0 ? Math.min(1, c.avgRating / 5) : 0;
  const composite = WEIGHTS.text * textSimilarity + WEIGHTS.trust * trustSignal + WEIGHTS.verification * verificationSignal + WEIGHTS.rating * ratingSignal;
  return { textSimilarity, trustSignal, verificationSignal, ratingSignal, composite };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("tokenize: strips accents and stop words, min length 3", () => {
  const tokens = tokenize("Instalación eléctrica de alta tensión");
  assert.ok(tokens.has("instalacion"), "should normalize accents");
  assert.ok(tokens.has("electrica"), "should keep 'eléctrica' normalized");
  assert.ok(!tokens.has("de"), "should strip stop word 'de'");
  assert.ok(!tokens.has("al"), "should strip stop word 'al'");
});

test("tokenize: empty string returns empty set", () => {
  assert.equal(tokenize("").size, 0);
});

test("jaccard: identical sets → 1.0", () => {
  const a = new Set(["drywall", "pintura", "instalacion"]);
  assert.equal(jaccard(a, new Set([...a])), 1.0);
});

test("jaccard: disjoint sets → 0.0", () => {
  const a = new Set(["drywall"]);
  const b = new Set(["plomeria"]);
  assert.equal(jaccard(a, b), 0.0);
});

test("jaccard: partial overlap → value between 0 and 1", () => {
  const a = new Set(["drywall", "pintura", "reparacion"]);
  const b = new Set(["drywall", "instalacion"]);
  const score = jaccard(a, b);
  assert.ok(score > 0 && score < 1, `Expected 0 < ${score} < 1`);
  // intersection={drywall} → 1, union={drywall,pintura,reparacion,instalacion} → 4
  assert.ok(Math.abs(score - 0.25) < 0.001, `Expected ~0.25 but got ${score}`);
});

test("jaccard: both empty sets → 0", () => {
  assert.equal(jaccard(new Set(), new Set()), 0);
});

const baseCandidate: CandidateInput = {
  userId: "u1", email: "test@test.com", trustScore: 0.8,
  verificationStatus: "verified", avgRating: 4.5, totalRatings: 10,
  completedJobs: 20, historicalJobText: "drywall reparacion paredes instalacion sheetrock",
};

test("scoreCandidate: perfect text match + verified + high trust → high composite", () => {
  const jobTokens = tokenize("reparacion drywall sheetrock instalacion paredes");
  const score = scoreCandidate(jobTokens, baseCandidate);
  assert.ok(score.composite > 0.7, `Expected composite > 0.7, got ${score.composite.toFixed(3)}`);
  assert.ok(score.textSimilarity > 0.5, `Expected textSimilarity > 0.5`);
});

test("scoreCandidate: unverified lowers score vs verified", () => {
  const jobTokens = tokenize("drywall reparacion");
  const verified = scoreCandidate(jobTokens, { ...baseCandidate, verificationStatus: "verified" });
  const unverified = scoreCandidate(jobTokens, { ...baseCandidate, verificationStatus: "unverified" });
  assert.ok(verified.composite > unverified.composite,
    `verified(${verified.composite.toFixed(3)}) should > unverified(${unverified.composite.toFixed(3)})`);
  assert.ok(Math.abs(verified.composite - unverified.composite - WEIGHTS.verification * 1.0) < 0.001,
    "difference should equal verification weight");
});

test("scoreCandidate: no historical text → textSimilarity 0", () => {
  const jobTokens = tokenize("drywall reparacion");
  const score = scoreCandidate(jobTokens, { ...baseCandidate, historicalJobText: "" });
  assert.equal(score.textSimilarity, 0);
});

test("scoreCandidate: no ratings → ratingSignal 0", () => {
  const jobTokens = tokenize("drywall");
  const score = scoreCandidate(jobTokens, { ...baseCandidate, totalRatings: 0, avgRating: 0 });
  assert.equal(score.ratingSignal, 0);
});

test("scoreCandidate: trustScore clamped to [0, 1]", () => {
  const jobTokens = tokenize("test");
  const over = scoreCandidate(jobTokens, { ...baseCandidate, trustScore: 1.5 });
  const under = scoreCandidate(jobTokens, { ...baseCandidate, trustScore: -0.5 });
  assert.equal(over.trustSignal, 1.0);
  assert.equal(under.trustSignal, 0.0);
});

test("composite is always 0-1", () => {
  const cases: CandidateInput[] = [
    { ...baseCandidate, trustScore: 1, verificationStatus: "verified", avgRating: 5, totalRatings: 100, historicalJobText: "drywall reparacion" },
    { ...baseCandidate, trustScore: 0, verificationStatus: "suspended", avgRating: 0, totalRatings: 0, historicalJobText: "" },
  ];
  const jobTokens = tokenize("drywall reparacion");
  for (const c of cases) {
    const { composite } = scoreCandidate(jobTokens, c);
    assert.ok(composite >= 0 && composite <= 1, `composite ${composite} out of [0,1]`);
  }
});

test("higher trust score → higher composite (all else equal)", () => {
  const jobTokens = tokenize("drywall");
  const highTrust = scoreCandidate(jobTokens, { ...baseCandidate, trustScore: 1.0 });
  const lowTrust  = scoreCandidate(jobTokens, { ...baseCandidate, trustScore: 0.2 });
  assert.ok(highTrust.composite > lowTrust.composite,
    `highTrust(${highTrust.composite.toFixed(3)}) should > lowTrust(${lowTrust.composite.toFixed(3)})`);
});
