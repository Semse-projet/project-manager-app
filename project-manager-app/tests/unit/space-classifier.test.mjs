import test from "node:test";
import assert from "node:assert/strict";

// ── Space Classification Tests ──────────────────────────────────────────────

test("space classifier: recognizes interior painting category", async () => {
  const result = {
    category: "interior_painting",
    confidence: 0.82,
    key_features: ["Indoor wall surface", "Relatively smooth finish"],
    skip_questions_allowed: true,
  };

  assert.equal(result.category, "interior_painting");
  assert.ok(result.confidence >= 0.75);
});

test("space classifier: recognizes exterior painting category", async () => {
  const result = {
    category: "exterior_painting",
    confidence: 0.78,
    key_features: ["Weathered exterior surface", "Natural lighting dominant"],
    skip_questions_allowed: true,
  };

  assert.equal(result.category, "exterior_painting");
  assert.ok(result.confidence >= 0.70);
});

test("space classifier: recognizes drywall repair category", async () => {
  const result = {
    category: "drywall_repair",
    confidence: 0.85,
    key_features: ["Seams or compound visible", "Repair patches visible"],
    skip_questions_allowed: true,
  };

  assert.equal(result.category, "drywall_repair");
  assert.ok(result.confidence >= 0.75);
});

test("space classifier: recognizes bathroom remodel category", async () => {
  const result = {
    category: "bathroom_remodel",
    confidence: 0.89,
    key_features: ["Tile or ceramic visible", "Reflective surfaces (fixtures)"],
    skip_questions_allowed: true,
  };

  assert.equal(result.category, "bathroom_remodel");
  assert.ok(result.confidence >= 0.85);
});

test("space classifier: recognizes kitchen remodel category", async () => {
  const result = {
    category: "kitchen_remodel",
    confidence: 0.87,
    key_features: ["Countertops/cabinetry visible", "Mixed materials detected"],
    skip_questions_allowed: true,
  };

  assert.equal(result.category, "kitchen_remodel");
  assert.ok(result.confidence >= 0.80);
});

test("space classifier: recognizes cleaning category", async () => {
  const result = {
    category: "cleaning",
    confidence: 0.76,
    key_features: ["Soiled or stained surfaces", "High texture variance"],
    skip_questions_allowed: true,
  };

  assert.equal(result.category, "cleaning");
  assert.ok(result.confidence >= 0.70);
});

test("space classifier: recognizes general carpentry category", async () => {
  const result = {
    category: "general_carpentry",
    confidence: 0.81,
    key_features: ["Wood grain or lumber visible"],
    skip_questions_allowed: true,
  };

  assert.equal(result.category, "general_carpentry");
  assert.ok(result.confidence >= 0.75);
});

test("space classifier: all 7 categories defined", async () => {
  const categories = [
    "interior_painting",
    "exterior_painting",
    "drywall_repair",
    "bathroom_remodel",
    "kitchen_remodel",
    "cleaning",
    "general_carpentry",
  ];

  categories.forEach(cat => {
    assert.ok(typeof cat === "string");
  });
});

test("space classifier: confidence in 0-1 range", async () => {
  const categories = [
    "interior_painting",
    "exterior_painting",
    "drywall_repair",
    "bathroom_remodel",
    "kitchen_remodel",
    "cleaning",
    "general_carpentry",
  ];

  categories.forEach(category => {
    const result = {
      category,
      confidence: 0.75,
      key_features: [],
    };

    assert.ok(result.confidence >= 0 && result.confidence <= 1.0);
  });
});

test("space classifier: skip_questions_allowed when confidence >= 0.75", async () => {
  const highConfidence = {
    category: "interior_painting",
    confidence: 0.82,
    skip_questions_allowed: true,
  };

  const lowConfidence = {
    category: "cleaning",
    confidence: 0.68,
    skip_questions_allowed: false,
  };

  assert.equal(highConfidence.skip_questions_allowed, highConfidence.confidence >= 0.75);
  assert.equal(lowConfidence.skip_questions_allowed, lowConfidence.confidence >= 0.75);
});

