import test from "node:test";
import assert from "node:assert/strict";
import { detectCategoryFromText, getCategoryConfidence, CATEGORY_REGISTRY } from "../dist/modules/smart-intake/config/category-registry.js";
import { getSupportedQuestions, isPaintingCategory, detectCategoryConfidence, detectLanguage } from "../dist/modules/smart-intake/smart-intake.logic.js";

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
  const cat = detectCategoryFromText({ rawDescription: "Replace windows in the living room" });
  assert.equal(cat, "general_carpentry");
});

test("prefers flooring_installation when a description mentions hardwood floor", () => {
  const cat = detectCategoryFromText({ rawDescription: "Replace windows and install hardwood floor" });
  assert.equal(cat, "flooring_installation");
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
    "roofing",
    "hvac",
    "fencing_decks",
    "handyman",
    "masonry_concrete",
    "demolition",
    "moving",
    "pressure_washing",
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

// ── roofing & hvac ─────────────────────────────────────────────────────────

test("detects roofing from 'gotera en el techo'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Tengo una gotera en el techo de la sala" }), "roofing");
});

test("detects roofing from 'replace roof shingles'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Need to replace roof shingles after the storm" }), "roofing");
});

test("detects hvac from 'aire acondicionado'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "No enfría el aire acondicionado de la sala" }), "hvac");
});

test("detects hvac from 'install mini split'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Install a mini split in the bedroom" }), "hvac");
});

test("explicit selection maps techos/climatizacion to new categories", () => {
  assert.equal(detectCategoryFromText({ selectedCategoryId: "techos", rawDescription: "" }), "roofing");
  assert.equal(detectCategoryFromText({ selectedCategoryId: "climatizacion", rawDescription: "" }), "hvac");
});

test("existing categories keep detection after adding roofing/hvac", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Instalar piso laminado en la sala" }), "flooring_installation");
});

test("short keyword 'tub' does not match inside 'tuberia'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Reparar fuga de la tuberia de la cocina" }), "kitchen_remodel");
  assert.equal(detectCategoryFromText({ rawDescription: "Fuga en la tuberia del patio" }), "plumbing_repair");
  assert.equal(detectCategoryFromText({ rawDescription: "Replace the old tub" }), "bathroom_remodel");
});

// ── fencing & decks ────────────────────────────────────────────────────────

test("detects fencing_decks from 'build a wood fence'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "I want to build a wood fence around the yard" }), "fencing_decks");
});

test("detects fencing_decks from 'deck nuevo' ahead of general_carpentry", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Quiero un deck nuevo en la terraza" }), "fencing_decks");
});

test("explicit selection maps cercas to fencing_decks", () => {
  assert.equal(detectCategoryFromText({ selectedCategoryId: "cercas", rawDescription: "" }), "fencing_decks");
});

test("plain 'cerca de' does not trigger fencing_decks", () => {
  assert.notEqual(detectCategoryFromText({ rawDescription: "Pintar la pared cerca del baño" }), "fencing_decks");
});

// ── handyman ───────────────────────────────────────────────────────────────

test("detects handyman from 'mount a TV and assemble furniture'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Need someone to mount a TV and assemble furniture" }), "handyman");
});

test("detects handyman from 'arreglos varios'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Necesito un manitas para arreglos varios en casa" }), "handyman");
});

test("explicit selection maps handyman ids", () => {
  assert.equal(detectCategoryFromText({ selectedCategoryId: "handyman", rawDescription: "" }), "handyman");
  assert.equal(detectCategoryFromText({ selectedCategoryId: "manitas", rawDescription: "" }), "handyman");
});

test("specific trades keep precedence over handyman", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Handyman needed to fix a leak, the pipe is dripping" }), "plumbing_repair");
  assert.equal(detectCategoryFromText({ rawDescription: "Handyman to replace an outlet and fix the wiring" }), "electrical_work");
  assert.equal(detectCategoryFromText({ rawDescription: "Handyman to build a wood fence" }), "fencing_decks");
});

// ── masonry & concrete ─────────────────────────────────────────────────────

test("detects masonry_concrete from 'pour a concrete driveway'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "I want to pour a new concrete driveway" }), "masonry_concrete");
});

test("detects masonry_concrete from 'muro de ladrillo'", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Necesito levantar un muro de ladrillo en el patio" }), "masonry_concrete");
});

test("'retaining wall' is masonry_concrete, not interior_painting", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Build a retaining wall in the backyard" }), "masonry_concrete");
});

test("explicit selection maps albanileria/concreto to masonry_concrete", () => {
  assert.equal(detectCategoryFromText({ selectedCategoryId: "albanileria", rawDescription: "" }), "masonry_concrete");
  assert.equal(detectCategoryFromText({ selectedCategoryId: "concreto", rawDescription: "" }), "masonry_concrete");
});

test("painting, flooring and drywall keep detection after adding masonry_concrete", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Paint the walls of my living room" }), "interior_painting");
  assert.equal(detectCategoryFromText({ rawDescription: "Instalar piso laminado en la sala" }), "flooring_installation");
  assert.equal(detectCategoryFromText({ rawDescription: "I have a hole in my drywall that needs repair" }), "drywall_repair");
  assert.equal(detectCategoryFromText({ rawDescription: "Instalar losas de ceramica en la cocina" }), "kitchen_remodel");
});

