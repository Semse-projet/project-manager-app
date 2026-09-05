import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  SatelliteWebhooksService,
  SATELLITE_WEBHOOK_EVENT_CATALOG,
} from "../dist/modules/satellites/satellite-webhooks.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// SAT-007 anillo 1 — SatelliteWebhooksService: registro, aislamiento entre
// satélites, revocación y contador de fallos consecutivos
// (docs/specs/satellites/SAT-007-outbound-webhooks.spec.md)
// ─────────────────────────────────────────────────────────────────────────────

type WebhookRow = {
  id: string;
  satelliteTokenId: string;
  url: string;
  events: string[];
  secretCiphertext: string;
  secretIv: string;
  secretTag: string;
  secretKeyVersion: number;
  status: string;
  consecutiveFailures: number;
  lastDeliveryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeFakePrisma(seed: WebhookRow[] = []) {
  const rows = [...seed];

  const matches = (row: WebhookRow, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);

  const delegate = {
    async findUnique({ where }: { where: Record<string, unknown> }) {
      if (where.id) return rows.find((row) => row.id === where.id) ?? null;
      if (where.satelliteTokenId_url) {
        const { satelliteTokenId, url } = where.satelliteTokenId_url as { satelliteTokenId: string; url: string };
        return rows.find((row) => row.satelliteTokenId === satelliteTokenId && row.url === url) ?? null;
      }
      return null;
    },
    async findMany({ where }: { where?: Record<string, unknown> } = {}) {
      let result = rows;
      if (where?.satelliteTokenId) {
        result = result.filter((row) => row.satelliteTokenId === where.satelliteTokenId);
      }
      if (where?.status) {
        result = result.filter((row) => row.status === where.status);
      }
      if (where?.events && typeof where.events === "object" && "has" in (where.events as object)) {
        const target = (where.events as { has: string }).has;
        result = result.filter((row) => row.events.includes(target));
      }
      return [...result];
    },
    async create({ data }: { data: Partial<WebhookRow> }) {
      const row: WebhookRow = {
        id: `whk_${rows.length + 1}`,
        satelliteTokenId: data.satelliteTokenId as string,
        url: data.url as string,
        events: (data.events as string[]) ?? [],
        secretCiphertext: data.secretCiphertext as string,
        secretIv: data.secretIv as string,
        secretTag: data.secretTag as string,
        secretKeyVersion: data.secretKeyVersion ?? 1,
        status: "ACTIVE",
        consecutiveFailures: 0,
        lastDeliveryAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error("not found");
      const patch = { ...data };
      const increment = (patch.consecutiveFailures as { increment?: number } | undefined)?.increment;
      if (increment !== undefined) {
        row.consecutiveFailures += increment;
        delete patch.consecutiveFailures;
      }
      Object.assign(row, patch);
      return row;
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const matched = rows.filter((row) => matches(row, where));
      matched.forEach((row) => Object.assign(row, data));
      return { count: matched.length };
    },
    async delete({ where }: { where: { id: string } }) {
      const index = rows.findIndex((row) => row.id === where.id);
      if (index === -1) throw new Error("not found");
      const [removed] = rows.splice(index, 1);
      return removed;
    },
  };

  return { prisma: { satelliteWebhook: delegate }, rows };
}

function makeAuditService() {
  const calls: unknown[] = [];
  return { auditService: { append: async (entry: unknown) => { calls.push(entry); } }, calls };
}

function makeService(seed: WebhookRow[] = []) {
  const fake = makeFakePrisma(seed);
  const audit = makeAuditService();
  const service = new SatelliteWebhooksService(fake.prisma as never, audit.auditService as never);
  return { service, ...fake, ...audit };
}

function withEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const previousEnabled = process.env.SATELLITE_WEBHOOKS_ENABLED;
  const previousKey = process.env.SATELLITE_WEBHOOK_SECRET_KEY;
  process.env.SATELLITE_WEBHOOKS_ENABLED = "true";
  process.env.SATELLITE_WEBHOOK_SECRET_KEY = randomBytes(32).toString("hex");
  return fn().finally(() => {
    if (previousEnabled === undefined) delete process.env.SATELLITE_WEBHOOKS_ENABLED;
    else process.env.SATELLITE_WEBHOOKS_ENABLED = previousEnabled;
    if (previousKey === undefined) delete process.env.SATELLITE_WEBHOOK_SECRET_KEY;
    else process.env.SATELLITE_WEBHOOK_SECRET_KEY = previousKey;
  });
}

const satelliteA = { id: "sat_a", name: "alexa", scopes: ["events:subscribe", "jobs:read", "milestones:read"] };
const satelliteB = { id: "sat_b", name: "bravo", scopes: ["events:subscribe", "jobs:read"] };

test("SAT-007: kill switch apagado ⇒ 503 en register", async () => {
  const { service } = makeService();
  await assert.rejects(
    () => service.register({ satellite: satelliteA, url: "https://example.com/hook", events: ["job.matched"] }),
    ServiceUnavailableException,
  );
});

test("SAT-007: register exitoso devuelve el secreto en claro una sola vez y nunca lo persiste sin cifrar", async () => {
  await withEnabled(async () => {
    const { service, rows } = makeService();
    const result = await service.register({
      satellite: satelliteA,
      url: "https://example.com/hook",
      events: ["job.matched", "milestone.approved"],
    });

    assert.ok(result.secret.length >= 32);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].secretCiphertext, result.secret);
    assert.equal(Object.hasOwn(result, "secretCiphertext"), false);
    assert.equal(result.status, "ACTIVE");
  });
});

