// T-004 (docs/specs/api/cost-engine.tasks.md): 24 trade engines x 3 scenarios
// (normal, complex, limit) = 72 initial diagnostic scenarios.
// These inputs only exercise the engines as they are today; they are NOT market-validated prices.

export type Kind = "normal" | "complex" | "limit";

export type Scenario = {
  trade: string;
  fn: string; // exported entry point of @semse/tools
  kind: Kind;
  input: Record<string, unknown>;
};

const mode = "professional";

type Triple = { fn: string; normal: Record<string, unknown>; complex: Record<string, unknown>; limit: Record<string, unknown> };

const ENGINES: Record<string, Triple> = {
  bathroom: {
    fn: "calculateBathroomRemodel",
    normal: { scope: "full_remodel", bathroomSqFt: "medium", plumbingWork: "fixtures_only", materialQuality: "standard", includesShower: true, includesTub: false, demoRequired: true, clientProvidesMaterials: false },
    complex: { scope: "full_remodel", bathroomSqFt: "extra_large", plumbingWork: "relocate", materialQuality: "premium", includesShower: true, includesTub: true, demoRequired: true, clientProvidesMaterials: false },
    limit: { scope: "cosmetic", bathroomSqFt: "small", plumbingWork: "no_move", materialQuality: "budget", includesShower: false, includesTub: false, demoRequired: false, clientProvidesMaterials: true },
  },
  carpentry: {
    fn: "calculateCarpentry",
    normal: { projectType: "cabinet", material: "oak", lengthIn: 48, widthIn: 24, thicknessIn: 0.75, quantity: 2, finishType: "stain", complexity: "medium", hardwareCount: 4, paintedCabinets: false, softClose: false },
    complex: { projectType: "built-in", material: "maple", lengthIn: 120, widthIn: 30, thicknessIn: 1, quantity: 6, finishType: "lacquer", complexity: "complex", hardwareCount: 24, paintedCabinets: true, softClose: true },
    limit: { projectType: "trim", material: "pine", lengthIn: 12, widthIn: 1, thicknessIn: 0.25, quantity: 1, finishType: "none", complexity: "basic", hardwareCount: 0, paintedCabinets: false, softClose: false },
  },
  cleaning: {
    fn: "calculateCleaning",
    normal: { serviceType: "standard", squareFt: 1500, bedrooms: 3, bathrooms: 2, condition: "moderate", addOns: ["windows"], frequency: "one_time", suppliesIncluded: true },
    complex: { serviceType: "post_construction", squareFt: 5000, bedrooms: 6, bathrooms: 5, condition: "post_construction", addOns: ["windows", "carpet", "disinfection", "laundry", "oven", "fridge", "extras"], frequency: "weekly", suppliesIncluded: true },
    limit: { serviceType: "standard", squareFt: 300, bedrooms: 1, bathrooms: 1, condition: "light", addOns: [], frequency: "monthly", suppliesIncluded: false },
  },
  concrete: {
    fn: "runConcreteEngine",
    normal: { lengthFt: 20, widthFt: 20, thicknessIn: 4, wastePercent: 10, mixStrength: "3000psi", reinforced: true, formworkIncluded: true, pumpRequired: false },
    complex: { lengthFt: 60, widthFt: 40, thicknessIn: 8, wastePercent: 15, mixStrength: "4000psi", reinforced: true, formworkIncluded: true, pumpRequired: true },
    limit: { lengthFt: 4, widthFt: 4, thicknessIn: 2, wastePercent: 0, mixStrength: "2500psi", reinforced: false, formworkIncluded: false, pumpRequired: false },
  },
  deck: {
    fn: "calculateDeck",
    normal: { deckLengthFt: 16, deckWidthFt: 12, materialType: "pressure-treated", joistSpacingIn: 16, postCount: 6, railingLinearFt: 30, stairsCount: 1, demoExisting: false, stainSeal: true, pergola: false, attachedToHouse: true },
    complex: { deckLengthFt: 40, deckWidthFt: 24, materialType: "ipe", joistSpacingIn: 12, postCount: 20, railingLinearFt: 120, stairsCount: 3, demoExisting: true, stainSeal: true, pergola: true, attachedToHouse: true },
    limit: { deckLengthFt: 6, deckWidthFt: 6, materialType: "cedar", joistSpacingIn: 24, postCount: 4, railingLinearFt: 0, stairsCount: 0, demoExisting: false, stainSeal: false, pergola: false, attachedToHouse: false },
  },
  demolition: {
    fn: "calculateDemolition",
    normal: { areaSqft: 300, demolitionType: "drywall", difficulty: "standard", hazardousMaterialSuspected: false, utilitiesPresent: false, structuralElementsPresent: false, asbestosTestRequired: false, crewSize: 2 },
    complex: { areaSqft: 2500, demolitionType: "full-interior", difficulty: "critical", hazardousMaterialSuspected: true, utilitiesPresent: true, structuralElementsPresent: true, asbestosTestRequired: true, crewSize: 6 },
    limit: { areaSqft: 20, demolitionType: "selective", difficulty: "basic", hazardousMaterialSuspected: false, utilitiesPresent: false, structuralElementsPresent: false, asbestosTestRequired: false, crewSize: 1 },
  },
  drywall: {
    fn: "calculateDrywall",
    normal: { wallAreaSqft: 400, ceilingAreaSqft: 0, panelType: "regular", panelSize: "4x8", finishLevel: 4, includeCeiling: false, repairMode: false, textureMatch: false },
    complex: { wallAreaSqft: 2400, ceilingAreaSqft: 800, panelType: "fire-rated", panelSize: "4x12", finishLevel: 5, includeCeiling: true, repairMode: false, textureMatch: true },
    limit: { wallAreaSqft: 10, ceilingAreaSqft: 0, panelType: "moisture-resistant", panelSize: "4x8", finishLevel: 0, includeCeiling: false, repairMode: true, textureMatch: false },
  },
  electrical: {
    fn: "runElectricalEngine",
    normal: { watts: 2400, voltage: 120, powerFactor: 1, phase: 1, isContinuous: false, runFeet: 60, numCircuits: 2, panelUpgrade: false, outdoorWork: false },
    complex: { watts: 24000, voltage: 240, powerFactor: 0.9, phase: 3, isContinuous: true, runFeet: 300, numCircuits: 12, panelUpgrade: true, outdoorWork: true },
    limit: { watts: 100, voltage: 120, powerFactor: 0.8, phase: 1, isContinuous: false, runFeet: 5, numCircuits: 1, panelUpgrade: false, outdoorWork: false },
  },
  fencing: {
    fn: "calculateFencing",
    normal: { fenceLengthFt: 150, fenceHeightFt: 6, materialType: "wood", postSpacingFt: 8, gateCount: 1, demoExisting: false, stainSeal: true, terrainType: "flat", propertyLineVerified: true },
    complex: { fenceLengthFt: 600, fenceHeightFt: 8, materialType: "aluminum", postSpacingFt: 6, gateCount: 4, demoExisting: true, stainSeal: false, terrainType: "rocky", propertyLineVerified: false },
    limit: { fenceLengthFt: 10, fenceHeightFt: 3, materialType: "chain-link", postSpacingFt: 10, gateCount: 0, demoExisting: false, stainSeal: false, terrainType: "flat", propertyLineVerified: true },
  },
  flooring: {
    fn: "calculateFlooring",
    normal: { lengthFt: 20, widthFt: 15, flooringType: "laminate", pattern: "straight", includeUnderlayment: true, removeOldFloor: false, floorPrepLevel: "minor", moistureBarrier: false, transitionStrips: 2 },
    complex: { lengthFt: 50, widthFt: 40, flooringType: "hardwood", pattern: "herringbone", includeUnderlayment: true, removeOldFloor: true, floorPrepLevel: "major", moistureBarrier: true, transitionStrips: 8 },
    limit: { lengthFt: 4, widthFt: 4, flooringType: "vinyl", pattern: "straight", includeUnderlayment: false, removeOldFloor: false, floorPrepLevel: "none", moistureBarrier: false, transitionStrips: 0 },
  },
  hvac: {
    fn: "calculateHvac",
    normal: { tonnage: 3, systemType: "central-ac", seerRating: 16, ductworkScope: "partial", ductRunFeet: 40, zoneCount: 1, atticInstall: false, crawlspaceInstall: false, existingEquipmentAge: 12, refrigerantType: "R-410A", thermostatUpgrade: true, airQualityUpgrade: false },
    complex: { tonnage: 5, systemType: "heat-pump", seerRating: 22, ductworkScope: "new-install", ductRunFeet: 200, zoneCount: 4, atticInstall: true, crawlspaceInstall: true, existingEquipmentAge: 25, refrigerantType: "R-454B", thermostatUpgrade: true, airQualityUpgrade: true },
    limit: { tonnage: 1, systemType: "mini-split", seerRating: 14, ductworkScope: "none", ductRunFeet: 0, zoneCount: 1, atticInstall: false, crawlspaceInstall: false, existingEquipmentAge: 0, refrigerantType: "R-32", thermostatUpgrade: false, airQualityUpgrade: false },
  },
  insulation: {
    fn: "calculateInsulation",
    normal: { areaSqft: 1000, insulationType: "blown-in", targetRValue: 38, accessType: "attic", existingInsulation: false, removeExisting: false, airSealing: true, vaporBarrier: false },
    complex: { areaSqft: 4000, insulationType: "spray-foam", targetRValue: 49, accessType: "crawlspace", existingInsulation: true, removeExisting: true, airSealing: true, vaporBarrier: true },
    limit: { areaSqft: 50, insulationType: "batts", targetRValue: 13, accessType: "garage", existingInsulation: false, removeExisting: false, airSealing: false, vaporBarrier: false },
  },
  kitchen: {
    fn: "calculateKitchenRemodel",
    normal: { scope: "cabinet_update", kitchenSize: "medium", appliances: "basic_appliances", materialQuality: "standard", plumbingElectrical: "minor", clientProvidesMaterials: false },
    complex: { scope: "full_remodel", kitchenSize: "extra_large", appliances: "premium_appliances", materialQuality: "premium", plumbingElectrical: "relocate", cabinetLinearFt: 60, clientProvidesMaterials: false },
    limit: { scope: "countertops", kitchenSize: "small", appliances: "no_appliances", materialQuality: "budget", plumbingElectrical: "no", clientProvidesMaterials: true },
  },
  labor: {
    fn: "calculateLabor",
    normal: { projectName: "T-004", dailyWorkType: "build", crewSize: 4, shiftHours: 8, taskCount: 10, materialMoves: 5, cleanupHours: 1, travelMinutes: 30, safetyChecks: 2, weatherRisk: "low", incidentCount: 0 },
    complex: { projectName: "T-004", dailyWorkType: "multi", crewSize: 15, shiftHours: 12, taskCount: 60, materialMoves: 40, cleanupHours: 4, travelMinutes: 120, safetyChecks: 10, weatherRisk: "high", incidentCount: 3 },
    limit: { projectName: "T-004", dailyWorkType: "service", crewSize: 1, shiftHours: 1, taskCount: 1, materialMoves: 0, cleanupHours: 0, travelMinutes: 0, safetyChecks: 0, weatherRisk: "low", incidentCount: 0 },
  },
  landscaping: {
    fn: "calculateLandscaping",
    normal: { landscapeAreaSqft: 2000, sodAreaSqft: 800, mulchYards: 4, plantCount: 20, irrigationLinesFt: 100, drainageType: "swale", soilType: "loam", demoExisting: false, hardscapeSqft: 100, gradingIncluded: true },
    complex: { landscapeAreaSqft: 5000, sodAreaSqft: 3000, mulchYards: 12, plantCount: 80, irrigationLinesFt: 500, drainageType: "french-drain", soilType: "clay", demoExisting: true, hardscapeSqft: 800, gradingIncluded: true },
    limit: { landscapeAreaSqft: 200, sodAreaSqft: 0, mulchYards: 0, plantCount: 0, irrigationLinesFt: 0, drainageType: "none", soilType: "sand", demoExisting: false, hardscapeSqft: 0, gradingIncluded: false },
  },
  masonry: {
    fn: "calculateMasonry",
    normal: { wallLengthFt: 40, wallHeightFt: 6, unitType: "block-8", wastePercent: 0.1, exteriorWork: true, reinforced: true, groutFill: false, waterproofCoating: false, footingIncluded: true },
    complex: { wallLengthFt: 200, wallHeightFt: 12, unitType: "stone-veneer", wastePercent: 0.15, exteriorWork: true, reinforced: true, groutFill: true, waterproofCoating: true, footingIncluded: true },
    limit: { wallLengthFt: 4, wallHeightFt: 2, unitType: "brick", wastePercent: 0, exteriorWork: false, reinforced: false, groutFill: false, waterproofCoating: false, footingIncluded: false },
  },
  painting: {
    fn: "calculatePainting",
    normal: { roomLengthFt: 14, roomWidthFt: 12, wallHeightFt: 8, doors: 2, windows: 2, coats: 2, surfaceType: "smooth", includeCeiling: false, includePrimer: true, paintQuality: "standard" },
    complex: { roomLengthFt: 30, roomWidthFt: 20, wallHeightFt: 12, doors: 6, windows: 8, coats: 3, surfaceType: "textured", includeCeiling: true, includePrimer: true, paintQuality: "premium" },
    limit: { roomLengthFt: 6, roomWidthFt: 6, wallHeightFt: 7, doors: 0, windows: 0, coats: 1, surfaceType: "smooth", includeCeiling: false, includePrimer: false, paintQuality: "economy" },
  },
  plumbing: {
    fn: "calculatePlumbing",
    normal: { scope: "fixture-service", fixtureCount: 3, pipeType: "pex", supplyLineFeet: 40, drainLineFeet: 20, waterHeaterReplace: false, waterHeaterType: "tank-gas", waterHeaterGallons: 40, slabAccess: false, crawlspaceAccess: false, gasWork: false, outdoorWork: false, backflowPreventer: false, existingPipeCondition: "good" },
    complex: { scope: "full-repipe", fixtureCount: 12, pipeType: "copper", supplyLineFeet: 300, drainLineFeet: 150, waterHeaterReplace: true, waterHeaterType: "tankless-gas", waterHeaterGallons: 80, slabAccess: true, crawlspaceAccess: true, gasWork: true, outdoorWork: true, backflowPreventer: true, existingPipeCondition: "poor" },
    limit: { scope: "fixture-service", fixtureCount: 1, pipeType: "pex", supplyLineFeet: 5, drainLineFeet: 0, waterHeaterReplace: false, waterHeaterType: "tank-electric", waterHeaterGallons: 40, slabAccess: false, crawlspaceAccess: false, gasWork: false, outdoorWork: false, backflowPreventer: false, existingPipeCondition: "unknown" },
  },
  "project-manager": {
    fn: "calculateProjectManager",
    normal: { projectName: "T-004", projectType: "remodel", budget: 50000, projectedDurationDays: 45, crewSize: 5, activeTrades: 3, openTasks: 20, inspectionsDue: 2, changeOrders: 1, clientMeetingsPerWeek: 1, weatherRisk: "low", permitRequired: true, safetyIssues: 0 },
    complex: { projectName: "T-004", projectType: "multitrade", budget: 1500000, projectedDurationDays: 365, crewSize: 20, activeTrades: 12, openTasks: 300, inspectionsDue: 15, changeOrders: 20, clientMeetingsPerWeek: 4, weatherRisk: "high", permitRequired: true, safetyIssues: 8 },
    limit: { projectName: "T-004", projectType: "service", budget: 500, projectedDurationDays: 1, crewSize: 1, activeTrades: 1, openTasks: 1, inspectionsDue: 0, changeOrders: 0, clientMeetingsPerWeek: 0, weatherRisk: "low", permitRequired: false, safetyIssues: 0 },
  },
  roofing: {
    fn: "calculateRoofing",
    normal: { roofAreaSqFt: 2000, pitch: 6, shingleType: "architectural", removeOldRoof: true, layers: 1, underlayment: true, iceBarrier: false, vents: 4, skylightCount: 0, flashingReplace: true, deckCondition: "good", guttersIncluded: false, warrantyYears: 30 },
    complex: { roofAreaSqFt: 6000, pitch: 12, shingleType: "tile", removeOldRoof: true, layers: 2, underlayment: true, iceBarrier: true, vents: 12, skylightCount: 3, flashingReplace: true, deckCondition: "poor", guttersIncluded: true, warrantyYears: 50 },
    limit: { roofAreaSqFt: 200, pitch: 2, shingleType: "3-tab", removeOldRoof: false, layers: 1, underlayment: false, iceBarrier: false, vents: 0, skylightCount: 0, flashingReplace: false, deckCondition: "good", guttersIncluded: false, warrantyYears: 20 },
  },
  siding: {
    fn: "calculateSiding",
    normal: { wallSqFt: 1800, stories: 1, sidingType: "vinyl", removeOldSiding: true, windowCount: 10, doorCount: 2, corners: 4, visibleWaterDamage: false, houseWrapIncluded: true, flashingCondition: "good", soffitFasciaIncluded: false, clientProvidesMaterials: false },
    complex: { wallSqFt: 4500, stories: 3, sidingType: "fiber_cement", removeOldSiding: true, windowCount: 28, doorCount: 5, corners: 12, visibleWaterDamage: true, houseWrapIncluded: true, flashingCondition: "poor", soffitFasciaIncluded: true, clientProvidesMaterials: false },
    limit: { wallSqFt: 200, stories: 1, sidingType: "metal", removeOldSiding: false, windowCount: 0, doorCount: 0, corners: 0, visibleWaterDamage: false, houseWrapIncluded: false, flashingCondition: "unknown", soffitFasciaIncluded: false, clientProvidesMaterials: true },
  },
  solar: {
    fn: "calculateSolar",
    normal: { roofAreaSqft: 800, systemKw: 7, panelCount: 18, roofType: "shingle", roofCondition: "good", sunExposure: "high", batteryIncluded: false, batteryKwh: 0, inverterType: "string", electricalUpgradeNeeded: false, permitRequired: true, utilityInterconnect: true },
    complex: { roofAreaSqft: 2400, systemKw: 20, panelCount: 50, roofType: "tile", roofCondition: "poor", sunExposure: "low", batteryIncluded: true, batteryKwh: 40, inverterType: "micro", electricalUpgradeNeeded: true, permitRequired: true, utilityInterconnect: true },
    limit: { roofAreaSqft: 200, systemKw: 2, panelCount: 5, roofType: "flat", roofCondition: "fair", sunExposure: "medium", batteryIncluded: false, batteryKwh: 0, inverterType: "power-optimizer", electricalUpgradeNeeded: false, permitRequired: false, utilityInterconnect: false },
  },
  tile: {
    fn: "calculateTile",
    normal: { lengthFt: 10, widthFt: 8, tileSizeIn: 12, pattern: "straight", areaType: "floor", waterproofing: false, demoExisting: true, substratePrep: "minor", groutType: "sanded", niche: false },
    complex: { lengthFt: 30, widthFt: 20, tileSizeIn: 24, pattern: "herringbone", areaType: "shower", waterproofing: true, demoExisting: true, substratePrep: "major", groutType: "epoxy", niche: true },
    limit: { lengthFt: 2, widthFt: 2, tileSizeIn: 4, pattern: "offset", areaType: "backsplash", waterproofing: false, demoExisting: false, substratePrep: "none", groutType: "standard", niche: false },
  },
  "windows-doors": {
    fn: "calculateWindowsDoors",
    normal: { windows: 6, doors: 2, installType: "replacement", windowCostEach: 350, doorCostEach: 600, windowSizeSqFt: 12, exteriorWork: true, flashingRequired: true, trimIncluded: true, insulationFoam: true, roughOpeningRepair: false },
    complex: { windows: 30, doors: 8, installType: "new-construction", windowCostEach: 1200, doorCostEach: 2500, windowSizeSqFt: 25, exteriorWork: true, flashingRequired: true, trimIncluded: true, insulationFoam: true, roughOpeningRepair: true },
    limit: { windows: 1, doors: 0, installType: "replacement", windowCostEach: 100, doorCostEach: 0, windowSizeSqFt: 4, exteriorWork: false, flashingRequired: false, trimIncluded: false, insulationFoam: false, roughOpeningRepair: false },
  },
};

export const SCENARIOS: Scenario[] = Object.entries(ENGINES).flatMap(([trade, t]) =>
  (["normal", "complex", "limit"] as const).map((kind) => ({
    trade,
    fn: t.fn,
    kind,
    input: { ...t[kind], mode },
  })),
);
