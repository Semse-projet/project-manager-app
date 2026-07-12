import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { PrometeoController } from "../dist/modules/prometeo/prometeo.controller.js";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";

function createController() {
  const calls: Array<Record<string, unknown>> = [];
  const svc = {
    async ingestText(input: Record<string, unknown>) {
      calls.push({ method: "ingestText", input });
      return { id: "doc_1", status: "indexed", chunks: 3 };
    },
    async ingestFile(input: Record<string, unknown>) {
      calls.push({ method: "ingestFile", input });
      return { id: "doc_2", status: "indexed", chunks: 2 };
    },
    async getTradeLibrary(tenantId: string) {
      calls.push({ method: "getTradeLibrary", tenantId });
      return [{ documentId: "doc_1", title: "Guide", trade: "electrical", chunkCount: 2 }];
    },
    async listDocuments(tenantId: string, projectId?: string) {
      calls.push({ method: "listDocuments", tenantId, projectId });
      return [{ id: "doc_1", status: "indexed", metadataJson: { trade: "electrical" } }];
    },
    async deleteDocument(input: Record<string, unknown>) {
      calls.push({ method: "deleteDocument", input });
      return undefined;
    },
    async search(input: Record<string, unknown>) {
      calls.push({ method: "search", input });
      return [{ documentId: "doc_1", documentTitle: "Guide", chunkId: "chunk_1", text: "NEC guidance", score: 0.92 }];
    },
    async buildRagContext(input: Record<string, unknown>) {
      calls.push({ method: "buildRagContext", input });
      return {
        contextBlock: "## Context",
        chunks: [{ documentId: "doc_1", documentTitle: "Guide", chunkId: "chunk_1", text: "NEC guidance", score: 0.92, chunkIndex: 0 }],
      };
    },
    async createAsset(input: Record<string, unknown>) {
      calls.push({ method: "createAsset", input });
      return { id: "asset_1", url: "https://example.com/a.png" };
    },
    async listAssets(input: Record<string, unknown>) {
      calls.push({ method: "listAssets", input });
      return [{ id: "asset_1" }];
    },
    async updateAssetStatus(input: Record<string, unknown>) {
      calls.push({ method: "updateAssetStatus", input });
      return { id: String(input.id ?? "asset_1"), status: String(input.status ?? "active") };
    },
    async createWorkOrder(input: Record<string, unknown>) {
      calls.push({ method: "createWorkOrder", input });
      return { id: "wo_1", title: String(input.title ?? "OT") };
    },
    async listWorkOrders(input: Record<string, unknown>) {
      calls.push({ method: "listWorkOrders", input });
      return [{ id: "wo_1" }];
    },
    async updateWorkOrderStatus(input: Record<string, unknown>) {
      calls.push({ method: "updateWorkOrderStatus", input });
      return { id: String(input.id ?? "wo_1"), status: String(input.status ?? "open") };
    },
    async getEmbeddingRagHealth(tenantId: string) {
      calls.push({ method: "getEmbeddingRagHealth", tenantId });
      return { tenantId, healthy: true };
    },
    async backfillEmbeddings(input: Record<string, unknown>) {
      calls.push({ method: "backfillEmbeddings", input });
      return { backfilled: 1 };
    },
  } as never;

  const tradeGuide = {
    async guide(input: Record<string, unknown>) {
      calls.push({ method: "tradeGuide", input });
      return { answer: "ok", steps: [], materials: [], citations: [] };
    },
  } as never;

  const toolExecution = {
    async invokeReadTool(actor: Record<string, unknown>, requestId: string, invocation: Record<string, unknown>) {
      calls.push({ method: "invokeReadTool", actor, requestId, invocation });
      return {
        id: "exec_1",
        namespace: String(invocation.namespace ?? "time_tracker"),
        tool: String(invocation.name ?? "get_status"),
        status: "succeeded",
        output: { data: { ok: true } },
      };
    },
  } as never;

  return { controller: new PrometeoController(svc, undefined, tradeGuide, toolExecution), calls };
}