test("SAT-007: register rechaza sin scope events:subscribe", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    const noSubscribe = { id: "sat_c", name: "charlie", scopes: ["jobs:read"] };
    await assert.rejects(
      () => service.register({ satellite: noSubscribe, url: "https://example.com/hook", events: ["job.matched"] }),
      ForbiddenException,
    );
  });
});

test("SAT-007: register rechaza lista de eventos vacía o desconocida", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    await assert.rejects(
      () => service.register({ satellite: satelliteA, url: "https://example.com/hook", events: [] }),
      BadRequestException,
    );
    await assert.rejects(
      () =>
        service.register({
          satellite: satelliteA,
          url: "https://example.com/hook",
          events: ["not.a.real.event"],
        }),
      BadRequestException,
    );
  });
});

test("SAT-007: register exige el scope requerido por cada evento suscrito", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    // satelliteB no tiene milestones:read
    await assert.rejects(
      () =>
        service.register({
          satellite: satelliteB,
          url: "https://example.com/hook",
          events: ["milestone.approved"],
        }),
      ForbiddenException,
    );
  });
});

test("SAT-007: register rechaza URLs que fallan la validación SSRF", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    await assert.rejects(
      () => service.register({ satellite: satelliteA, url: "https://127.0.0.1/hook", events: ["job.matched"] }),
      BadRequestException,
    );
  });
});

test("SAT-007: register rechaza URL duplicada para el mismo satélite (409)", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    await service.register({ satellite: satelliteA, url: "https://example.com/hook", events: ["job.matched"] });
    await assert.rejects(
      () => service.register({ satellite: satelliteA, url: "https://example.com/hook", events: ["job.matched"] }),
      ConflictException,
    );
  });
});

test("SAT-007: register rechaza un secreto explícito demasiado corto", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    await assert.rejects(
      () =>
        service.register({
          satellite: satelliteA,
          url: "https://example.com/hook",
          events: ["job.matched"],
          secret: "too-short",
        }),
      BadRequestException,
    );
  });
});

test("SAT-007: listForSatellite aísla los webhooks entre satélites distintos", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    await service.register({ satellite: satelliteA, url: "https://example.com/a", events: ["job.matched"] });
    await service.register({ satellite: satelliteB, url: "https://example.com/b", events: ["job.matched"] });

    const listA = await service.listForSatellite(satelliteA);
    const listB = await service.listForSatellite(satelliteB);

    assert.equal(listA.length, 1);
    assert.equal(listA[0]?.url, "https://example.com/a");
    assert.equal(listB.length, 1);
    assert.equal(listB[0]?.url, "https://example.com/b");
  });
});

