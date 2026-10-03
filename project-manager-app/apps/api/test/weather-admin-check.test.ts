import test from "node:test";
import assert from "node:assert/strict";
import { WeatherController } from "../dist/modules/weather/weather.controller.js";

// C51: POST /v1/admin/weather/check procesa todos los proyectos activos de todos los tenants.
// `weather:write` lo tienen también CLIENT y PRO, así que el controller exige la identidad
// interna del worker (OPS_ADMIN + EVENT_CONSUMER) y falla cerrado antes de llamar al servicio.

let globalChecks = 0;
const weather = {
  checkAllActiveProjectsWeather: async () => {
    globalChecks += 1;
    return { checked: 3, alertsCreated: 1 };
  },
};
const controller = new (WeatherController as any)(weather, {});
const req = (roles: string[]) => ({ headers: {}, authContext: { tenantId: "t1", orgId: "org_x", userId: "u1", roles } });
const run = async (roles: string[]) => {
  try {
    await controller.checkAllProjects(req(roles));
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};

test("CLIENT, PRO, WORKER ⇒ 403 y el chequeo global NO se ejecuta", async () => {
  globalChecks = 0;
  for (const roles of [["CLIENT"], ["PRO"], ["WORKER"], []]) {
    assert.equal(await run(roles), 403, `roles=${roles.join(",") || "(ninguno)"}`);
  }
  assert.equal(globalChecks, 0);
});

test("OPS_ADMIN humano (sin EVENT_CONSUMER) ⇒ 403; EVENT_CONSUMER sin OPS_ADMIN ⇒ 403", async () => {
  globalChecks = 0;
  assert.equal(await run(["OPS_ADMIN"]), 403);
  assert.equal(await run(["OPS_ADMIN", "WORKER"]), 403);
  assert.equal(await run(["EVENT_CONSUMER"]), 403);
  assert.equal(await run(["EVENT_CONSUMER", "WORKER"]), 403);
  assert.equal(globalChecks, 0);
});

test("identidad del worker (OPS_ADMIN + EVENT_CONSUMER [+ WORKER]) ⇒ 200 y el servicio se llama una sola vez por petición", async () => {
  globalChecks = 0;
  assert.equal(await run(["OPS_ADMIN", "EVENT_CONSUMER"]), 200);
  assert.equal(globalChecks, 1);
  assert.equal(await run(["OPS_ADMIN", "WORKER", "EVENT_CONSUMER"]), 200);
  assert.equal(globalChecks, 2);
});

test("la ruta conserva @RequirePermissions('weather:write') (el fail-closed se suma, no lo reemplaza)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/modules/weather/weather.controller.ts", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("v1/admin/weather/check"));
  assert.match(block, /@RequirePermissions\('weather:write'\)/);
  assert.match(block, /EVENT_CONSUMER/);
});
