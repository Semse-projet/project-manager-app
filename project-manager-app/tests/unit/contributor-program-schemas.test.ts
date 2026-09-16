/**
 * Unit tests for the Knowledge Contributor Program Zod contracts — pure, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/contributor-program-schemas.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptContributorTermsSchema,
  reviewKnowledgeSubmissionSchema,
  resolveKnowledgeAppealSchema,
  createKnowledgeMissionSchema,
} from "../../packages/schemas/src/contributor-program.schema.ts";

const VALID_CHECKBOXES = {
  isAdult: true,
  acceptedTerms: true,
  authorizedToRecord: true,
  understandsSafetyPriority: true,
  understandsDataUse: true,
} as const;

test("consent cannot be accepted without all five checkboxes checked", () => {
  for (const key of Object.keys(VALID_CHECKBOXES)) {
    const checkboxes = { ...VALID_CHECKBOXES, [key]: false };
    const result = acceptContributorTermsSchema.safeParse({
      termsVersionId: "terms_1",
      termsContentHash: "hash",
      locale: "es",
      checkboxes,
    });
    assert.equal(result.success, false, `expected rejection when ${key} is false`);
  }
});

test("consent is accepted once every checkbox is true", () => {
  const result = acceptContributorTermsSchema.safeParse({
    termsVersionId: "terms_1",
    termsContentHash: "hash",
    locale: "es",
    checkboxes: VALID_CHECKBOXES,
  });
  assert.equal(result.success, true);
});

test("a rejection review requires a non-empty reason", () => {
  const missingReason = reviewKnowledgeSubmissionSchema.safeParse({ decision: "REJECTED", reason: "" });
  assert.equal(missingReason.success, false);

  const withReason = reviewKnowledgeSubmissionSchema.safeParse({
    decision: "REJECTED",
    reason: "Las medidas no coinciden con el resultado mostrado.",
  });
  assert.equal(withReason.success, true);
});

test("an appeal resolution requires a non-empty resolution reason", () => {
  const missing = resolveKnowledgeAppealSchema.safeParse({ status: "UPHELD", resolutionReason: "" });
  assert.equal(missing.success, false);
});

test("a demo mission is created with an explicit isDemo flag", () => {
  const parsed = createKnowledgeMissionSchema.parse({
    title: "Documentar un offset EMT (demo)",
    trade: "electrician",
    category: "conduit_bending",
    description: "Demo mission",
    difficulty: "intermediate",
    requirements: ["Tamaño del conduit"],
    evidenceRequested: ["Clip de ejecución"],
    acceptanceCriteria: ["Medidas explicadas"],
    baseCompensationCents: 500,
    isDemo: true,
  });
  assert.equal(parsed.isDemo, true);
  assert.equal(parsed.currency, "USD");
});