test("SAT-007: listAll (admin) ve los webhooks de todos los satélites", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    await service.register({ satellite: satelliteA, url: "https://example.com/a", events: ["job.matched"] });
    await service.register({ satellite: satelliteB, url: "https://example.com/b", events: ["job.matched"] });

    const all = await service.listAll();
    assert.equal(all.length, 2);
  });
});

test("SAT-007: revoke rechaza gestionar el webhook de otro satélite (403); admin puede revocar cualquiera", async () => {
  await withEnabled(async () => {
    const { service, rows } = makeService();
    const created = await service.register({
      satellite: satelliteA,
      url: "https://example.com/a",
      events: ["job.matched"],
    });

    await assert.rejects(
      () => service.revoke({ id: created.id, satellite: satelliteB, isAdmin: false }),
      ForbiddenException,
    );
    assert.equal(rows.length, 1);

    const result = await service.revoke({ id: created.id, isAdmin: true });
    assert.equal(result.status, "REVOKED");
    assert.equal(rows.length, 0);
  });
});

test("SAT-007: revoke sobre id inexistente ⇒ 404", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    await assert.rejects(() => service.revoke({ id: "whk_nope", isAdmin: true }), NotFoundException);
  });
});

test("SAT-007: suspendAllForToken suspende solo los webhooks ACTIVE del token dado", async () => {
  await withEnabled(async () => {
    const { service, rows } = makeService();
    await service.register({ satellite: satelliteA, url: "https://example.com/a1", events: ["job.matched"] });
    await service.register({ satellite: satelliteA, url: "https://example.com/a2", events: ["job.matched"] });
    await service.register({ satellite: satelliteB, url: "https://example.com/b", events: ["job.matched"] });

    const suspended = await service.suspendAllForToken(satelliteA.id);

    assert.equal(suspended, 2);
    assert.ok(rows.filter((row) => row.satelliteTokenId === satelliteA.id).every((row) => row.status === "SUSPENDED"));
    assert.equal(rows.find((row) => row.satelliteTokenId === satelliteB.id)?.status, "ACTIVE");
  });
});

test("SAT-007: recordDeliveryFailure suspende tras 5 fallos consecutivos; recordDeliverySuccess resetea el contador", async () => {
  await withEnabled(async () => {
    const { service, rows } = makeService();
    const created = await service.register({
      satellite: satelliteA,
      url: "https://example.com/a",
      events: ["job.matched"],
    });

    for (let i = 0; i < 4; i += 1) {
      const suspended = await service.recordDeliveryFailure(created.id);
      assert.equal(suspended, false);
    }
    const finalSuspended = await service.recordDeliveryFailure(created.id);
    assert.equal(finalSuspended, true);
    assert.equal(rows[0]?.status, "SUSPENDED");
    assert.equal(rows[0]?.consecutiveFailures, 5);

    // Un delivery exitoso posterior resetea el contador (no reactiva el estado).
    await service.recordDeliverySuccess(created.id);
    assert.equal(rows[0]?.consecutiveFailures, 0);
    assert.ok(rows[0]?.lastDeliveryAt instanceof Date);
  });
});

test("SAT-007: findActiveForEvent excluye webhooks SUSPENDED y no suscritos, y descifra el secreto", async () => {
  await withEnabled(async () => {
    const { service } = makeService();
    await service.register({
      satellite: satelliteA,
      url: "https://example.com/a",
      events: ["job.matched", "milestone.approved"],
    });
    await service.register({ satellite: satelliteB, url: "https://example.com/b", events: ["job.matched"] });
    await service.suspendAllForToken(satelliteA.id);

    const active = await service.findActiveForEvent("job.matched");
    assert.equal(active.length, 1);
    assert.equal(active[0]?.satelliteTokenId, satelliteB.id);
    assert.equal(typeof active[0]?.secret, "string");
    assert.ok((active[0]?.secret.length ?? 0) >= 32);

    const noneForOtherEvent = await service.findActiveForEvent("rating.requested");
    assert.equal(noneForOtherEvent.length, 0);
  });
});
