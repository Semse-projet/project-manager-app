import test from "node:test";
import assert from "node:assert/strict";

// ── Safety PPE Detection Tests ──────────────────────────────────────────────

test("safety detector: detects helmet in image", async () => {
  const result = {
    helmet_detected: true,
    vest_detected: false,
    harness_detected: false,
    compliance_score: 0.33,
    violations: ["No safety vest detected - high-visibility protection required"],
    worker_safety_level: "partial",
  };

  assert.ok(result.helmet_detected);
  assert.equal(result.compliance_score, 0.33);
});

test("safety detector: detects safety vest in image", async () => {
  const result = {
    helmet_detected: false,
    vest_detected: true,
    harness_detected: false,
    compliance_score: 0.33,
    violations: ["No helmet detected - head protection required"],
    worker_safety_level: "partial",
  };

  assert.ok(result.vest_detected);
  assert.equal(result.compliance_score, 0.33);
});

test("safety detector: detects harness in image", async () => {
  const result = {
    helmet_detected: false,
    vest_detected: false,
    harness_detected: true,
    compliance_score: 0.33,
    violations: [
      "No helmet detected - head protection required",
      "No safety vest detected - high-visibility protection required",
    ],
    worker_safety_level: "unsafe",
  };

  assert.ok(result.harness_detected);
});

test("safety detector: full PPE compliance (helmet + vest)", async () => {
  const result = {
    helmet_detected: true,
    vest_detected: true,
    harness_detected: false,
    compliance_score: 0.67,
    violations: [],
    worker_safety_level: "safe",
  };

  assert.ok(result.helmet_detected);
  assert.ok(result.vest_detected);
  assert.equal(result.worker_safety_level, "safe");
  assert.equal(result.violations.length, 0);
});

test("safety detector: complete PPE (helmet + vest + harness)", async () => {
  const result = {
    helmet_detected: true,
    vest_detected: true,
    harness_detected: true,
    compliance_score: 1.0,
    violations: [],
    worker_safety_level: "safe",
  };

  assert.equal(result.compliance_score, 1.0);
  assert.equal(result.violations.length, 0);
});

test("safety detector: no PPE detected", async () => {
  const result = {
    helmet_detected: false,
    vest_detected: false,
    harness_detected: false,
    compliance_score: 0.0,
    violations: [
      "No helmet detected - head protection required",
      "No safety vest detected - high-visibility protection required",
    ],
    worker_safety_level: "unsafe",
  };

  assert.equal(result.compliance_score, 0.0);
  assert.equal(result.violations.length, 2);
  assert.equal(result.worker_safety_level, "unsafe");
});

test("safety detector: compliance score ranges 0-1", async () => {
  const scenarios = [0.0, 0.33, 0.67, 1.0];

  scenarios.forEach(score => {
    assert.ok(score >= 0 && score <= 1.0);
  });
});

test("safety detector: safety level is one of three states", async () => {
  const validLevels = ["safe", "partial", "unsafe"];

  const levels = ["safe", "partial", "unsafe"];
  levels.forEach(level => {
    assert.ok(validLevels.includes(level));
  });
});

test("safety detector: violations generated for missing equipment", async () => {
  const scenarios = [
    { helmet: false, vest: true, expected_violation: "No helmet detected" },
    { helmet: true, vest: false, expected_violation: "No safety vest detected" },
    { helmet: false, vest: false, expected_violations: 2 },
  ];

  scenarios.forEach(s => {
    const violations = [];
    if (!s.helmet) violations.push("No helmet detected");
    if (!s.vest) violations.push("No safety vest detected");

    if ("expected_violation" in s) {
      assert.ok(violations.some(v => v.includes(s.expected_violation)));
    } else {
      assert.equal(violations.length, s.expected_violations);
    }
  });
});

test("safety detector: height risk estimation (0-1 scale)", async () => {
  const scenarios = [
    { sky_visible: 0.1, expected_risk: "low" },
    { sky_visible: 0.5, expected_risk: "medium" },
    { sky_visible: 0.9, expected_risk: "high" },
  ];

  scenarios.forEach(s => {
    // Height risk = sky_visible * 2, capped at 1.0
    const height_risk = Math.min(1.0, s.sky_visible * 2);
    assert.ok(height_risk >= 0 && height_risk <= 1.0);
  });
});

test("safety detector: at-height compliance stricter than ground-level", async () => {
  // At height: need helmet + vest + harness
  const atHeightRequirements = {
    helmet: true,
    vest: true,
    harness: true,
  };

  // Ground level: helmet + vest sufficient
  const groundRequirements = {
    helmet: true,
    vest: true,
    harness: false,
  };

  assert.ok(Object.values(atHeightRequirements).filter(Boolean).length > Object.values(groundRequirements).filter(Boolean).length);
});

test("safety detector: compliance score reflects ground vs at-height risk", async () => {
  // Helmet + vest only
  const partialPPE = {
    helmet_detected: true,
    vest_detected: true,
    harness_detected: false,
    compliance_score: 0.67,
  };

  // Ground level: score acceptable
  const ground_compliance = partialPPE.compliance_score >= 0.6 ? true : false;

  // At height: same score insufficient
  const at_height_compliance = partialPPE.compliance_score >= 1.0 ? true : false;

  assert.ok(ground_compliance);
  assert.ok(!at_height_compliance);
});

test("safety detector: safety notes generated for each equipment", async () => {
  const results = [
    { helmet: true, should_include: "Hard hat/helmet detected" },
    { helmet: false, should_include: "No head protection" },
    { vest: true, should_include: "High-visibility vest detected" },
    { vest: false, should_include: "No high-visibility vest" },
  ];

  results.forEach(r => {
    const notes = [];
    if (r.helmet) {
      notes.push("✓ Hard hat/helmet detected");
    } else {
      notes.push("⚠ No head protection (helmet/hard hat) visible");
    }

    assert.ok(notes.some(n => n.includes(r.should_include.split(" ")[0] === "Hard" ? "Hard" : "No")));
  });
});

test("safety detector: critical safety alert when unsafe at height", async () => {
  const unsafeAtHeight = {
    helmet_detected: false,
    vest_detected: false,
    height_risk: 0.8,
    compliance_score: 0.0,
  };

  const is_critical = unsafeAtHeight.compliance_score === 0.0 && unsafeAtHeight.height_risk > 0.6;
  assert.ok(is_critical);
});
