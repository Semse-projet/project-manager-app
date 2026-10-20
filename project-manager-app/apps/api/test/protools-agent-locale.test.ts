import test from "node:test";
import assert from "node:assert/strict";
import { ProToolsAgent } from "../dist/modules/semse-agents/protools.agent.js";

function agent() {
  const bus = {
    register() {},
  };
  return new ProToolsAgent(bus as never);
}

test("ProTools estimate localizes static payload fields to English when locale=en", async () => {
  const result = await agent().estimate({
    trade: "electrical",
    description: "Install a circuit",
    area: 100,
    rooms: 2,
    locale: "en",
  });

  assert.equal(result.materials[0]?.item, "12/2 NM-B cable");
  assert.equal(result.materials[0]?.unit, "ft");
  assert.ok(result.checklist.includes("Verify panel voltage and capacity"));
  assert.ok(result.riskFlags.includes("Verify whether an electrical permit is required"));
  assert.match(result.agentNote, /Does not replace local inspection or required licensing/);
  assert.doesNotMatch(result.agentNote, /No reemplaza/);
});

test("ProTools estimate defaults to Spanish for absent or unsupported locale", async () => {
  const result = await agent().estimate({
    trade: "electrical",
    description: "Instalar circuito",
    area: 100,
    rooms: 2,
  });

  assert.equal(result.materials[0]?.item, "Cable NM-B 12/2");
  assert.equal(result.materials[0]?.unit, "pies");
  assert.ok(result.checklist.includes("Verificar voltaje y capacidad del panel"));
  assert.ok(result.riskFlags.includes("Verificar permiso eléctrico requerido"));
  assert.match(result.agentNote, /No reemplaza inspección local ni licencias requeridas/);
});
