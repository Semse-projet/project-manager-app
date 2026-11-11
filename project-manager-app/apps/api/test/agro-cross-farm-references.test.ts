import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { AgroProductionCycleService } from "../dist/modules/agro/agro-production-cycle.service.js";
import { AgroTraceabilityService } from "../dist/modules/agro/agro-traceability.service.js";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

// C51: al crear un ciclo de cultivo, una aplicación de insumo o un evento de trazabilidad, los ids de ciclo de
// producción y de parcela recibidos en el cuerpo no se validaban contra la finca. El dueño de la finca A podía
// colgar datos suyos de un ciclo de la finca B (que `getCycle` muestra, porque incluye `cropCycles` y
// `traceability`) o enlazar una parcela de B (cuyo nombre devuelve el listado de ciclos de cultivo).

const FARMS = { farm_a: "owner_a", farm_b: "owner_b" } as Record<string, string>;
const CYCLES = [{ id: "pc_a", farmId: "farm_a" }, { id: "pc_b", farmId: "farm_b" }];
const UNITS = [{ id: "fu_a", farmId: "farm_a" }, { id: "fu_b", farmId: "farm_b" }];
const CROPS = [{ id: "cc_a", farmId: "farm_a" }];

function build() {
  const writes: string[] = [];
  const byIdAndFarm = (rows: Array<{ id: string; farmId: string }>) => async ({ where }: { where: { id: string; farmId: string } }) =>
    rows.find((r) => r.id === where.id && r.farmId === where.farmId) ? { id: where.id } : null;
  const prisma = {
    agroProductionCycle: { findFirst: byIdAndFarm(CYCLES) },
    agroFarmUnit: { findFirst: byIdAndFarm(UNITS) },
    agroCropCycle: {
      findUnique: async ({ where }: { where: { id: string } }) => CROPS.find((c) => c.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => (writes.push("cropCycle"), { id: "cc_new", ...data }),
    },
    agroInputApplication: { create: async ({ data }: { data: Record<string, unknown> }) => (writes.push("input"), { id: "in_new", ...data }) },
    agroTraceabilityEvent: { create: async ({ data }: { data: Record<string, unknown> }) => (writes.push("trace"), { id: "ev_new", ...data }) },
  };
  const farmRepo = { findFarm: async (id: string) => (FARMS[id] ? { id, ownerId: FARMS[id] } : null) };
  return {
    cycles: new AgroProductionCycleService(prisma as never, farmRepo as never),
    trace: new AgroTraceabilityService(prisma as never, farmRepo as never),
    writes,
  };
}

const traceBody = (over: Record<string, unknown> = {}) => ({ entityType: "CROP", entityId: "x", eventType: "NOTE", description: "d", occurredAt: "2026-11-07T00:00:00Z", ...over });

test("crop cycle: ciclo y parcela de la propia finca (o sin referencias) se aceptan", async () => {
  for (const body of [{ cropName: "Maíz" }, { cropName: "Maíz", productionCycleId: "pc_a", fieldUnitId: "fu_a" }]) {
    const { cycles, writes } = build();
    await cycles.createCropCycle("farm_a", "owner_a", body);
    assert.deepEqual(writes, ["cropCycle"]);
  }
});

test("crop cycle: ciclo o parcela de otra finca ⇒ 404 sin escritura", async () => {
  for (const body of [{ cropName: "Maíz", productionCycleId: "pc_b" }, { cropName: "Maíz", fieldUnitId: "fu_b" }, { cropName: "Maíz", productionCycleId: "pc_inexistente" }]) {
    const { cycles, writes } = build();
    await assert.rejects(cycles.createCropCycle("farm_a", "owner_a", body), NotFoundException);
    assert.deepEqual(writes, []);
  }
});

test("input application: parcela de otra finca ⇒ 404 sin escritura; de la propia finca se acepta", async () => {
  const base = { inputType: "FERTILIZER", productName: "N", quantity: 1, unit: "KG", appliedAt: "2026-11-07T00:00:00Z" };
  {
    const { cycles, writes } = build();
    await assert.rejects(cycles.addInputApplication("cc_a", "owner_a", { ...base, fieldUnitId: "fu_b" }), NotFoundException);
    assert.deepEqual(writes, []);
  }
  {
    const { cycles, writes } = build();
    await cycles.addInputApplication("cc_a", "owner_a", { ...base, fieldUnitId: "fu_a" });
    assert.deepEqual(writes, ["input"]);
  }
});

test("traceability: ciclo de otra finca ⇒ 404 sin escritura; propio o sin ciclo se acepta", async () => {
  {
    const { trace, writes } = build();
    await assert.rejects(trace.createTraceabilityEvent("farm_a", "owner_a", traceBody({ productionCycleId: "pc_b" })), NotFoundException);
    assert.deepEqual(writes, []);
  }
  for (const body of [traceBody(), traceBody({ productionCycleId: "pc_a" })]) {
    const { trace, writes } = build();
    await trace.createTraceabilityEvent("farm_a", "owner_a", body);
    assert.deepEqual(writes, ["trace"]);
  }
});

test("la regla de dueño de la finca no cambia: otro usuario ⇒ 404", async () => {
  const { cycles, trace, writes } = build();
  await assert.rejects(cycles.createCropCycle("farm_a", "owner_b", { cropName: "Maíz" }), NotFoundException);
  await assert.rejects(trace.createTraceabilityEvent("farm_a", "owner_b", traceBody()), NotFoundException);
  assert.deepEqual(writes, []);
});
