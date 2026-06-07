import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBathroomRemodel,
  calculateKitchenRemodel,
  calculateCleaning,
} from "../../../packages/tools/dist/index.js";

// ── bathroom_remodel ──────────────────────────────────────────────────────────

test("bathroom cosmetic update returns valid result", () => {
  const result = calculateBathroomRemodel({
    scope: "cosmetic",
    bathroomSqFt: "medium",
    plumbingWork: "no_move",
    materialQuality: "standard",
    includesShower: false,
    includesTub: false,
    demoRequired: false,
    clientProvidesMaterials: false,
    mode: "professional",
  });
  assert.ok(result.isValid);
  assert.ok(result.costs.total > 0);
  assert.equal(result.trade, "remodeling");
  assert.ok(result.milestones.length >= 2);
});

test("bathroom full remodel has higher cost than cosmetic", () => {
  const cosmetic = calculateBathroomRemodel({
    scope: "cosmetic", bathroomSqFt: "medium", plumbingWork: "no_move",
    materialQuality: "standard", includesShower: false, includesTub: false,
    demoRequired: false, clientProvidesMaterials: false, mode: "professional",
  });
  const full = calculateBathroomRemodel({
    scope: "full_remodel", bathroomSqFt: "medium", plumbingWork: "no_move",
    materialQuality: "standard", includesShower: true, includesTub: false,
    demoRequired: true, clientProvidesMaterials: false, mode: "professional",
  });
  assert.ok(full.costs.total > cosmetic.costs.total, `full (${full.costs.total}) > cosmetic (${cosmetic.costs.total})`);
});

test("bathroom with plumbing relocation raises risk", () => {
  const noMove = calculateBathroomRemodel({
    scope: "full_remodel", bathroomSqFt: "medium", plumbingWork: "no_move",
    materialQuality: "standard", includesShower: true, includesTub: false,
    demoRequired: true, clientProvidesMaterials: false, mode: "professional",
  });
  const relocate = calculateBathroomRemodel({
    scope: "full_remodel", bathroomSqFt: "medium", plumbingWork: "relocate",
    materialQuality: "standard", includesShower: true, includesTub: false,
    demoRequired: true, clientProvidesMaterials: false, mode: "professional",
  });
  assert.ok(relocate.risk.score > noMove.risk.score, `relocate risk (${relocate.risk.score}) > no_move (${noMove.risk.score})`);
  assert.ok(relocate.risk.requiresLicense);
  assert.ok(relocate.risk.requiresPermit);
});

test("bathroom premium costs more than budget", () => {
  const budget = calculateBathroomRemodel({
    scope: "full_remodel", bathroomSqFt: "medium", plumbingWork: "no_move",
    materialQuality: "budget", includesShower: false, includesTub: false,
    demoRequired: false, clientProvidesMaterials: false, mode: "professional",
  });
  const premium = calculateBathroomRemodel({
    scope: "full_remodel", bathroomSqFt: "medium", plumbingWork: "no_move",
    materialQuality: "premium", includesShower: false, includesTub: false,
    demoRequired: false, clientProvidesMaterials: false, mode: "professional",
  });
  assert.ok(premium.costs.total > budget.costs.total);
});

test("bathroom full remodel has milestones with payment percentages summing to 100", () => {
  const result = calculateBathroomRemodel({
    scope: "full_remodel", bathroomSqFt: "medium", plumbingWork: "no_move",
    materialQuality: "standard", includesShower: true, includesTub: false,
    demoRequired: true, clientProvidesMaterials: false, mode: "professional",
  });
  assert.ok(result.milestones.length >= 2, `Expected >= 2 milestones, got ${result.milestones.length}`);
  const totalPct = result.milestones.reduce((s, m) => s + (m.percentage ?? 0), 0);
  assert.ok(totalPct >= 99 && totalPct <= 101, `Payment percents should sum to ~100, got ${totalPct}`);
});

// ── kitchen_remodel ───────────────────────────────────────────────────────────

test("kitchen cabinet update returns valid result", () => {
  const result = calculateKitchenRemodel({
    scope: "cabinet_update",
    kitchenSize: "medium",
    appliances: "no_appliances",
    materialQuality: "standard",
    plumbingElectrical: "no",
    clientProvidesMaterials: false,
    mode: "professional",
  });
  assert.ok(result.isValid);
  assert.ok(result.costs.total > 0);
  assert.equal(result.trade, "remodeling");
  assert.ok(result.milestones.length >= 2);
});

test("kitchen full remodel costs significantly more than cabinet update", () => {
  const update = calculateKitchenRemodel({
    scope: "cabinet_update", kitchenSize: "medium", appliances: "no_appliances",
    materialQuality: "standard", plumbingElectrical: "no",
    clientProvidesMaterials: false, mode: "professional",
  });
  const full = calculateKitchenRemodel({
    scope: "full_remodel", kitchenSize: "medium", appliances: "basic_appliances",
    materialQuality: "standard", plumbingElectrical: "minor",
    clientProvidesMaterials: false, mode: "professional",
  });
  assert.ok(full.costs.total > update.costs.total * 2,
    `full (${full.costs.total}) should be > 2x cabinet update (${update.costs.total})`);
});

