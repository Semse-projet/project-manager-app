import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { ForbiddenException } from "@nestjs/common";
import { UploadsController } from "../dist/infrastructure/storage/uploads.controller.js";
import { StorageService } from "../dist/infrastructure/storage/storage.service.js";
import {
  checkSignature,
  decideRead,
  signKey,
  tenantFromStorageKey,
  resolveSignedGetMode,
} from "../dist/infrastructure/storage/signed-url.js";

const SECRET = "primary-secret-0123456789";
const OLD = "previous-secret-0123456789";
const KEY_A = "tenants/tenantA/public-intake/evidence/abc.png";
const now = 1_800_000_000;

test("firma valida / expirada / alterada / otra clave / sin firma", () => {
  const exp = now + 60;
  const sig = signKey(KEY_A, exp, SECRET);
  assert.equal(checkSignature({ key: KEY_A, exp: String(exp), sig, nowSeconds: now }, [SECRET]), "valid");
  assert.equal(checkSignature({ key: KEY_A, exp: String(exp), sig, nowSeconds: now + 61 }, [SECRET]), "expired");
  assert.equal(checkSignature({ key: KEY_A, exp: String(exp + 1), sig, nowSeconds: now }, [SECRET]), "invalid");
  assert.equal(checkSignature({ key: KEY_A + "x", exp: String(exp), sig, nowSeconds: now }, [SECRET]), "invalid");
  assert.equal(checkSignature({ key: KEY_A, exp: String(exp), sig: "zz", nowSeconds: now }, [SECRET]), "invalid");
  assert.equal(checkSignature({ key: KEY_A }, [SECRET]), "absent");
  assert.equal(checkSignature({ key: KEY_A, exp: String(exp), sig, nowSeconds: now }, []), "invalid");
});

test("rotacion: una firma con el secreto anterior sigue valida mientras este activo", () => {
  const exp = now + 60;
  const sig = signKey(KEY_A, exp, OLD);
  assert.equal(checkSignature({ key: KEY_A, exp: String(exp), sig, nowSeconds: now }, [SECRET, OLD]), "valid");
  assert.equal(checkSignature({ key: KEY_A, exp: String(exp), sig, nowSeconds: now }, [SECRET]), "invalid");
});

test("la firma de lectura no vale como la de otro verbo", () => {
  // La firma incluye el prefijo GET: una firma sobre otra cadena no coincide.
  const exp = now + 60;
  const forged = signKey(`PUT\n${KEY_A}`, exp, SECRET);
  assert.equal(checkSignature({ key: KEY_A, exp: String(exp), sig: forged, nowSeconds: now }, [SECRET]), "invalid");
});

test("tenantFromStorageKey", () => {
  assert.equal(tenantFromStorageKey(KEY_A), "tenantA");
  assert.equal(tenantFromStorageKey("evidence/legacy.png"), null);
});

const pub = ["public/"];
test("decideRead por modo", () => {
  const sess = (tenantId: string, roles: string[] = []) => ({ tenantId, roles });
  // off: comportamiento actual
  assert.equal(decideRead({ mode: "off", key: KEY_A, signature: "absent", session: null, publicPrefixes: pub }).allow, true);
  // enforce
  assert.equal(decideRead({ mode: "enforce", key: KEY_A, signature: "absent", session: null, publicPrefixes: pub }).allow, false);
  assert.equal(decideRead({ mode: "enforce", key: KEY_A, signature: "valid", session: null, publicPrefixes: pub }).allow, true);
  assert.equal(decideRead({ mode: "enforce", key: KEY_A, signature: "expired", session: null, publicPrefixes: pub }).allow, false);
  assert.equal(decideRead({ mode: "enforce", key: KEY_A, signature: "absent", session: sess("tenantA"), publicPrefixes: pub }).allow, true);
  const cross = decideRead({ mode: "enforce", key: KEY_A, signature: "absent", session: sess("tenantB"), publicPrefixes: pub });
  assert.equal(cross.allow, false);
  assert.equal(cross.reason, "session_tenant_mismatch");
  assert.equal(decideRead({ mode: "enforce", key: KEY_A, signature: "absent", session: sess("tenantB", ["OPS_ADMIN"]), publicPrefixes: pub }).allow, true);
  assert.equal(decideRead({ mode: "enforce", key: "public/logo.png", signature: "absent", session: null, publicPrefixes: pub }).allow, true);
  // claves legacy sin tenant: una sesion cualquiera NO las lee
  assert.equal(decideRead({ mode: "enforce", key: "evidence/legacy.png", signature: "absent", session: sess("tenantA"), publicPrefixes: pub }).allow, false);
  // shadow: sirve sin firma y lo registra; pero tenant ajeno y firma mala siguen denegados
  const shadow = decideRead({ mode: "shadow", key: KEY_A, signature: "absent", session: null, publicPrefixes: pub });
  assert.equal(shadow.allow, true);
  assert.equal(shadow.logUnsigned, true);
  assert.equal(decideRead({ mode: "shadow", key: KEY_A, signature: "absent", session: sess("tenantB"), publicPrefixes: pub }).allow, false);
  assert.equal(decideRead({ mode: "shadow", key: KEY_A, signature: "invalid", session: null, publicPrefixes: pub }).allow, false);
});

