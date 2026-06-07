import { material, materialTotal } from "./cost-engine.js";
import type { MaterialItem } from "./types.js";

export { material, materialTotal };

export function makeMaterial(
  name: string,
  quantity: number,
  unit: string,
  unitCost: number,
  category: string,
  notes?: string
): MaterialItem {
  return material(name, quantity, unit, unitCost, category, notes);
}

export function scaleMaterials(items: MaterialItem[], factor: number): MaterialItem[] {
  return items.map((item) =>
    material(
      item.name,
      item.quantity * factor,
      item.unit,
      item.unitCost,
      item.category,
      item.notes,
    )
  );
}
