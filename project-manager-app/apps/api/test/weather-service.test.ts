import test from "node:test";
import assert from "node:assert/strict";
import { WeatherService } from "../dist/modules/weather/weather.service.js";

function decimal(n: number) {
  return { toNumber: () => n };
}

function makeFakePrisma(input: { latitude?: number | null; longitude?: number | null } = {}) {
  const upserts: unknown[] = [];
  const prisma = {
    project: {
      async findUniqueOrThrow() {
        return {
          id: "proj_1",
          job: {
            latitude: input.latitude === undefined ? decimal(37.7749) : input.latitude === null ? null : decimal(input.latitude),
            longitude: input.longitude === undefined ? decimal(-122.4194) : input.longitude === null ? null : decimal(input.longitude),
          },
        };
      },
      async findMany() {
        return [{ id: "proj_1" }];
      },
      async count() {
        return 1;
      },
    },
    weatherAlert: {
      async upsert(args: { create: Record<string, unknown> }) {
        const row = { id: `alert_${upserts.length + 1}`, ...args.create };
        upserts.push(row);
        return row;
      },
      async findMany() {
        return upserts;
      },
    },
  };
  return { prisma, getUpserts: () => upserts };
}

function makeFakeWeatherClient(hourly: Array<Record<string, unknown>>) {
  return {
    async getWeatherForecast() {
      return { hourly, daily: [], fetchedAt: new Date() };
    },
  };
}

test("checkProjectWeather refuses to guess coordinates when job has none", async () => {
  const { prisma } = makeFakePrisma({ latitude: null });
  const service = new WeatherService(prisma as never, makeFakeWeatherClient([]) as never);

  await assert.rejects(() => service.checkProjectWeather("proj_1"), /latitude\/longitude/);
});

test("checkProjectWeather creates a WeatherAlert per classified event, skipping clear intervals", async () => {
  const { prisma, getUpserts } = makeFakePrisma();
  const client = makeFakeWeatherClient([
    { temperature: 20, precipitation: 0, precipitationType: "none", windSpeed: 5, uvIndex: 1, weatherCode: "clear", timestamp: new Date(Date.now() + 3600_000).toISOString() },
    { temperature: 20, precipitation: 20, precipitationType: "rain", windSpeed: 5, uvIndex: 1, weatherCode: "rainy", timestamp: new Date(Date.now() + 2 * 3600_000).toISOString() },
  ]);
  const service = new WeatherService(prisma as never, client as never);

  const alerts = await service.checkProjectWeather("proj_1");

  assert.equal(alerts.length, 1);
  assert.equal(getUpserts().length, 1);
  const created = getUpserts()[0] as { eventType: string; severity: string; affectedTrades: string[] };
  assert.equal(created.eventType, "RAIN");
  assert.equal(created.severity, "HIGH");
  assert.ok(created.affectedTrades.includes("roofing"));
});

test("checkProjectWeather marks a near-term interval IMMINENT and a distant one FORECAST", async () => {
  const { prisma, getUpserts } = makeFakePrisma();
  const client = makeFakeWeatherClient([
    { temperature: 0, precipitation: 0, precipitationType: "none", windSpeed: 5, uvIndex: 1, weatherCode: "cold", timestamp: new Date(Date.now() + 3600_000).toISOString() },
    { temperature: 0, precipitation: 0, precipitationType: "none", windSpeed: 5, uvIndex: 1, weatherCode: "cold", timestamp: new Date(Date.now() + 48 * 3600_000).toISOString() },
  ]);
  const service = new WeatherService(prisma as never, client as never);

  await service.checkProjectWeather("proj_1");

  const statuses = getUpserts().map((u) => (u as { status: string }).status);
  assert.deepEqual(statuses.sort(), ["FORECAST", "IMMINENT"].sort());
});

test("checkAllActiveProjectsWeather checks each project independently and reports failures without throwing", async () => {
  const { prisma } = makeFakePrisma();
  const client = makeFakeWeatherClient([]);
  const service = new WeatherService(prisma as never, client as never);

  const result = await service.checkAllActiveProjectsWeather();

  assert.equal(result.checked, 1);
  assert.equal(result.failed, 0);
});
