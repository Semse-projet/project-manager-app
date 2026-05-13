import test from "node:test";
import assert from "node:assert/strict";
import { detectCategoryFromText, getCategoryConfidence, CATEGORY_REGISTRY } from "../dist/modules/smart-intake/config/category-registry.js";
import { getSupportedQuestions, isPaintingCategory, detectCategoryConfidence } from "../dist/modules/smart-intake/smart-intake.logic.js";

// ── detectCategoryFromText ─────────────────────────────────────────────────

test("detects interior_painting from keyword 'pintura'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Necesito pintura en las paredes de mi sala" });
  assert.equal(cat, "interior_painting");
});

test("detects interior_painting from keyword 'paint'", () => {
  const cat = detectCategoryFromText({ rawDescription: "I need to paint my bedroom walls" });
  assert.equal(cat, "interior_painting");
});

test("detects exterior_painting from keyword 'exterior'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Paint the exterior of my house and siding" });
  assert.equal(cat, "exterior_painting");
});

test("detects exterior_painting from keyword 'fachada'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Pintura de fachada exterior de mi casa" });
  assert.equal(cat, "exterior_painting");
});

test("detects drywall_repair from keyword 'drywall'", () => {
  const cat = detectCategoryFromText({ rawDescription: "I have a hole in my drywall that needs repair" });
  assert.equal(cat, "drywall_repair");
});

test("detects drywall_repair from keyword 'agujero en pared'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Tengo un agujero en pared del cuarto" });
  assert.equal(cat, "drywall_repair");
});

test("detects bathroom_remodel from keyword 'bathroom'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Full bathroom remodel with new tile and shower" });
  assert.equal(cat, "bathroom_remodel");
});

test("detects bathroom_remodel from keyword 'baño'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Quiero remodelar el baño principal con nueva ducha" });
  assert.equal(cat, "bathroom_remodel");
});

test("detects kitchen_remodel from keyword 'kitchen'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Kitchen renovation with new cabinets and countertops" });
  assert.equal(cat, "kitchen_remodel");
});

test("detects kitchen_remodel from keyword 'cocina'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Remodelacion de cocina con nuevos gabinetes" });
  assert.equal(cat, "kitchen_remodel");
});

test("detects cleaning from keyword 'limpieza'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Necesito limpieza profunda de mi apartamento" });
  assert.equal(cat, "cleaning");
});

test("detects cleaning from keyword 'deep clean'", () => {
  const cat = detectCategoryFromText({ rawDescription: "I need a deep clean of my house before moving out" });
  assert.equal(cat, "cleaning");
});

test("detects general_carpentry from keyword 'puerta'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Instalar puertas nuevas en todos los cuartos" });
  assert.equal(cat, "general_carpentry");
});

test("detects general_carpentry from keyword 'window'", () => {
  const cat = detectCategoryFromText({ rawDescription: "Replace windows and install hardwood floor" });
  assert.equal(cat, "general_carpentry");
});

test("falls back to interior_painting for unrecognized description", () => {
  const cat = detectCategoryFromText({ rawDescription: "Need some work done in my home" });
  assert.equal(cat, "interior_painting");
});

// ── explicit category selection ────────────────────────────────────────────

test("explicit selectedCategoryId 'pintura' maps to interior_painting", () => {
  const cat = detectCategoryFromText({ selectedCategoryId: "pintura", rawDescription: "" });
  assert.equal(cat, "interior_painting");
});

test("explicit selectedCategoryId 'pintura' + subcategory 'exterior' maps to exterior_painting", () => {
  const cat = detectCategoryFromText({ selectedCategoryId: "pintura", selectedSubcategoryId: "exterior", rawDescription: "" });
  assert.equal(cat, "exterior_painting");
});

test("explicit selectedCategoryId 'bano' maps to bathroom_remodel", () => {
  const cat = detectCategoryFromText({ selectedCategoryId: "bano", rawDescription: "" });
  assert.equal(cat, "bathroom_remodel");
});

test("explicit selectedCategoryId 'cocina' maps to kitchen_remodel", () => {
  const cat = detectCategoryFromText({ selectedCategoryId: "cocina", rawDescription: "" });
  assert.equal(cat, "kitchen_remodel");
});

test("explicit selectedCategoryId 'drywall' maps to drywall_repair", () => {
  const cat = detectCategoryFromText({ selectedCategoryId: "drywall", rawDescription: "" });
  assert.equal(cat, "drywall_repair");
});

test("explicit selectedCategoryId 'limpieza' maps to cleaning", () => {
  const cat = detectCategoryFromText({ selectedCategoryId: "limpieza", rawDescription: "" });
  assert.equal(cat, "cleaning");
});

// ── confidence scores ──────────────────────────────────────────────────────

test("explicit selection returns high confidence (>= 0.95)", () => {
  const conf = getCategoryConfidence({
    selectedCategoryId: "bano",
    rawDescription: "",
    detectedCategory: "bathroom_remodel",
  });
  assert.ok(conf >= 0.95, `Expected >= 0.95, got ${conf}`);
});

test("keyword detection returns medium-high confidence (>= 0.70)", () => {
  const conf = getCategoryConfidence({
    rawDescription: "I need to paint my bedroom",
    detectedCategory: "interior_painting",
  });
  assert.ok(conf >= 0.70, `Expected >= 0.70, got ${conf}`);
});

test("unrecognized description returns low confidence (< 0.30)", () => {
  const conf = getCategoryConfidence({
    rawDescription: "Need some help with my home",
    detectedCategory: "interior_painting",
  });
  assert.ok(conf < 0.30, `Expected < 0.30, got ${conf}`);
});

// ── getSupportedQuestions dispatch ─────────────────────────────────────────

test("getSupportedQuestions returns questions for all 7 categories", () => {
  const categories = [
    "interior_painting",
    "exterior_painting",
    "drywall_repair",
    "bathroom_remodel",
    "kitchen_remodel",
    "cleaning",
    "general_carpentry",
  ] as const;

  for (const cat of categories) {
    const questions = getSupportedQuestions(cat);
    assert.ok(questions.length > 0, `Expected questions for ${cat}, got 0`);
    assert.ok(questions.every(q => q.category === cat), `All questions for ${cat} should have matching category`);
  }
});

// ── CATEGORY_REGISTRY completeness ─────────────────────────────────────────

test("every category in registry has trade, projectType, and milestones", () => {
  for (const [id, def] of Object.entries(CATEGORY_REGISTRY)) {
    assert.ok(def.trade.length > 0, `${id}: trade missing`);
    assert.ok(def.projectType.length > 0, `${id}: projectType missing`);
    assert.ok(def.milestones.length >= 2, `${id}: milestones too few`);
    assert.ok(def.keywords.length > 0, `${id}: keywords missing`);
  }
});

test("isPaintingCategory returns true for painting descriptions", () => {
  assert.equal(isPaintingCategory({ rawDescription: "Quiero pintar la sala" }), true);
  assert.equal(isPaintingCategory({ rawDescription: "Exterior paint for my house" }), true);
});

test("isPaintingCategory returns false for non-painting descriptions", () => {
  assert.equal(isPaintingCategory({ rawDescription: "Fix the drywall in my bathroom" }), false);
  assert.equal(isPaintingCategory({ rawDescription: "Kitchen renovation project" }), false);
});

test("detectCategoryConfidence (logic export) aligns with registry", () => {
  const conf = detectCategoryConfidence({ rawDescription: "Need drywall repair and patching" });
  assert.ok(conf >= 0.70, `Expected >= 0.70 for clear drywall description, got ${conf}`);
});
