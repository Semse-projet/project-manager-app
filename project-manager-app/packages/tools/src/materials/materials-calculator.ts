export type MaterialsCategory = "painting" | "drywall" | "flooring" | "concrete" | "lumber" | "mulch";

export interface MaterialQuantity {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface MaterialsEstimate {
  category: MaterialsCategory;
  summary: {
    areaSqFt?: number;
    volumeCuFt?: number;
    volumeCuYd?: number;
    perimeterFt?: number;
    wallAreaSqFt?: number;
    floorAreaSqFt?: number;
  };
  items: MaterialQuantity[];
  wasteFactor: number;
  notes: string[];
}

export interface MaterialsPaintingInput {
  category: "painting";
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  doors?: number;
  windows?: number;
  doorSqFt?: number;
  windowSqFt?: number;
  coats?: number;
}

export interface MaterialsDrywallInput {
  category: "drywall";
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  includeCeiling?: boolean;
  wasteFactor?: number;
}

export interface MaterialsFlooringInput {
  category: "flooring";
  lengthFt: number;
  widthFt: number;
  installation?: "straight" | "diagonal" | "irregular";
}

export interface MaterialsConcreteInput {
  category: "concrete";
  lengthFt: number;
  widthFt: number;
  depthInches: number;
}

export interface MaterialsLumberInput {
  category: "lumber";
  lengthFt: number;
  widthFt?: number;
  corners?: number;
  openings?: number;
}

export interface MaterialsMulchInput {
  category: "mulch";
  lengthFt: number;
  widthFt: number;
  depthInches: 2 | 3 | 4;
}

export type MaterialsInput =
  | MaterialsPaintingInput
  | MaterialsDrywallInput
  | MaterialsFlooringInput
  | MaterialsConcreteInput
  | MaterialsLumberInput
  | MaterialsMulchInput;

export class MaterialsCalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialsCalculatorError";
  }
}

const INSTALLATION_WASTE: Record<NonNullable<MaterialsFlooringInput["installation"]>, number> = {
  straight: 0.10,
  diagonal: 0.15,
  irregular: 0.175,
};

const MULCH_COVERAGE: Record<MaterialsMulchInput["depthInches"], number> = {
  2: 162,
  3: 108,
  4: 81,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function requirePositive(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new MaterialsCalculatorError(`${label} debe ser un número mayor a 0`);
  }
  return n;
}

function requireNonNegativeInt(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new MaterialsCalculatorError(`${label} debe ser un entero >= 0`);
  }
  return n;
}

function requireNonNegativeNumber(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new MaterialsCalculatorError(`${label} debe ser un número >= 0`);
  }
  return n;
}

function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value === "string" && allowed.includes(value as T)) {
    return value as T;
  }
  throw new MaterialsCalculatorError(`${label} debe ser uno de: ${allowed.join(", ")}`);
}

function normalizeInput(raw: unknown): MaterialsInput {
  if (!raw || typeof raw !== "object") {
    throw new MaterialsCalculatorError("El input debe ser un objeto");
  }
  const input = raw as Record<string, unknown>;
  const category = requireOneOf(input.category, ["painting", "drywall", "flooring", "concrete", "lumber", "mulch"], "category");
  const lengthFt = requirePositive(input.lengthFt, "lengthFt");

  switch (category) {
    case "painting":
      return {
        category,
        lengthFt,
        widthFt: requirePositive(input.widthFt, "widthFt"),
        heightFt: requirePositive(input.heightFt, "heightFt"),
        doors: input.doors === undefined ? 0 : requireNonNegativeInt(input.doors, "doors"),
        windows: input.windows === undefined ? 0 : requireNonNegativeInt(input.windows, "windows"),
        doorSqFt: input.doorSqFt === undefined ? 21 : requirePositive(input.doorSqFt, "doorSqFt"),
        windowSqFt: input.windowSqFt === undefined ? 7 : requirePositive(input.windowSqFt, "windowSqFt"),
        coats: input.coats === undefined ? 2 : (requireNonNegativeInt(input.coats, "coats") || 1),
      };
    case "drywall":
      return {
        category,
        lengthFt,
        widthFt: requirePositive(input.widthFt, "widthFt"),
        heightFt: requirePositive(input.heightFt, "heightFt"),
        includeCeiling: input.includeCeiling === true,
        wasteFactor: input.wasteFactor === undefined ? 0.15 : requireNonNegativeNumber(input.wasteFactor, "wasteFactor"),
      };
    case "flooring":
      return {
        category,
        lengthFt,
        widthFt: requirePositive(input.widthFt, "widthFt"),
        installation: requireOneOf(input.installation ?? "straight", ["straight", "diagonal", "irregular"] as const, "installation"),
      };
    case "concrete":
      return {
        category,
        lengthFt,
        widthFt: requirePositive(input.widthFt, "widthFt"),
        depthInches: requirePositive(input.depthInches, "depthInches"),
      };
    case "lumber":
      return {
        category,
        lengthFt,
        widthFt: input.widthFt === undefined ? undefined : requirePositive(input.widthFt, "widthFt"),
        corners: input.corners === undefined ? 1 : requireNonNegativeInt(input.corners, "corners"),
        openings: input.openings === undefined ? 0 : requireNonNegativeInt(input.openings, "openings"),
      };
    case "mulch": {
      const depthInches = requirePositive(input.depthInches, "depthInches");
      if (![2, 3, 4].includes(depthInches as 2 | 3 | 4)) {
        throw new MaterialsCalculatorError("depthInches debe ser 2, 3 o 4");
      }
      return {
        category,
        lengthFt,
        widthFt: requirePositive(input.widthFt, "widthFt"),
        depthInches: depthInches as 2 | 3 | 4,
      };
    }
    default:
      throw new MaterialsCalculatorError(`Categoría no soportada: ${category}`);
  }
}