test("prometeo controller declares permissions and wraps representative payloads", async () => {
  const expectations: Array<[string, string]> = [
    ["ingest", "agents:run:create"],
    ["listTools", "agents:run:create"],
    ["invokeTool", "agents:run:create"],
    ["ingestFile", "agents:run:create"],
    ["getTradeLibrary", "agents:run:create"],
    ["listDocuments", "agents:run:create"],
    ["deleteDocument", "agents:run:create"],
    ["search", "agents:run:create"],
    ["ragContext", "agents:run:create"],
    ["ragQuery", "agents:run:create"],
    ["runTradeGuide", "agents:run:create"],
    ["createAsset", "agents:run:create"],
    ["listAssets", "agents:run:create"],
    ["updateAssetStatus", "agents:run:create"],
    ["createWorkOrder", "agents:run:create"],
    ["listWorkOrders", "agents:run:create"],
    ["updateWorkOrderStatus", "agents:run:create"],
    ["embeddingsHealth", "agents:run:create"],
    ["backfillEmbeddings", "agents:run:create"],
    ["submitFeedback", "agents:run:create"],
  ];

  for (const [methodName, permission] of expectations) {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, PrometeoController.prototype[methodName]);
    assert.deepEqual(metadata, [permission]);
  }

  const { controller, calls } = createController();
  const actor = {
    headers: { "x-request-id": "req_prm_1" },
    authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "usr_1", roles: ["CLIENT"] },
  };

  const ingested = await controller.ingest(actor as never, { title: "Guide", text: "NEC content", trade: "electrical" });
  const tools = await controller.listTools(actor as never);
  const invoked = await controller.invokeTool(actor as never, { namespace: "time_tracker", name: "get_status", input: {} });
  const documents = await controller.listDocuments(actor as never, undefined, "electrical");
  const search = await controller.search(actor as never, { query: "NEC", trade: "electrical", topK: 1 });
  const ragContext = await controller.ragContext(actor as never, { query: "NEC", trade: "electrical" });
  const ragQuery = await controller.ragQuery(actor as never, { question: "What is NEC?", trade: "electrical" });
  const guide = await controller.runTradeGuide(actor as never, { question: "How to wire?", trade: "electrical" });
  const asset = await controller.createAsset(actor as never, { name: "photo" });
  const health = await controller.embeddingsHealth(actor as never);

  assert.equal(ingested.requestId, "req_prm_1");
  assert.ok(tools.data.tools.some((tool: { namespace?: string; name?: string }) => tool.namespace === "time_tracker" && tool.name === "get_status"));
  assert.equal(invoked.data.status, "succeeded");
  assert.ok(calls.some((call) => call.method === "invokeReadTool"));
  assert.equal(documents.data[0]?.metadataJson.trade, "electrical");
  assert.equal(search.data[0]?.documentId, "doc_1");
  assert.equal(ragContext.data.chunks[0]?.documentId, "doc_1");
  assert.equal(ragQuery.data.citations[0]?.id, "doc_1");
  assert.equal(ragQuery.data.documentsSearched, 1);
  assert.equal(guide.data.answer, "ok");
  assert.equal(asset.data.id, "asset_1");
  assert.equal(health.data.healthy, true);
  assert.ok(calls.some((call) => call.method === "ingestText"));
  assert.ok(calls.some((call) => call.method === "buildRagContext"));
  assert.ok(calls.some((call) => call.method === "tradeGuide"));
});

