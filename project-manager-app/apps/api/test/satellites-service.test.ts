import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { SatellitesService } from "../dist/modules/satellites/satellites.service.js";
import { sha256 } from "../dist/common/auth-password.js";

// ─────────────────────────────────────────────────────────────────────────────
// SAT-001 anillo 1 — SatellitesService: emisión, verificación, revocación,
// expiración y kill switch (docs/specs/satellites/SAT-001-semse-sdk.spec.md)
// ─────────────────────────────────────────────────────────────────────────────

type TokenRecord = {
  id: string;
  name: string;
  tokenHash: string;
  scopes: string[];
  status: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeFakePrisma(seed: TokenRecord[] = []) {
  const rows = [...seed];
  const calls: { update: unknown[] } = { update: [] };

  const delegate = {
    async findUnique({ where }: { where: { id?: string; name?: string; tokenHash?: string } }) {
      return (
        rows.find(
          (row) =>
            (where.id && row.id === where.id) ||
            (where.name && row.name === where.name) ||
            (where.tokenHash && row.tokenHash === where.tokenHash)
        ) ?? null
      );
    },
    async findMany() {
      return rows;
    },
    async create({ data }: { data: Partial<TokenRecord> }) {
      const row: TokenRecord = {
        id: `sat_${rows.length + 1}`,
        name: data.name as string,
        tokenHash: data.tokenHash as string,
        scopes: (data.scopes as string[]) ?? [],
        status: "ACTIVE",
        expiresAt: (data.expiresAt as Date | null) ?? null,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      rows.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<TokenRecord> }) {
      calls.update.push({ where, data });
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error("not found");
      Object.assign(row, data);
      return row;
    }
  };

  return { prisma: { satelliteToken: delegate }, rows, calls };
}

function makeService(seed: TokenRecord[] = []) {
  const fake = makeFakePrisma(seed);
  const service = new SatellitesService(fake.prisma as never);
  return { service, ...fake };
}

function withKillSwitch<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.SATELLITE_TOKENS_ENABLED;
  if (value === undefined) delete process.env.SATELLITE_TOKENS_ENABLED;
  else process.env.SATELLITE_TOKENS_ENABLED = value;
  return fn().finally(() => {
    if (previous === undefined) delete process.env.SATELLITE_TOKENS_ENABLED;
    else process.env.SATELLITE_TOKENS_ENABLED = previous;
  });
}

test("SAT-001: issueToken devuelve token sst_ una sola vez y guarda solo el hash", async () => {
  const { service, rows } = makeService();

  const issued = await service.issueToken({ name: "alexa", scopes: ["intake:write", "intake:read"] });

  assert.ok(issued.token.startsWith("sst_"));
  assert.deepEqual(issued.scopes, ["intake:write", "intake:read"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tokenHash, sha256(issued.token));
  assert.notEqual(rows[0].tokenHash, issued.token);
  assert.ok(!JSON.stringify(await service.listTokens()).includes(issued.token));
});

test("SAT-001: issueToken rechaza nombre duplicado con token ACTIVE", async () => {
  const { service } = makeService();
  await service.issueToken({ name: "mobile", scopes: ["jobs:read"] });

  await assert.rejects(
    () => service.issueToken({ name: "mobile", scopes: ["jobs:read"] }),
    ConflictException
  );
});

test("SAT-001: issueToken re-emite (rotación) sobre un token revocado", async () => {
  const { service, rows } = makeService();
  const first = await service.issueToken({ name: "graphify", scopes: ["knowledge:read"] });
  await service.revokeToken(rows[0].id);

  const second = await service.issueToken({ name: "graphify", scopes: ["knowledge:read"] });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "ACTIVE");
  assert.notEqual(first.token, second.token);
});

test("SAT-001: verifyToken devuelve identidad y actualiza lastUsedAt (heartbeat pasivo)", async () => {
  await withKillSwitch("true", async () => {
    const { service, calls } = makeService();
    const issued = await service.issueToken({ name: "alexa", scopes: ["intake:write"] });

    const identity = await service.verifyToken(issued.token);

    assert.equal(identity.name, "alexa");
    assert.deepEqual(identity.scopes, ["intake:write"]);
    // update de emisión no cuenta; el heartbeat es el último update
    await new Promise((resolve) => setImmediate(resolve));
    const last = calls.update.at(-1) as { data: { lastUsedAt?: Date } };
    assert.ok(last.data.lastUsedAt instanceof Date);
  });
});

test("SAT-001: kill switch apagado ⇒ 503 aunque el token sea válido", async () => {
  let issuedToken = "";
  await withKillSwitch("true", async () => {
    const { service } = makeService();
    const issued = await service.issueToken({ name: "alexa", scopes: ["intake:write"] });
    issuedToken = issued.token;
  });

  await withKillSwitch(undefined, async () => {
    const { service } = makeService();
    await assert.rejects(() => service.verifyToken(issuedToken), ServiceUnavailableException);
  });
});

test("SAT-001: token desconocido, revocado o expirado ⇒ 401", async () => {
  await withKillSwitch("true", async () => {
    const { service, rows } = makeService();

    await assert.rejects(() => service.verifyToken("sst_desconocido"), UnauthorizedException);
    await assert.rejects(() => service.verifyToken("sin-prefijo"), UnauthorizedException);

    const issued = await service.issueToken({ name: "mobile", scopes: ["jobs:read"] });
    await service.revokeToken(rows[0].id);
    await assert.rejects(() => service.verifyToken(issued.token), UnauthorizedException);

    const expired = await service.issueToken({
      name: "storage",
      scopes: ["uploads:driver"],
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    });
    await assert.rejects(() => service.verifyToken(expired.token), UnauthorizedException);
  });
});

test("SAT-001: revokeToken marca REVOKED; id inexistente ⇒ 404", async () => {
  const { service, rows } = makeService();
  await service.issueToken({ name: "protools-embed", scopes: ["tools:invoke"] });

  const revoked = await service.revokeToken(rows[0].id);
  assert.equal(revoked.status, "REVOKED");
  assert.ok(revoked.revokedAt instanceof Date);

  await assert.rejects(() => service.revokeToken("sat_nope"), NotFoundException);
});

test("SAT-001: listTokens nunca expone tokenHash", async () => {
  const { service } = makeService();
  await service.issueToken({ name: "alexa", scopes: ["intake:write"] });

  const listed = await service.listTokens();
  assert.equal(listed.length, 1);
  assert.equal(Object.hasOwn(listed[0] as object, "tokenHash"), false);
});