function estimatePainting(input: MaterialsPaintingInput): MaterialsEstimate {
  const doorSqFt = input.doorSqFt ?? 21;
  const windowSqFt = input.windowSqFt ?? 7;
  const coats = input.coats ?? 2;
  const doors = input.doors ?? 0;
  const windows = input.windows ?? 0;

  const perimeterFt = 2 * (input.lengthFt + input.widthFt);
  const wallAreaSqFt = perimeterFt * input.heightFt;
  const openingsSqFt = doors * doorSqFt + windows * windowSqFt;
  const paintableArea = Math.max(0, wallAreaSqFt - openingsSqFt);
  const gallons = Math.max(1, Math.ceil((paintableArea * coats) / 350 * 1.10));
  const notes: string[] = [
    `Área pintable: ${paintableArea.toFixed(1)} sqft (${coats} capa(s), ${openingsSqFt} sqft de aberturas)`,
    `Cobertura base: 350 sqft/gal por capa + 10% desperdicio`,
  ];

  if (doors === 0 && windows === 0) {
    notes.push("No se descontaron aberturas; ajustar si hay puertas/ventanas.");
  }

  return {
    category: "painting",
    summary: { areaSqFt: paintableArea, perimeterFt, wallAreaSqFt },
    items: [{ name: "Pintura", quantity: gallons, unit: "gal", notes: `Para ${coats} capa(s)` }],
    wasteFactor: 0.10,
    notes,
  };
}

function estimateDrywall(input: MaterialsDrywallInput): MaterialsEstimate {
  const perimeterFt = 2 * (input.lengthFt + input.widthFt);
  const wallAreaSqFt = perimeterFt * input.heightFt;
  const ceilingAreaSqFt = input.includeCeiling ? input.lengthFt * input.widthFt : 0;
  const totalArea = wallAreaSqFt + ceilingAreaSqFt;
  const wasteFactor = input.wasteFactor ?? 0.15;
  const sheets = Math.max(1, Math.ceil((totalArea / 32) * (1 + wasteFactor)));
  const nailsLb = Math.max(1, Math.ceil(totalArea / 500));
  const compoundBoxes = Math.max(1, Math.ceil(totalArea / 225));
  const tapeRolls = Math.max(1, Math.ceil(totalArea / 500));

  return {
    category: "drywall",
    summary: { areaSqFt: totalArea, perimeterFt, wallAreaSqFt, floorAreaSqFt: ceilingAreaSqFt },
    items: [
      { name: "Hojas de drywall 4x8", quantity: sheets, unit: "sheet" },
      { name: "Clavos/tornillos", quantity: nailsLb, unit: "lb", notes: "1 lb por cada 500 sqft" },
      { name: "Joint compound", quantity: compoundBoxes, unit: "box", notes: "1 box por cada ~225 sqft" },
      { name: "Cinta para juntas", quantity: tapeRolls, unit: "roll", notes: "1 rollo por cada 500 sqft" },
    ],
    wasteFactor,
    notes: [
      `Área total: ${totalArea.toFixed(1)} sqft${input.includeCeiling ? " (incluye techo)" : ""}`,
      `Desperdicio aplicado: ${(wasteFactor * 100).toFixed(0)}%`,
    ],
  };
}

