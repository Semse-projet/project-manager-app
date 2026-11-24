import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgroEvidenceService } from "../dist/modules/agro/agro-evidence.service.js";

const STUB_FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza", operationType: "LIVESTOCK", locationLabel: null, notes: null, createdAt: new Date(), updatedAt: new Date() };

const STUB_EVIDENCE = {
  id: "ev_1", farmId: "farm_1",
  entityType: "ANIMAL", entityId: "ani_1",
  mediaType: "NOTE", title: "Health note",
  note: "Animal looks healthy", fileUrl: null,
  capturedAt: new Date(), capturedById: "usr_1",
  latitude: null, longitude: null,
};

function makeFarmRepo(farm = STUB_FARM) {
  return { findFarm: async (id: string) => id === farm.id ? farm : null } as never;
}

function makeEvidenceRepo(evidence = [STUB_EVIDENCE]) {
  const list = [...evidence];
  return {
    listEvidence:   async (_farmId: string, filters?: any) =>
      list.filter(e => !filters?.entityType || e.entityType === filters.entityType),
    findEvidence:   async (id: string) => list.find(e => e.id === id) ?? null,
    createEvidence: async (input: any) => ({ ...STUB_EVIDENCE, id: "ev_new", ...input }),
    updateEvidence: async (id: string, patch: any) => {
      const e = list.find(e => e.id === id) ?? STUB_EVIDENCE;
      return { ...e, ...patch };
    },
    recentEvidence: async (_farmId: string, limit: number) => list.slice(0, limit),
  } as never;
}

function makeAuditRepo() {
  const events: any[] = [];
  return { record: async (e: any) => { events.push(e); }, _events: events } as any;
}

test("agro-evidence: listEvidence returns evidence for farm", async () => {
  const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), makeAuditRepo());
  const evidence = await svc.listEvidence("farm_1", "usr_1");
  assert.equal(evidence.length, 1);
});

test("agro-evidence: listEvidence throws for wrong owner", async () => {
  const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.listEvidence("farm_1", "usr_X"), NotFoundException);
});

test("agro-evidence: createEvidence NOTE requires note field", async () => {
  const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createEvidence("farm_1", "usr_1", { entityType: "GENERAL", mediaType: "NOTE" }),
    BadRequestException,
  );
});

test("agro-evidence: createEvidence PHOTO requires fileUrl", async () => {
  const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createEvidence("farm_1", "usr_1", { entityType: "GENERAL", mediaType: "PHOTO" }),
    BadRequestException,
  );
});

test("agro-evidence: createEvidence NOTE succeeds and records audit", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), audit);
  const ev = await svc.createEvidence("farm_1", "usr_1", {
    entityType: "ANIMAL", entityId: "ani_1",
    mediaType: "NOTE", note: "Looks good",
  });
  assert.ok(ev.id);
  assert.equal(audit._events[0].action, "evidence.created");
});

test("agro-evidence: createEvidence throws for invalid entityType", async () => {
  const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createEvidence("farm_1", "usr_1", { entityType: "VEHICLE", mediaType: "NOTE", note: "X" }),
    BadRequestException,
  );
});

test("agro-evidence: getRecentEvidence respects limit", async () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ ...STUB_EVIDENCE, id: `ev_${i}` }));
  const svc = new AgroEvidenceService(makeEvidenceRepo(items), makeFarmRepo(), makeAuditRepo());
  const evidence = await svc.getRecentEvidence("farm_1", "usr_1", 5);
  assert.equal(evidence.length, 5);
});

function withEvidenceAllowlist(hosts: string, fn: () => Promise<void>) {
  const prevHosts = process.env.SEMSE_EVIDENCE_FILE_URL_ALLOWED_HOSTS;
  const prevApi = process.env.SEMSE_API_BASE_URL;
  const prevWeb = process.env.SEMSE_WEB_BASE_URL;
  process.env.SEMSE_EVIDENCE_FILE_URL_ALLOWED_HOSTS = hosts;
  delete process.env.SEMSE_API_BASE_URL;
  delete process.env.SEMSE_WEB_BASE_URL;
  return fn().finally(() => {
    if (prevHosts === undefined) delete process.env.SEMSE_EVIDENCE_FILE_URL_ALLOWED_HOSTS;
    else process.env.SEMSE_EVIDENCE_FILE_URL_ALLOWED_HOSTS = prevHosts;
    if (prevApi === undefined) delete process.env.SEMSE_API_BASE_URL;
    else process.env.SEMSE_API_BASE_URL = prevApi;
    if (prevWeb === undefined) delete process.env.SEMSE_WEB_BASE_URL;
    else process.env.SEMSE_WEB_BASE_URL = prevWeb;
  });
}

test("agro-evidence: createEvidence PHOTO accepts an allowlisted public https fileUrl", async () => {
  await withEvidenceAllowlist("8.8.8.8", async () => {
    const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), makeAuditRepo());
    const ev = await svc.createEvidence("farm_1", "usr_1", {
      entityType: "GENERAL",
      mediaType: "PHOTO",
      fileUrl: "https://8.8.8.8/photo.jpg",
    });
    assert.equal(ev.fileUrl, "https://8.8.8.8/photo.jpg");
  });
});

test("agro-evidence: createEvidence PHOTO rejects http, loopback, and off-list hosts", async () => {
  await withEvidenceAllowlist("8.8.8.8", async () => {
    const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), makeAuditRepo());
    await assert.rejects(
      () => svc.createEvidence("farm_1", "usr_1", { entityType: "GENERAL", mediaType: "PHOTO", fileUrl: "http://8.8.8.8/photo.jpg" }),
      BadRequestException,
    );
    await assert.rejects(
      () => svc.createEvidence("farm_1", "usr_1", { entityType: "GENERAL", mediaType: "PHOTO", fileUrl: "https://127.0.0.1/photo.jpg" }),
      BadRequestException,
    );
    await assert.rejects(
      () => svc.createEvidence("farm_1", "usr_1", { entityType: "GENERAL", mediaType: "PHOTO", fileUrl: "https://1.1.1.1/photo.jpg" }),
      BadRequestException,
    );
  });
});

test("agro-evidence: updateEvidence rejects a fileUrl that is not on the allowlist", async () => {
  await withEvidenceAllowlist("8.8.8.8", async () => {
    const svc = new AgroEvidenceService(makeEvidenceRepo(), makeFarmRepo(), makeAuditRepo());
    await assert.rejects(
      () => svc.updateEvidence("ev_1", "usr_1", { fileUrl: "https://169.254.169.254/latest/meta-data" }),
      BadRequestException,
    );
    const updated = await svc.updateEvidence("ev_1", "usr_1", { fileUrl: "https://8.8.8.8/ok.jpg" });
    assert.equal(updated.fileUrl, "https://8.8.8.8/ok.jpg");
  });
});
