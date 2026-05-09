// Minimal safe payloads for SEMSE tools API smoke tests.

export const CONCRETE_PAYLOAD = {
  tool: "concrete",
  mode: "professional",
  input: {
    lengthFt: 20,
    widthFt: 15,
    thicknessIn: 4,
    wastePercent: 10,
    mixStrength: "3000psi",
    reinforced: true,
    formworkIncluded: true,
    pumpRequired: false,
  },
};

export const ROOFING_PAYLOAD = {
  tool: "roofing",
  mode: "professional",
  input: {
    roofAreaSqFt: 2000,
    pitch: "6/12",
    material: "asphalt-shingles",
    layersToRemove: 1,
    decking: true,
    guttersIncluded: false,
    skylight: false,
    chimney: false,
  },
};

export const DEMO_CREDENTIALS = {
  admin: { email: "admin@demo.semse", password: "demo1234" },
  client: { email: "client@demo.semse", password: "demo1234" },
  worker: { email: "worker@demo.semse", password: "demo1234" },
};