// ── demolition, moving & pressure washing ──────────────────────────────────

test("detects pressure_washing ahead of exterior_painting and masonry", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Pressure wash the exterior of my house" }), "pressure_washing");
  assert.equal(detectCategoryFromText({ rawDescription: "Need power washing for my concrete driveway" }), "pressure_washing");
  assert.equal(detectCategoryFromText({ rawDescription: "Lavado a presión de la fachada" }), "pressure_washing");
});

test("detects demolition ahead of masonry and painting", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Demolition of an old shed in the yard" }), "demolition");
  assert.equal(detectCategoryFromText({ rawDescription: "Necesito demoler un muro de concreto" }), "demolition");
  assert.equal(detectCategoryFromText({ rawDescription: "We need to tear down a wall between rooms" }), "demolition");
});

test("detects moving from phrases and keeps cleaning for move-out cleaning", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Necesito una mudanza de apartamento este sabado" }), "moving");
  assert.equal(detectCategoryFromText({ rawDescription: "Looking for a moving company for a 2 bedroom" }), "moving");
  assert.equal(detectCategoryFromText({ rawDescription: "Limpieza despues de la mudanza" }), "cleaning");
});

test("'removing' does not trigger moving", () => {
  assert.notEqual(detectCategoryFromText({ rawDescription: "Removing old wallpaper from the hallway" }), "moving");
});

test("remodels keep precedence over demolition wording", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Kitchen demolition and new cabinets" }), "kitchen_remodel");
  assert.equal(detectCategoryFromText({ rawDescription: "Full bathroom remodel with demolition" }), "bathroom_remodel");
});

test("explicit selection maps the new category ids", () => {
  assert.equal(detectCategoryFromText({ selectedCategoryId: "demolicion", rawDescription: "" }), "demolition");
  assert.equal(detectCategoryFromText({ selectedCategoryId: "mudanzas", rawDescription: "" }), "moving");
  assert.equal(detectCategoryFromText({ selectedCategoryId: "lavado_presion", rawDescription: "" }), "pressure_washing");
});

test("painting and masonry keep their own phrases", () => {
  assert.equal(detectCategoryFromText({ rawDescription: "Pintura de fachada exterior de mi casa" }), "exterior_painting");
  assert.equal(detectCategoryFromText({ rawDescription: "I want to pour a new concrete driveway" }), "masonry_concrete");
});

// ── language detection ───────────────────────────────────────────────────

test("detectLanguage recognises Spanish descriptions beyond painting vocabulary", () => {
  for (const text of [
    "Tengo una fuga en el baño",
    "Necesito arreglar el techo de mi casa",
    "hola, quiero cambiar la puerta de entrada",
    "¿Cuánto cuesta instalar un piso nuevo?",
  ]) {
    assert.equal(detectLanguage(text), "es", text);
  }
});

test("detectLanguage keeps English descriptions as English", () => {
  for (const text of [
    "I have a leak in my bathroom",
    "Need to replace the roof on my house",
    "Hello, I want to paint my kitchen walls",
    "Install new flooring in the living room",
  ]) {
    assert.equal(detectLanguage(text), "en", text);
  }
});

test("detectLanguage defaults to English when there is no evidence", () => {
  assert.equal(detectLanguage("12345 !!!"), "en");
});

// ── keyword matching precision ────────────────────────────────────────────

const detect = (rawDescription: string) => detectCategoryFromText({ rawDescription });

test("keywords match from the start of a word, not inside other words", () => {
  // Nothing matches, so the category is only the painting fallback with minimal confidence.
  for (const text of ["Need a firewall configured at the office desk", "Washing the textile curtains"]) {
    const category = detect(text);
    assert.equal(getCategoryConfidence({ rawDescription: text, detectedCategory: category }), 0.24, text);
  }
});

test("existing keywords still match plural and suffixed forms", () => {
  assert.equal(detect("Remodelación de mi bathrooms"), "bathroom_remodel");
  assert.equal(detect("quiero cambiar los pisos de la casa"), "flooring_installation");
});

test("generic 'exterior'/'outdoor' do not outrank a specific trade", () => {
  assert.equal(detect("Replace my exterior door and frame"), "general_carpentry");
  assert.equal(detect("Build an outdoor kitchen with a countertop"), "kitchen_remodel");
  assert.equal(detect("Cambiar el tomacorriente exterior del patio"), "electrical_work");
});

test("generic 'exterior' still decides when nothing more specific matches", () => {
  assert.equal(detect("Something is wrong with the exterior of the house"), "exterior_painting");
  assert.equal(detect("Paint the exterior of my house"), "exterior_painting");
});

test("generic 'wall' does not outrank a specific trade but still falls back to painting", () => {
  assert.equal(detect("Install an outlet on the wall near the stove"), "kitchen_remodel");
  assert.equal(detect("Fix the wall outlet in my bedroom"), "electrical_work");
  assert.equal(detect("My bedroom wall looks bad"), "interior_painting");
});