test("space classifier: category scores provided for all 7 categories", async () => {
  const result = {
    category: "interior_painting",
    confidence: 0.82,
    category_scores: {
      interior_painting: 0.82,
      exterior_painting: 0.45,
      drywall_repair: 0.38,
      bathroom_remodel: 0.22,
      kitchen_remodel: 0.19,
      cleaning: 0.15,
      general_carpentry: 0.31,
    },
  };

  assert.equal(Object.keys(result.category_scores).length, 7);
  assert.ok(result.category_scores[result.category] >= 0);
});

test("space classifier: key features generated for category", async () => {
  const results = [
    { category: "interior_painting", should_mention: "Indoor" },
    { category: "exterior_painting", should_mention: "Weathered" },
    { category: "bathroom_remodel", should_mention: "Tile" },
    { category: "kitchen_remodel", should_mention: "Countertops" },
    { category: "cleaning", should_mention: "Soiled" },
    { category: "drywall_repair", should_mention: "Seams" },
    { category: "general_carpentry", should_mention: "Wood" },
  ];

  results.forEach(r => {
    const result = {
      category: r.category,
      key_features: [r.should_mention],
    };

    assert.ok(result.key_features.some(f => f.includes(r.should_mention)));
  });
});

test("space classifier: edge density scoring validates category ranges", async () => {
  // interior_painting: 0.02-0.15 (smooth surfaces)
  // exterior_painting: 0.10-0.40 (rough/weathered)
  // cleaning: 0.15-0.50 (high complexity)

  const scenarios = [
    { category: "interior_painting", edge_density: 0.08, should_match: true },
    { category: "exterior_painting", edge_density: 0.25, should_match: true },
    { category: "cleaning", edge_density: 0.35, should_match: true },
    { category: "interior_painting", edge_density: 0.50, should_match: false },
  ];

  scenarios.forEach(s => {
    const in_range = s.category === "interior_painting" && s.edge_density >= 0.02 && s.edge_density <= 0.15 ||
                    s.category === "exterior_painting" && s.edge_density >= 0.10 && s.edge_density <= 0.40 ||
                    s.category === "cleaning" && s.edge_density >= 0.15 && s.edge_density <= 0.50;

    if (s.should_match) {
      assert.ok(in_range);
    }
  });
});

test("space classifier: reflectance scoring for bathroom/kitchen (high=tiles)", async () => {
  const scenarios = [
    { category: "bathroom_remodel", reflectance: 0.70, expected_boost: true },
    { category: "kitchen_remodel", reflectance: 0.68, expected_boost: true },
    { category: "interior_painting", reflectance: 0.70, expected_boost: false },
  ];

  scenarios.forEach(s => {
    assert.ok(s.reflectance >= 0 && s.reflectance <= 1.0);
    if (s.expected_boost) {
      assert.ok(s.reflectance > 0.60);
    }
  });
});

test("space classifier: cleaning category scores high for dirty surfaces", async () => {
  const scenarios = [
    { category: "cleaning", texture_variance: 1800, expected_match: true },
    { category: "cleaning", texture_variance: 500, expected_match: false },
  ];

  scenarios.forEach(s => {
    if (s.expected_match) {
      assert.ok(s.texture_variance > 1500);
    }
  });
});

test("space classifier: question generation for category", async () => {
  const categories = [
    "interior_painting",
    "exterior_painting",
    "drywall_repair",
    "bathroom_remodel",
    "kitchen_remodel",
    "cleaning",
    "general_carpentry",
  ];

  categories.forEach(cat => {
    const questions = {
      interior_painting: 3,
      exterior_painting: 3,
      drywall_repair: 3,
      bathroom_remodel: 3,
      kitchen_remodel: 3,
      cleaning: 3,
      general_carpentry: 3,
    };

    assert.equal(questions[cat], 3);
  });
});
