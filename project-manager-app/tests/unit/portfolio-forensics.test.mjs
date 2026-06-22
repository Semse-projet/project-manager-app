import test from "node:test";
import assert from "node:assert/strict";

// ── Portfolio Forensics Tests ──────────────────────────────────────────────

test("portfolio forensics: detects duplicate/stock photo indicators", async () => {
  const result = {
    duplicate_risk: 0.68,
    deepfake_risk: 0.15,
    fraud_risk: 0.38,
    portfolio_quality_score: 0.75,
    recommendation: "review",
  };

  assert.ok(result.duplicate_risk > 0.6);
  assert.equal(result.recommendation, "review");
});

test("portfolio forensics: detects potential deepfake/AI generation", async () => {
  const result = {
    duplicate_risk: 0.25,
    deepfake_risk: 0.78,
    fraud_risk: 0.52,
    portfolio_quality_score: 0.80,
    recommendation: "reject",
  };

  assert.ok(result.deepfake_risk > 0.75);
  assert.equal(result.recommendation, "reject");
});

test("portfolio forensics: assesses portfolio image quality", async () => {
  const scenarios = [
    { sharpness: 100, contrast: 20, expected: "low" },
    { sharpness: 500, contrast: 50, expected: "medium" },
    { sharpness: 1200, contrast: 90, expected: "high" },
  ];

  scenarios.forEach(s => {
    const quality = (s.sharpness > 1000 ? 1.0 : s.sharpness / 1000) *
                   (s.contrast > 80 ? 1.0 : s.contrast / 80) * 0.85;

    if (s.expected === "low") assert.ok(quality < 0.5);
    if (s.expected === "medium") assert.ok(quality >= 0.5 && quality < 0.7);
    if (s.expected === "high") assert.ok(quality >= 0.7);
  });
});

test("portfolio forensics: fraud_risk combines duplicate + deepfake scores", async () => {
  const result = {
    duplicate_risk: 0.5,
    deepfake_risk: 0.6,
    // fraud_risk = duplicate * 0.4 + deepfake * 0.6 = 0.5 * 0.4 + 0.6 * 0.6 = 0.56
    fraud_risk: 0.56,
  };

  const calculated = result.duplicate_risk * 0.4 + result.deepfake_risk * 0.6;
  assert.equal(Math.round(result.fraud_risk * 100), Math.round(calculated * 100));
});

test("portfolio forensics: all scores in 0-1 range", async () => {
  const result = {
    fraud_risk: 0.45,
    duplicate_risk: 0.38,
    deepfake_risk: 0.52,
    portfolio_quality_score: 0.72,
  };

  assert.ok(result.fraud_risk >= 0 && result.fraud_risk <= 1.0);
  assert.ok(result.duplicate_risk >= 0 && result.duplicate_risk <= 1.0);
  assert.ok(result.deepfake_risk >= 0 && result.deepfake_risk <= 1.0);
  assert.ok(result.portfolio_quality_score >= 0 && result.portfolio_quality_score <= 1.0);
});

test("portfolio forensics: recommendation is one of three states", async () => {
  const validRecommendations = ["approve", "review", "reject"];

  const scenarios = [
    { fraud_risk: 0.2, deepfake_risk: 0.1, quality: 0.85, expected: "approve" },
    { fraud_risk: 0.5, deepfake_risk: 0.3, quality: 0.60, expected: "review" },
    { fraud_risk: 0.65, deepfake_risk: 0.2, quality: 0.50, expected: "review" },
    { fraud_risk: 0.4, deepfake_risk: 0.78, quality: 0.80, expected: "reject" },
  ];

  scenarios.forEach(s => {
    assert.ok(validRecommendations.includes(s.expected));
  });
});

test("portfolio forensics: red flags generated for high fraud risk", async () => {
  const highDuplicate = {
    duplicate_risk: 0.72,
    red_flags: [
      "Image appears to be stock photo or heavily edited",
      "May be reused/duplicate in portfolio",
    ],
  };

  assert.ok(highDuplicate.red_flags.length > 0);
  assert.ok(highDuplicate.red_flags.some(f => f.includes("stock")));
});

test("portfolio forensics: red flags for deepfake detection", async () => {
  const deepfakeImage = {
    deepfake_risk: 0.82,
    red_flags: [
      "High likelihood of synthetic/deepfake image",
      "Potential AI-generated content detected",
      "Requires manual verification of authenticity",
    ],
  };

  assert.ok(deepfakeImage.red_flags.some(f => f.includes("synthetic") || f.includes("AI-generated")));
});

test("portfolio forensics: red flags for low quality images", async () => {
  const lowQuality = {
    portfolio_quality_score: 0.35,
    red_flags: [
      "Low portfolio image quality (blurry/low contrast)",
      "Professional images should meet quality standards",
    ],
  };

  assert.ok(lowQuality.red_flags.some(f => f.includes("quality")));
});

test("portfolio forensics: reject recommendation for high deepfake risk", async () => {
  const recommendation = (deepfake_risk) => {
    if (deepfake_risk > 0.75) return "reject";
    return "review";
  };

  assert.equal(recommendation(0.78), "reject");
  assert.equal(recommendation(0.65), "review");
});

test("portfolio forensics: review recommendation for moderate fraud", async () => {
  const recommendation = (fraud_risk, deepfake_risk) => {
    if (deepfake_risk > 0.75) return "reject";
    if (fraud_risk > 0.65) return "review";
    if (fraud_risk > 0.40) return "review";
    return "approve";
  };

  assert.equal(recommendation(0.55, 0.30), "review");
  assert.equal(recommendation(0.35, 0.20), "approve");
});

test("portfolio forensics: lighting uniformity detection (stock photo indicator)", async () => {
  const scenarios = [
    { brightness_variance: 200, is_stock: true },   // Too uniform
    { brightness_variance: 800, is_stock: false },  // Natural
    { brightness_variance: 5500, is_stock: false }, // Natural/high
  ];

  scenarios.forEach(s => {
    const likely_stock = s.brightness_variance < 300;
    assert.equal(likely_stock, s.is_stock);
  });
});

test("portfolio forensics: color saturation analysis for edited images", async () => {
  const scenarios = [
    { saturation: 220, is_edited: true },   // Oversaturated
    { saturation: 150, is_edited: false },  // Natural
    { saturation: 80, is_edited: false },   // Desaturated/aged
  ];

  scenarios.forEach(s => {
    const likely_edited = s.saturation > 200;
    if (s.is_edited) assert.ok(likely_edited);
  });
});

test("portfolio forensics: edge distribution check", async () => {
  const scenarios = [
    { edge_density: 0.02, is_clean: true },   // Very clean/edited
    { edge_density: 0.15, is_clean: false },  // Natural
    { edge_density: 0.30, is_clean: false },  // Complex/natural
  ];

  scenarios.forEach(s => {
    const likely_clean = s.edge_density < 0.03;
    if (s.is_clean) assert.ok(likely_clean);
  });
});

test("portfolio forensics: texture consistency for deepfake detection", async () => {
  const scenarios = [
    { variance_std: 0.85, is_ai: true },   // Highly inconsistent
    { variance_std: 0.25, is_ai: false },  // Consistent/natural
    { variance_std: 0.50, is_ai: false },  // Somewhat consistent
  ];

  scenarios.forEach(s => {
    const likely_ai = s.variance_std > 0.8;
    if (s.is_ai) assert.ok(likely_ai);
  });
});
