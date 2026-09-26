/**
 * T-053 — Subida binaria de evidencia Agro (flujo presignado).
 *
 * `agro-evidence-upload.ts` (web) sube el archivo con el contrato compartido
 * (presign → PUT al proxy) y llama a este mismo endpoint con la URL
 * absoluta real que StorageService.publicUrl() devuelve. Este test no repite
 * el presign/PUT en sí (pipeline compartido y preexistente, ya cubierto en
 * otras partes del repo) — usa StorageService directamente para escribir un
 * archivo real y obtener su URL pública real, y prueba lo que sí es nuevo de
 * T-053: que esa URL real, absoluta, la acepta y persiste `POST
 * .../evidence` para un miembro WORKER de la finca (rol que ya tiene
 * `evidence:write` — no hizo falta RBAC nuevo). El round-trip completo por
 * HTTP (presign real → PUT real → GET real) se verificó a mano contra
 * Postgres + API + web locales, documentado en
 * docs/specs/agro/agro-evidence-upload.spec.md.
 *
 * También documenta el hallazgo real de esta tarea: una URL *relativa*
 * (lo que el proxy BFF devuelve tal cual) no pasa la validación `.url()` del
 * esquema Agro y el controller no captura ese ZodError — 500, no 400 (mismo
 * hallazgo R8 del AS-IS). Por eso agro-evidence-upload.ts arma la URL
 * absoluta con window.location.origin antes de registrar la evidencia.
 *
 * E2E por HTTP contra Postgres real. Se salta sin DATABASE_URL.
 */
import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", "..", "..", "packages/db/.env") });

const dbTest = process.env.DATABASE_URL ? test : test.skip;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function buildApp() {
  delete process.env.AUTH_SECRET;
  const { Module } = await import("@nestjs/common");
  const { APP_GUARD, NestFactory } = await import("@nestjs/core");
  const { ConfigModule } = await import("@nestjs/config");
  const { FastifyAdapter } = await import("@nestjs/platform-fastify");
  const { PrismaModule } = await import("../dist/infrastructure/prisma/prisma.module.js");
  const { AgroModule } = await import("../dist/modules/agro/agro.module.js");
  const { RbacGuard } = await import("../dist/common/rbac.guard.js");
  const { HttpExceptionFilter } = await import("../dist/common/http-exception.filter.js");
  const { SemseLoggerService } = await import("../dist/infrastructure/observability/semse-logger.service.js");

  class AgroEvidenceUploadE2EModule {}
  Module({
    imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AgroModule],
    providers: [{ provide: APP_GUARD, useClass: RbacGuard }],
  })(AgroEvidenceUploadE2EModule);

  const app = await NestFactory.create(AgroEvidenceUploadE2EModule, new FastifyAdapter(), { logger: false });
  app.useGlobalFilters(new HttpExceptionFilter(app.get(SemseLoggerService)));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

dbTest("agro T-053: a real uploaded file's absolute URL is accepted and persisted as evidence", async () => {
  const prisma = new PrismaClient();
  const app = await buildApp();
  const fastify = app.getHttpAdapter().getInstance();
  const { StorageService } = await import("../dist/infrastructure/storage/storage.service.js");
  const storage = new StorageService();

  const tenantId = uid("ten");
  const users = { owner: uid("owner"), worker: uid("worker") };
  const farmIds: string[] = [];

  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Agro T-053" } });
  for (const id of Object.values(users)) await prisma.user.create({ data: { id, email: `${id}@agro-t053.test` } });

  const call = async (as: keyof typeof users, method: string, url: string, payload?: unknown) => {
    const res = await fastify.inject({
      method: method as any,
      url,
      headers: {
        "x-user-id": users[as], "x-tenant-id": tenantId, "x-org-id": "org_t053",
        "x-roles": as === "owner" ? "CLIENT" : "WORKER", "content-type": "application/json",
      },
      ...(payload !== undefined && { payload: JSON.stringify(payload) }),
    });
    const body = res.body ? JSON.parse(res.body) : null;
    return { status: res.statusCode, data: body?.data, body };
  };

  try {
    // Un archivo real, escrito por el mismo StorageService que sirve
    // POST /v1/evidence/presign → PUT /v1/uploads/files/:key en producción.
    const key = `tenants/${tenantId}/evidence/${uid("photo")}.jpg`;
    const bytes = Buffer.from("fake-jpeg-bytes-for-t053");
    await storage.store({ key, stream: Readable.from(bytes), contentType: "image/jpeg" });
    const absoluteFileUrl = storage.publicUrl(key);
    assert.match(absoluteFileUrl, /^https?:\/\//, "publicUrl must be absolute, like the web helper builds it");

    const farm = await call("owner", "POST", "/v1/agro/farms", { name: "Granja T-053" });
    assert.equal(farm.status, 201, JSON.stringify(farm.body));
    const farmId = farm.data.farm.id;
    farmIds.push(farmId);
    assert.equal((await call("owner", "POST", `/v1/agro/farms/${farmId}/members`, { userId: users.worker, role: "WORKER" })).status, 201);

    // El miembro WORKER (evidence:write, sin ningún permiso nuevo) sube evidencia PHOTO.
    const created = await call("worker", "POST", `/v1/agro/farms/${farmId}/evidence`, {
      entityType: "GENERAL", mediaType: "PHOTO", title: "Foto real subida (T-053)", fileUrl: absoluteFileUrl,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.data.evidence.fileUrl, absoluteFileUrl);

    const listed = await call("worker", "GET", `/v1/agro/farms/${farmId}/evidence`);
    assert.equal(listed.status, 200);
    assert.ok(listed.data.evidence.some((e: any) => e.id === created.data.evidence.id && e.fileUrl === absoluteFileUrl));

    // Regresión documentada (R8, AS-IS): una URL relativa —lo que el proxy BFF
    // devuelve, sin window.location.origin— no pasa `.url()` y el controller
    // no captura el ZodError: 500, no 400. agro-evidence-upload.ts evita esto
    // enviando siempre una URL absoluta; este assert deja la causa documentada.
    const relative = await call("worker", "POST", `/v1/agro/farms/${farmId}/evidence`, {
      entityType: "GENERAL", mediaType: "PHOTO", fileUrl: "/api/semse/uploads/files/whatever.jpg",
    });
    assert.equal(relative.status, 500, "R8: relative fileUrl still 500s, not 400 — not fixed by T-053, only avoided");
  } finally {
    if (farmIds.length) await prisma.agroFarm.deleteMany({ where: { id: { in: farmIds } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
    await prisma.$disconnect();
  }
});