function estimateFlooring(input: MaterialsFlooringInput): MaterialsEstimate {
  const floorArea = input.lengthFt * input.widthFt;
  const installation = input.installation ?? "straight";
  const wasteFactor = INSTALLATION_WASTE[installation];
  const totalArea = Math.ceil(floorArea * (1 + wasteFactor));
  const adhesiveBags = Math.max(1, Math.ceil(totalArea / 62.5));

  return {
    category: "flooring",
    summary: { floorAreaSqFt: floorArea, areaSqFt: totalArea },
    items: [
      { name: "Piso", quantity: totalArea, unit: "sqft", notes: `Instalación ${installation}` },
      { name: "Adhesivo/grout", quantity: adhesiveBags, unit: "bag", notes: "1 saco por cada 50-75 sqft" },
    ],
    wasteFactor,
    notes: [
      `Área base: ${floorArea.toFixed(1)} sqft`,
      `Desperdicio por instalación ${installation}: ${(wasteFactor * 100).toFixed(1)}%`,
    ],
  };
}

function estimateConcrete(input: MaterialsConcreteInput): MaterialsEstimate {
  const volumeCuFt = input.lengthFt * input.widthFt * (input.depthInches / 12);
  const cubicYardsRaw = volumeCuFt / 27;
  const withWaste = cubicYardsRaw * 1.10;
  const orderCuYd = Math.max(0.1, round1(withWaste));

  return {
    category: "concrete",
    summary: { volumeCuFt, volumeCuYd: orderCuYd },
    items: [{ name: "Concreto", quantity: orderCuYd, unit: "yd³", notes: `Volumen neto ${cubicYardsRaw.toFixed(2)} yd³ + 10% extra` }],
    wasteFactor: 0.10,
    notes: [
      `Volumen neto: ${volumeCuFt.toFixed(1)} ft³ = ${cubicYardsRaw.toFixed(2)} yd³`,
      "Pedido redondeado a 1 decimal con 10% de extra",
    ],
  };
}

function estimateLumber(input: MaterialsLumberInput): MaterialsEstimate {
  // 16" on-center is the US framing standard (1 stud every 16" = 1.333 ft).
  // Was 1.5 ft (18" spacing) — non-standard and under-counts studs vs. code.
  const studs = Math.max(0, Math.ceil(input.lengthFt / 1.333)) + 3 * ((input.corners ?? 1) + (input.openings ?? 0));
  const items: MaterialQuantity[] = [{ name: "Studs 2x4x8", quantity: studs, unit: "stud", notes: "1 stud cada 1.333 ft (16\" o.c.) + 3 por esquina/apertura" }];

  if (input.widthFt) {
    const area = input.lengthFt * input.widthFt;
    const sheets = Math.max(1, Math.ceil((area / 32) * 1.10));
    items.push({ name: "Plywood subfloor 4x8", quantity: sheets, unit: "sheet", notes: "1 hoja por cada 32 sqft + 10%" });
  }

  return {
    category: "lumber",
    summary: { floorAreaSqFt: input.widthFt ? input.lengthFt * input.widthFt : undefined, perimeterFt: input.lengthFt },
    items,
    wasteFactor: input.widthFt ? 0.10 : 0,
    notes: [
      `Muro de ${input.lengthFt} ft`,
      `Esquinas: ${input.corners ?? 1}, Aperturas: ${input.openings ?? 0}`,
    ],
  };
}

function estimateMulch(input: MaterialsMulchInput): MaterialsEstimate {
  const area = input.lengthFt * input.widthFt;
  const coverage = MULCH_COVERAGE[input.depthInches];
  const cuYdRaw = area / coverage;
  const withWaste = cuYdRaw * 1.10;
  const orderCuYd = Math.max(0.1, round1(Math.ceil(withWaste * 10) / 10));

  return {
    category: "mulch",
    summary: { areaSqFt: area, volumeCuYd: orderCuYd },
    items: [{ name: "Mulch", quantity: orderCuYd, unit: "yd³", notes: `${input.depthInches}" de profundidad, cobertura ${coverage} sqft/yd³` }],
    wasteFactor: 0.10,
    notes: [
      `Área: ${area.toFixed(1)} sqft`,
      `Profundidad: ${input.depthInches}", cobertura aproximada ${coverage} sqft/yd³`,
    ],
  };
}

export function calculateMaterials(input: unknown): MaterialsEstimate {
  const normalized = normalizeInput(input);

  switch (normalized.category) {
    case "painting":
      return estimatePainting(normalized);
    case "drywall":
      return estimateDrywall(normalized);
    case "flooring":
      return estimateFlooring(normalized);
    case "concrete":
      return estimateConcrete(normalized);
    case "lumber":
      return estimateLumber(normalized);
    case "mulch":
      return estimateMulch(normalized);
    default:
      throw new MaterialsCalculatorError(`Categoría no soportada: ${(normalized as MaterialsInput).category}`);
  }
}