test("prometeo tool execution runs only read adapters and blocks pending video pipeline", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const fieldOps = {
    async getTrackerBootstrap(input: Record<string, unknown>) {
      calls.push({ method: "getTrackerBootstrap", input });
      return { activeSession: null, recentSessions: [], jobs: [], summaries: {} };
    },
    async listTrackerJobs(input: Record<string, unknown>) {
      calls.push({ method: "listTrackerJobs", input });
      return [{ id: "job_1", title: "Drywall" }];
    },
    async getTrackerSummary(input: Record<string, unknown>) {
      calls.push({ method: "getTrackerSummary", input });
      return { range: input.range, totalSeconds: 0 };
    },
    async listTrackerSessions(input: Record<string, unknown>) {
      calls.push({ method: "listTrackerSessions", input });
      return [];
    },
  } as never;
  const agroFarms = {
    async listFarms(ownerId: string) {
      calls.push({ method: "listFarms", ownerId });
      return [];
    },
    async getFarm(farmId: string, ownerId: string) {
      calls.push({ method: "getFarm", farmId, ownerId });
      return { id: farmId, ownerId };
    },
  } as never;
  const agroAnimals = {
    async listAnimals(farmId: string, ownerId: string) {
      calls.push({ method: "listAnimals", farmId, ownerId });
      return [];
    },
    async getAnimal(animalId: string) {
      calls.push({ method: "getAnimal", animalId });
      return { id: animalId, farmId: "farm_1" };
    },
    async listGroups(farmId: string, ownerId: string) {
      calls.push({ method: "listGroups", farmId, ownerId });
      return [];
    },
  } as never;
  const agroTasks = {
    async listTasks(farmId: string, ownerId: string, filters: Record<string, unknown>) {
      calls.push({ method: "listTasks", farmId, ownerId, filters });
      return [];
    },
  } as never;
  const agroInventory = {
    async listItems(farmId: string, ownerId: string) {
      calls.push({ method: "listItems", farmId, ownerId });
      return [];
    },
    async listCosts(farmId: string, ownerId: string, filters: Record<string, unknown>) {
      calls.push({ method: "listCosts", farmId, ownerId, filters });
      return [];
    },
    async getCostSummary(farmId: string, ownerId: string, days: number) {
      calls.push({ method: "getCostSummary", farmId, ownerId, days });
      return { total: 0 };
    },
  } as never;
  const agroDashboard = {
    async getDashboard(farmId: string, ownerId: string) {
      calls.push({ method: "getDashboard", farmId, ownerId });
      return { farm: { id: farmId } };
    },
  } as never;
  const vision = {
    async getAnalysis(evidenceId: string) {
      calls.push({ method: "getAnalysis", evidenceId });
      return { evidenceId };
    },
    async getByJob(jobId: string) {
      calls.push({ method: "getByJob", jobId });
      return [];
    },
    async getByMilestone(milestoneId: string) {
      calls.push({ method: "getByMilestone", milestoneId });
      return [];
    },
  } as never;
  const service = new PrometeoToolExecutionService(
    fieldOps,
    agroFarms,
    agroAnimals,
    agroTasks,
    agroInventory,
    agroDashboard,
    vision,
  );
  const actor = { tenantId: "tenant_1", orgId: "org_1", userId: "usr_1", roles: ["CLIENT"] };

  const jobs = await service.invokeReadTool(actor, "req_tool_1", { namespace: "time_tracker", name: "list_jobs", input: {} });
  const animal = await service.invokeReadTool(actor, "req_tool_2", { namespace: "agro", name: "get_animal", input: { animalId: "animal_1" } });
  const blockedVideo = await service.invokeReadTool(actor, "req_tool_3", { namespace: "vision", name: "analyze_video", input: { videoFileId: "vid_1" } });

  assert.equal(jobs.status, "succeeded");
  assert.deepEqual((jobs.output as { data?: unknown }).data, [{ id: "job_1", title: "Drywall" }]);
  assert.equal(animal.status, "succeeded");
  assert.ok(calls.some((call) => call.method === "getFarm" && call.farmId === "farm_1" && call.ownerId === "usr_1"));
  assert.equal(blockedVideo.status, "blocked");
  assert.match(blockedVideo.errorMessage ?? "", /not wired for read execution/);

  await assert.rejects(
    () => service.invokeReadTool(actor, "req_tool_4", { namespace: "time_tracker", name: "start", input: { jobId: "job_1" } }),
    /can only invoke read tools/,
  );
});
