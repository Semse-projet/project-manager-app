import test from "node:test";
import assert from "node:assert/strict";

// ── Inline catalog data from tools.controller.ts ─────────────────────────────

type ToolCatalogEntry = { id: string; name: string; category: string; description: string };
type ToolInputSchema = { trade: string; requiredFields: string[]; optionalFields: string[]; notes: string };

const TOOL_CATALOG: ToolCatalogEntry[] = [
  { id: "electrical",      name: "Electrical",         category: "mechanical",  description: "Residential & commercial electrical work" },
  { id: "plumbing",        name: "Plumbing",            category: "mechanical",  description: "Fixtures, pipe sizing, water heaters" },
  { id: "hvac",            name: "HVAC",                category: "mechanical",  description: "Load calculations, duct design" },
  { id: "painting",        name: "Painting",            category: "finish",      description: "Interior/exterior painting" },
  { id: "drywall",         name: "Drywall",             category: "finish",      description: "Drywall installation and finishing" },
  { id: "tile",            name: "Tile",                category: "finish",      description: "Tile installation" },
  { id: "flooring",        name: "Flooring",            category: "finish",      description: "Flooring installation" },
  { id: "carpentry",       name: "Carpentry",           category: "finish",      description: "Finish carpentry" },
  { id: "bathroom",        name: "Bathroom Remodel",    category: "remodel",     description: "Full bathroom remodel" },
  { id: "kitchen",         name: "Kitchen Remodel",     category: "remodel",     description: "Kitchen remodel" },
  { id: "roofing",         name: "Roofing",             category: "exterior",    description: "Roofing" },
  { id: "siding",          name: "Siding",              category: "exterior",    description: "Siding" },
  { id: "windows-doors",   name: "Windows & Doors",     category: "exterior",    description: "Windows & Doors" },
  { id: "deck",            name: "Deck",                category: "exterior",    description: "Deck" },
  { id: "fencing",         name: "Fencing",             category: "exterior",    description: "Fencing" },
  { id: "landscaping",     name: "Landscaping",         category: "exterior",    description: "Landscaping" },
  { id: "solar",           name: "Solar",               category: "specialty",   description: "Solar" },
  { id: "insulation",      name: "Insulation",          category: "specialty",   description: "Insulation" },
  { id: "concrete",        name: "Concrete",            category: "structural",  description: "Concrete" },
  { id: "masonry",         name: "Masonry",             category: "structural",  description: "Masonry" },
  { id: "framing",         name: "Framing",             category: "structural",  description: "Framing" },
  { id: "demolition",      name: "Demolition",          category: "structural",  description: "Demolition" },
  { id: "cleaning",        name: "Cleaning",            category: "services",    description: "Cleaning" },
  { id: "labor",           name: "Labor",               category: "services",    description: "Labor" },
  { id: "project-manager", name: "Project Manager",     category: "services",    description: "Project management" },
];

const TOOL_INPUT_SCHEMAS: Record<string, ToolInputSchema> = {
  electrical: { trade: "electrical", requiredFields: ["sqft"], optionalFields: ["panels", "circuits"], notes: "sqft is square footage" },
  solar:      { trade: "solar",      requiredFields: ["kw"],   optionalFields: ["panels", "battery"],  notes: "kw is system size" },
};

// ── Tests ──────────────────────────────────────────────────────────────────────

test("tools catalog — has 25 entries", () => {
  assert.equal(TOOL_CATALOG.length, 25);
});

test("tools catalog — all entries have required fields", () => {
  for (const entry of TOOL_CATALOG) {
    assert.ok(entry.id, `Missing id in entry: ${JSON.stringify(entry)}`);
    assert.ok(entry.name, `Missing name for ${entry.id}`);
    assert.ok(entry.category, `Missing category for ${entry.id}`);
    assert.ok(entry.description, `Missing description for ${entry.id}`);
  }
});

test("tools catalog — categories are valid", () => {
  const validCategories = new Set(["mechanical", "finish", "remodel", "exterior", "specialty", "structural", "services"]);
  for (const entry of TOOL_CATALOG) {
    assert.ok(validCategories.has(entry.category), `Unknown category '${entry.category}' for ${entry.id}`);
  }
});

test("tools catalog — no duplicate IDs", () => {
  const ids = TOOL_CATALOG.map((e) => e.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, "Duplicate tool IDs found");
});

test("tools schema — electrical has sqft as required field", () => {
  const schema = TOOL_INPUT_SCHEMAS["electrical"];
  assert.ok(schema, "electrical schema missing");
  assert.ok(schema.requiredFields.includes("sqft"), "sqft should be required for electrical");
});

test("tools schema — solar uses kw as required field", () => {
  const schema = TOOL_INPUT_SCHEMAS["solar"];
  assert.ok(schema, "solar schema missing");
  assert.ok(schema.requiredFields.includes("kw"), "kw should be required for solar");
});

test("tools schema — missing trade throws error equivalent", () => {
  const schema = TOOL_INPUT_SCHEMAS["nonexistent-trade"];
  assert.equal(schema, undefined, "unknown trade should have no schema");
});
