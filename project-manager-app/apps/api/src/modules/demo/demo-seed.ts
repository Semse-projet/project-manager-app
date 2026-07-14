// Seed determinista de la granja demo (ui.demo-sandbox).
// Se reconstruye completo en cada reset: nada aquí puede depender de estado previo.

export const DEMO_TENANT_SLUG = "semse-demo";
export const DEMO_AGRO_EMAIL = "demo-agro@semse.internal";
export const DEMO_FARM_NAME = "Finca Demostración SEMSE";
export const DEMO_SESSION_TTL_SECONDS = 30 * 60;
export const DEMO_FARM_RESET_AFTER_MS = 6 * 60 * 60 * 1000;

export const demoFarmSeed = {
  farm: {
    name: DEMO_FARM_NAME,
    operationType: "MIXED",
    locationLabel: "Valle Central (datos ficticios)",
    notes: "Granja de demostración pública. Los datos se restauran periódicamente.",
  },
  units: [
    { name: "Potrero Norte", type: "PASTURE", areaValue: 4, areaUnit: "HECTARE" },
    { name: "Corral Principal", type: "CORRAL" },
    { name: "Bodega de Insumos", type: "STORAGE" },
  ],
  animals: [
    { tagCode: "DEMO-001", species: "CATTLE", breed: "Brahman", sex: "FEMALE", purpose: "DAIRY", estimatedAgeMonths: 38, currentWeight: 420.5, estimatedValue: 1500 },
    { tagCode: "DEMO-002", species: "CATTLE", breed: "Brahman", sex: "FEMALE", purpose: "BREEDING", estimatedAgeMonths: 52, currentWeight: 465, estimatedValue: 1700 },
    { tagCode: "DEMO-003", species: "CATTLE", breed: "Angus", sex: "MALE", purpose: "FATTENING", estimatedAgeMonths: 20, currentWeight: 380, estimatedValue: 1300, expectedSalePrice: 1650 },
    { tagCode: "DEMO-010", species: "GOAT", breed: "Boer", sex: "FEMALE", purpose: "BREEDING", estimatedAgeMonths: 26, currentWeight: 48, estimatedValue: 220 },
    { tagCode: "DEMO-020", species: "CHICKEN", sex: "FEMALE", purpose: "LAYING", estimatedAgeMonths: 10, estimatedValue: 12 },
  ],
  inventoryItems: [
    { name: "Concentrado lechero 40lb", category: "FEED", unit: "BAG", minimumStock: 10, initialStock: 24, unitCost: 18.5 },
    { name: "Vacuna triple bovina", category: "VACCINE", unit: "DOSE", minimumStock: 20, initialStock: 60, unitCost: 3.2 },
    { name: "Fertilizante 15-15-15", category: "FERTILIZER", unit: "BAG", minimumStock: 5, initialStock: 12, unitCost: 32 },
  ],
  tasks: [
    { title: "Vacunación lote bovino", type: "VACCINATION", status: "PENDING", priority: "HIGH", dueInDays: 2 },
    { title: "Pesaje mensual de engorde", type: "WEIGHING", status: "PENDING", priority: "MEDIUM", dueInDays: 5 },
    { title: "Revisión de bebederos", type: "WATER_CHECK", status: "COMPLETED", priority: "MEDIUM", dueInDays: -1 },
  ],
  costEntries: [
    { category: "FEED", amount: 444, description: "Compra de concentrado (24 sacos)", daysAgo: 6 },
    { category: "VETERINARY", amount: 192, description: "Vacunas y desparasitante", daysAgo: 12 },
    { category: "LABOR", amount: 350, description: "Jornales semana anterior", daysAgo: 4 },
  ],
} as const;