test("resolveSignedGetMode: valores desconocidos caen a off", () => {
  assert.equal(resolveSignedGetMode({} as never), "off");
  assert.equal(resolveSignedGetMode({ UPLOADS_SIGNED_GET_MODE: "ENFORCE" } as never), "enforce");
  assert.equal(resolveSignedGetMode({ UPLOADS_SIGNED_GET_MODE: "bogus" } as never), "off");
});

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    await fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("StorageService.publicUrl: sin firma en off, firmada (y valida) en shadow/enforce, ttl vision menor", async () => {
  await withEnv({ UPLOADS_SIGNED_GET_MODE: "off", UPLOADS_SIGNING_SECRET: SECRET }, async () => {
    assert.ok(!new StorageService().publicUrl(KEY_A).includes("sig="));
  });
  await withEnv({ UPLOADS_SIGNED_GET_MODE: "enforce", UPLOADS_SIGNING_SECRET: SECRET }, async () => {
    const svc = new StorageService();
    const url = new URL(svc.publicUrl(KEY_A));
    const exp = url.searchParams.get("exp");
    assert.equal(checkSignature({ key: KEY_A, exp, sig: url.searchParams.get("sig") }, [SECRET]), "valid");
    const browserTtl = Number(exp) - Math.floor(Date.now() / 1000);
    const vision = new URL(svc.publicUrl(KEY_A, { ttl: "vision" }));
    const visionTtl = Number(vision.searchParams.get("exp")) - Math.floor(Date.now() / 1000);
    assert.ok(browserTtl > 800 && browserTtl <= 900);
    assert.ok(visionTtl > 200 && visionTtl <= 300);
  });
});

test("GET files/*: enforce -> 403 sin firma, 200 con firma, 403 con tenant ajeno; el 403 no revela existencia", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "signed-get-"));
  await withEnv(
    { SEMSE_STORAGE_ROOT: root, UPLOADS_SIGNED_GET_MODE: "enforce", UPLOADS_SIGNING_SECRET: SECRET, AUTH_SECRET: undefined },
    async () => {
      try {
        await mkdir(path.join(root, path.dirname(KEY_A)), { recursive: true });
        await writeFile(path.join(root, KEY_A), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        const controller = new UploadsController(new StorageService());
        const res = { headers: () => undefined } as never;
        const enc = encodeURIComponent(KEY_A);

        await assert.rejects(() => controller.getFile(enc, { headers: {}, query: {} } as never, res), ForbiddenException);
        // clave inexistente y sin firma: mismo 403 (no oraculo de existencia)
        await assert.rejects(() => controller.getFile(encodeURIComponent("tenants/tenantA/nope.png"), { headers: {}, query: {} } as never, res), ForbiddenException);

        const url = new URL(new StorageService().publicUrl(KEY_A));
        const ok = await controller.getFile(enc, { headers: {}, query: Object.fromEntries(url.searchParams) } as never, res);
        assert.ok(ok);

        const tampered = { exp: url.searchParams.get("exp"), sig: "00".repeat(32) };
        await assert.rejects(() => controller.getFile(enc, { headers: {}, query: tampered } as never, res), ForbiddenException);

        const other = { headers: { "x-user-id": "u", "x-tenant-id": "tenantB", "x-org-id": "o", "x-roles": "CLIENT" }, query: {} };
        await assert.rejects(() => controller.getFile(enc, other as never, res), ForbiddenException);
        const own = { headers: { "x-user-id": "u", "x-tenant-id": "tenantA", "x-org-id": "o", "x-roles": "CLIENT" }, query: {} };
        assert.ok(await controller.getFile(enc, own as never, res));
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});
