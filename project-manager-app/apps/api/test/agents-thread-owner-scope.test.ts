import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { AgentsService } from "../dist/modules/agents/agents.service.js";
import { createThread, getThread } from "../dist/common/chat-thread.store.js";

function service() {
  const llm = { isAvailable: false };
  return new AgentsService(
    {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, llm as never, {} as never,
  );
}

test("Project Copilot tool chat never reuses another tenant's or user's thread", async () => {
  const svc = service();
  const privateThread = createThread({ tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot", projectId: "project-A" });
  const priorCount = privateThread.messages.length;
  for (const denied of [
    { tenantId: "tenant-B", userId: "owner-A" },
    { tenantId: "tenant-A", userId: "other-user" },
  ]) {
    await assert.rejects(
      () => svc.chatWithTools({
        ...denied, agentId: "project-copilot", projectId: "project-A", threadId: privateThread.id,
        message: "Can I read the previous confidential discussion?", localOnly: true, tools: [],
      }),
      (e: any) => e.getStatus?.() === 404,
    );
  }
  assert.equal(getThread(privateThread.id)?.messages.length, priorCount,
    "denied callers must not mutate or receive private chat history");
});

test("thread ID cannot be reused across different agents even by the same user", async () => {
  const svc = service();
  const thread = createThread({ tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot", projectId: "project-A" });
  await assert.rejects(
    () => svc.chatWithTools({
      tenantId: "tenant-A", userId: "owner-A", agentId: "other-agent",
      threadId: thread.id, message: "Inject other agent transcript", tools: [],
    }),
    (e: any) => e.getStatus?.() === 404,
  );
});

test("plain agent chat rejects cross-user thread reuse, and getThreadMessages respects user ownership", async () => {
  const svc = service();
  const thread = createThread({ tenantId: "tenant-A", userId: "owner-A", agentId: "assistant" });
  await assert.rejects(
    () => svc.chat({
      tenantId: "tenant-A", userId: "other-user", threadId: thread.id,
      message: "Read private history",
    }),
    (e: any) => e.getStatus?.() === 404,
  );
  assert.throws(
    () => svc.getThreadMessages({ tenantId: "tenant-A", userId: "other-user", threadId: thread.id }),
    (e: any) => e.getStatus?.() === 404,
  );
});

test("authorized owner can resume its own thread and read it", async () => {
  const svc = service();
  const thread = createThread({ tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot", projectId: "project-A" });
  const reply = await svc.chatWithTools({
    tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot", projectId: "project-A",
    threadId: thread.id, message: "Continue project plan", localOnly: true, tools: [],
  });
  assert.equal(reply.threadId, thread.id);
  assert.throws(
    () => svc.getThreadMessages({ tenantId: "tenant-A", userId: "owner-A", threadId: thread.id }),
    (e: any) => e.getStatus?.() === 404,
    "generic thread reads cannot revalidate current private project membership",
  );
});

test("owner cannot reuse a private Copilot history across its own projects", async () => {
  const svc = service();
  const projectThread = createThread({
    tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot", projectId: "project-A",
  });
  const priorCount = projectThread.messages.length;
  await assert.rejects(
    () => svc.chatWithTools({
      tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot",
      projectId: "project-B", threadId: projectThread.id,
      message: "Summarize the other project's confidential evidence", localOnly: true, tools: [],
    }),
    (e: any) => e.getStatus?.() === 404,
  );
  assert.equal(getThread(projectThread.id)?.messages.length, priorCount);
});

test("project copilot never starts a private chat without a project boundary", async () => {
  const svc = service();
  await assert.rejects(
    () => svc.chatWithTools({
      tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot",
      message: "Show evidence", localOnly: true, tools: [],
    }),
    (e: any) => e.getStatus?.() === 403,
  );
});

test("generic agent endpoint cannot enter or start Project Copilot history", async () => {
  const svc = service();
  const thread = createThread({
    tenantId: "tenant-A", userId: "owner-A",
    agentId: "project-copilot", projectId: "project-A",
  });
  const count = thread.messages.length;
  await assert.rejects(
    () => svc.chat({
      tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot",
      threadId: thread.id, message: "Continue confidential discussion without a project",
    }),
    (e: any) => e.getStatus?.() === 403,
  );
  await assert.rejects(
    () => svc.chat({
      tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot",
      message: "Create unscoped project chat",
    }),
    (e: any) => e.getStatus?.() === 403,
  );
  assert.equal(getThread(thread.id)?.messages.length, count);
});

test("generic agent route refuses project-bound threads even under another agent ID", async () => {
  const svc = service();
  const unusualThread = createThread({
    tenantId: "tenant-A", userId: "owner-A", agentId: "assistant",
    projectId: "project-A",
  });
  await assert.rejects(
    () => svc.chat({
      tenantId: "tenant-A", userId: "owner-A", agentId: "assistant",
      threadId: unusualThread.id, message: "Bypass the project boundary",
    }),
    (e: any) => e.getStatus?.() === 404,
  );
});


test("generic thread list and direct reads exclude private/project-bound conversations", () => {
  const svc = service();
  const owner = { tenantId: "tenant-A", userId: "owner-A" };
  const plain = createThread({ ...owner, agentId: "assistant" });
  const scoped = createThread({ ...owner, agentId: "project-copilot", projectId: "project-A" });
  const legacy = createThread({ ...owner, agentId: "project-copilot" });
  const unusual = createThread({ ...owner, agentId: "assistant", projectId: "project-A" });
  const ids = new Set(svc.getThreadList(owner).map(t => t.id));
  assert.ok(ids.has(plain.id));
  assert.ok(!ids.has(scoped.id));
  assert.ok(!ids.has(legacy.id));
  assert.ok(!ids.has(unusual.id));
  for (const thread of [scoped, legacy, unusual]) {
    assert.throws(
      () => svc.getThreadMessages({ ...owner, threadId: thread.id }),
      (e: any) => e.getStatus?.() === 404,
    );
  }
  assert.equal(svc.getThreadMessages({ ...owner, threadId: plain.id }).id, plain.id);
});