test("kitchen with plumbing relocation raises risk and triggers permit", () => {
  const noPlumbing = calculateKitchenRemodel({
    scope: "full_remodel", kitchenSize: "medium", appliances: "no_appliances",
    materialQuality: "standard", plumbingElectrical: "no",
    clientProvidesMaterials: false, mode: "professional",
  });
  const relocate = calculateKitchenRemodel({
    scope: "full_remodel", kitchenSize: "medium", appliances: "no_appliances",
    materialQuality: "standard", plumbingElectrical: "relocate",
    clientProvidesMaterials: false, mode: "professional",
  });
  assert.ok(relocate.risk.score > noPlumbing.risk.score);
  assert.ok(relocate.risk.requiresPermit);
});

test("kitchen full remodel has milestones with payment percentages summing to 100", () => {
  const result = calculateKitchenRemodel({
    scope: "full_remodel", kitchenSize: "medium", appliances: "no_appliances",
    materialQuality: "standard", plumbingElectrical: "no",
    clientProvidesMaterials: false, mode: "professional",
  });
  assert.ok(result.milestones.length >= 2, `Expected >= 2 milestones, got ${result.milestones.length}`);
  const totalPct = result.milestones.reduce((s, m) => s + (m.percentage ?? 0), 0);
  assert.ok(totalPct >= 99 && totalPct <= 101, `Payment percents should sum to ~100, got ${totalPct}`);
});

test("kitchen client provides materials adds risk warning", () => {
  const result = calculateKitchenRemodel({
    scope: "cabinet_update", kitchenSize: "medium", appliances: "no_appliances",
    materialQuality: "standard", plumbingElectrical: "no",
    clientProvidesMaterials: true, mode: "professional",
  });
  assert.ok(result.validationIssues.some(i => i.field === "clientProvidesMaterials"));
});

// ── cleaning ──────────────────────────────────────────────────────────────────

test("cleaning standard service returns valid result", () => {
  const result = calculateCleaning({
    serviceType: "standard",
    squareFt: 1200,
    bedrooms: 3,
    bathrooms: 2,
    condition: "moderate",
    addOns: [],
    frequency: "one_time",
    suppliesIncluded: true,
    mode: "professional",
  });
  assert.ok(result.isValid);
  assert.ok(result.costs.total > 0);
  assert.equal(result.trade, "cleaning");
});

test("cleaning post_construction is more expensive than standard", () => {
  const standard = calculateCleaning({
    serviceType: "standard", squareFt: 1200, bedrooms: 3, bathrooms: 2,
    condition: "moderate", addOns: [], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  const postConstr = calculateCleaning({
    serviceType: "post_construction", squareFt: 1200, bedrooms: 3, bathrooms: 2,
    condition: "post_construction", addOns: [], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  assert.ok(postConstr.costs.total > standard.costs.total,
    `post_construction (${postConstr.costs.total}) > standard (${standard.costs.total})`);
});

test("cleaning heavy condition raises risk", () => {
  const moderate = calculateCleaning({
    serviceType: "deep", squareFt: 1000, bedrooms: 2, bathrooms: 2,
    condition: "moderate", addOns: [], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  const heavy = calculateCleaning({
    serviceType: "deep", squareFt: 1000, bedrooms: 2, bathrooms: 2,
    condition: "heavy", addOns: [], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  assert.ok(heavy.risk.score > moderate.risk.score);
});

test("cleaning with add-ons costs more than without", () => {
  const plain = calculateCleaning({
    serviceType: "deep", squareFt: 1500, bedrooms: 3, bathrooms: 2,
    condition: "moderate", addOns: [], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  const withAddOns = calculateCleaning({
    serviceType: "deep", squareFt: 1500, bedrooms: 3, bathrooms: 2,
    condition: "moderate", addOns: ["windows", "oven", "fridge"], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  assert.ok(withAddOns.costs.total > plain.costs.total);
});

test("cleaning recurring is cheaper than one_time per visit", () => {
  const oneTime = calculateCleaning({
    serviceType: "standard", squareFt: 1000, bedrooms: 2, bathrooms: 1,
    condition: "light", addOns: [], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  const weekly = calculateCleaning({
    serviceType: "standard", squareFt: 1000, bedrooms: 2, bathrooms: 1,
    condition: "light", addOns: [], frequency: "weekly",
    suppliesIncluded: true, mode: "professional",
  });
  assert.ok(weekly.costs.total < oneTime.costs.total, `weekly (${weekly.costs.total}) < one_time (${oneTime.costs.total})`);
});

test("cleaning move_inout has higher risk than standard", () => {
  const std = calculateCleaning({
    serviceType: "standard", squareFt: 1000, bedrooms: 2, bathrooms: 1,
    condition: "moderate", addOns: [], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  const moveOut = calculateCleaning({
    serviceType: "move_inout", squareFt: 1000, bedrooms: 2, bathrooms: 1,
    condition: "moderate", addOns: [], frequency: "one_time",
    suppliesIncluded: true, mode: "professional",
  });
  assert.ok(moveOut.risk.score > std.risk.score);
});
