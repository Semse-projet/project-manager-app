import test from "node:test";
import assert from "node:assert/strict";
import { AiInteractionLoggerService } from "../dist/modules/ai-models/logging/ai-interaction-logger.service.js";

// C39/C10: AI interaction logs must be tenant-scoped on write and on read.

function build() {
  const created: any[] = [];
  const wheres: any[] = [];
  const prisma = {
    aiInteractionLog: {
      create: async ({ data }: any) => { created.push(data); return data; },
      findMany: async (args: any) => { wheres.push(args.where); return []; },
      count: async (args: any) => { wheres.push(args.where); return 0; },
      groupBy: async (args: any) => { wheres.push(args.where); return []; },
    },
  };
  return { svc: new AiInteractionLoggerService(prisma as any), created, wheres };
}

const req = (tenantId?: string) => ({ taskType: "general_chat", input: "hi", metadata: tenantId ? { tenantId } : undefined }) as any;
const res = { output: "ok", provider: "ollama", modelSlug: "ollama-local", modelName: "q", latencyMs: 1, success: true } as any;

test("persisted log carries tenantId from request metadata", async () => {
  const { svc, created } = build();
  await svc.logInteraction(req("t1"), res);
  assert.equal(created[0].tenantId, "t1");
});

test("buffer reads are filtered by tenant; other tenants and untagged rows are invisible", async () => {
  const { svc } = build();
  await svc.logInteraction(req("t1"), res);
  await svc.logInteraction(req("t2"), res);
  await svc.logInteraction(req(), res);
  assert.equal(svc.getRecentLogs("t1").length, 1);
  assert.equal(svc.getRecentLogs("t1")[0]!.tenantId, "t1");
  assert.equal(svc.getRecentLogs("t3").length, 0);
});

test("DB reads (logs + stats) always include the tenant in every query", async () => {
  const { svc, wheres } = build();
  await svc.getDbLogs("t1", 10);
  await svc.getStats("t1");
  assert.ok(wheres.length >= 5);
  for (const w of wheres) assert.equal(w?.tenantId, "t1");
});
