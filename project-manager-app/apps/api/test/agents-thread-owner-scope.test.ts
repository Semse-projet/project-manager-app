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
  const privateThread = createThread({ tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot" });
  const priorCount = privateThread.messages.length;
  for (const denied of [
    { tenantId: "tenant-B", userId: "owner-A" },
    { tenantId: "tenant-A", userId: "other-user" },
  ]) {
    await assert.rejects(
      () => svc.chatWithTools({
        ...denied, agentId: "project-copilot", threadId: privateThread.id,
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
  const thread = createThread({ tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot" });
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
  const thread = createThread({ tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot" });
  const reply = await svc.chatWithTools({
    tenantId: "tenant-A", userId: "owner-A", agentId: "project-copilot",
    threadId: thread.id, message: "Continue project plan", localOnly: true, tools: [],
  });
  assert.equal(reply.threadId, thread.id);
  assert.equal(svc.getThreadMessages({ tenantId: "tenant-A", userId: "owner-A", threadId: thread.id }).id, thread.id);
});
