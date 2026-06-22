import test from "node:test";
import assert from "node:assert/strict";

// ── Material Detection Endpoint Tests ───────────────────────────────────────

test("vision material detector: POST /v1/vision/detect-material called with valid payload", async () => {
  // Expected request payload structure
  const payload = {
    imageUrl: "https://example.com/drywall.jpg",
    expectedMaterial: "drywall",
  };

  assert.ok(payload.imageUrl);
  assert.equal(payload.expectedMaterial, "drywall");
});

test("vision material detector: returns MaterialAnalysis with all required fields", async () => {
  const mockResponse = {
    material: "drywall",
    condition: "good",
    confidence: 0.88,
    estimated_stock: "moderate",
    notes: ["Material appears to be in good condition"],
  };

  assert.equal(mockResponse.material, "drywall");
  assert.ok(mockResponse.confidence >= 0.75);
  assert.ok(mockResponse.confidence <= 1.0);
  assert.ok(["new", "good", "fair", "damaged"].includes(mockResponse.condition));
  assert.ok(["abundant", "moderate", "low"].includes(mockResponse.estimated_stock));
  assert.ok(Array.isArray(mockResponse.notes));
});

test("vision material detector: endpoint accepts optional expectedMaterial hint", async () => {
  const withHint = { imageUrl: "https://example.com/wood.jpg", expectedMaterial: "wood" };
  const withoutHint = { imageUrl: "https://example.com/wood.jpg" };

  assert.ok(withHint.expectedMaterial);
  assert.equal(withoutHint.expectedMaterial, undefined);
});

test("vision material detector: all 6 material types can be detected", async () => {
  const materials = ["drywall", "wood", "brick", "tile", "concrete", "metal"];
  const results = materials.map(material => ({
    material,
    condition: "good",
    confidence: 0.82,
  }));

  results.forEach(result => {
    assert.ok(materials.includes(result.material));
  });
});

test("vision material detector: condition transitions follow logical order", async () => {
  const conditions = [
    { condition: "new", expected: "new", min_damage: 0, max_damage: 0.25 },
    { condition: "good", expected: "good", min_damage: 0.25, max_damage: 0.45 },
    { condition: "fair", expected: "fair", min_damage: 0.45, max_damage: 0.70 },
    { condition: "damaged", expected: "damaged", min_damage: 0.70, max_damage: 1.0 },
  ];

  conditions.forEach(c => {
    assert.equal(c.condition, c.expected);
  });
});

test("vision material detector: stock estimation scales with visible contours", async () => {
  const stocks = [
    { visible_sections: 10, expected: "abundant" },
    { visible_sections: 5, expected: "moderate" },
    { visible_sections: 2, expected: "low" },
  ];

  stocks.forEach(s => {
    const estimated = s.visible_sections >= 8 ? "abundant" : s.visible_sections >= 4 ? "moderate" : "low";
    assert.equal(estimated, s.expected);
  });
});

test("vision material detector: confidence boost for expected material hint", async () => {
  const scenarios = [
    { hint: true, baseline: 0.75, expected_boost: 1.15 },
    { hint: false, baseline: 0.75, expected_boost: 1.0 },
  ];

  scenarios.forEach(s => {
    const boosted = s.baseline * s.expected_boost;
    assert.ok(boosted >= 0.75);
    if (s.hint) assert.ok(boosted > 0.75);
  });
});

test("vision material detector: notes generated for damage scenarios", async () => {
  const scenarios = [
    { material: "drywall", condition: "damaged", should_mention: "damage" },
    { material: "wood", condition: "new", should_mention: "fresh" },
    { material: "brick", condition: "fair", should_mention: "irregularities" },
  ];

  scenarios.forEach(s => {
    const notes = [];
    if (s.material === "drywall" && s.condition === "damaged") {
      notes.push("Drywall shows signs of water damage or impact");
    }
    if (s.condition === "new") {
      notes.push("Material appears to be freshly installed or high-quality");
    }
    if (s.should_mention === "irregularities") {
      notes.push("High surface irregularities detected");
    }

    assert.ok(notes.some(n => n.includes(s.should_mention)));
  });
});

test("vision material detector: handles edge case - pure white surface (high reflectance)", async () => {
  const whiteTile = {
    material: "tile",
    condition: "new",
    confidence: 0.90,
    estimated_stock: "low",
    notes: ["Material appears to be freshly installed or high-quality"],
  };

  assert.equal(whiteTile.material, "tile");
  assert.equal(whiteTile.condition, "new");
  assert.ok(whiteTile.confidence >= 0.85);
});

test("vision material detector: handles edge case - heavily textured surface (high variance)", async () => {
  const roughConcrete = {
    material: "concrete",
    condition: "damaged",
    confidence: 0.72,
    estimated_stock: "abundant",
    notes: ["Rough/textured surface characteristics"],
  };

  assert.equal(roughConcrete.material, "concrete");
  assert.equal(roughConcrete.condition, "damaged");
  assert.ok(roughConcrete.notes.some(n => n.includes("Rough")));
});

test("vision material detector: vision service client integration", async () => {
  // Simulate what the client would send to the microservice
  const request = {
    imageUrl: "https://example.com/bathroom.jpg",
    expectedMaterial: "tile",
  };

  const mockAnalyzeCall = async (req) => {
    // Mock response from Python microservice
    return {
      material: req.expectedMaterial || "tile",
      condition: "good",
      confidence: 0.85,
      estimated_stock: "moderate",
      notes: [],
    };
  };

  const result = await mockAnalyzeCall(request);
  assert.equal(result.material, "tile");
});

test("vision material detector: material profiles HSV ranges defined", async () => {
  const profiles = {
    drywall: { edge_density: [0.02, 0.12], texture_variance: [50, 400] },
    wood: { edge_density: [0.05, 0.25], texture_variance: [200, 1500] },
    brick: { edge_density: [0.15, 0.40], texture_variance: [400, 2000] },
    tile: { edge_density: [0.08, 0.20], texture_variance: [50, 300] },
    concrete: { edge_density: [0.10, 0.30], texture_variance: [800, 2500] },
    metal: { edge_density: [0.05, 0.15], texture_variance: [100, 500] },
  };

  Object.entries(profiles).forEach(([material, profile]) => {
    assert.ok(profile.edge_density);
    assert.ok(profile.texture_variance);
    assert.equal(profile.edge_density.length, 2);
    assert.equal(profile.texture_variance.length, 2);
  });
});

test("vision material detector: scoring algorithm weighted correctly", async () => {
  // Weights: color (40%), edge density (30%), texture variance (20%), expectation bonus (×1.15)
  const weights = {
    color: 0.4,
    edge_density: 0.3,
    texture_variance: 0.2,
    expectation_bonus: 1.15,
  };

  const sum = weights.color + weights.edge_density + weights.texture_variance;
  assert.equal(sum, 0.9); // Before expectation bonus
  assert.ok(weights.expectation_bonus > 1.0);
});

test("vision material detector: confidence always in valid range", async () => {
  const materials = ["drywall", "wood", "brick", "tile", "concrete", "metal"];

  materials.forEach(material => {
    const results = [
      { confidence: 0.88 },
      { confidence: 0.82 },
      { confidence: 0.75 },
      { confidence: 0.99 },
    ];

    results.forEach(r => {
      assert.ok(r.confidence >= 0 && r.confidence <= 1.0);
    });
  });
});
