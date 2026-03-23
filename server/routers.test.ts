import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.openId).toBe("test-user-001");
    expect(result?.name).toBe("Test User");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

describe("protected procedures require authentication", () => {
  it("dashboard.stats throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.stats()).rejects.toThrow();
  });

  it("projects.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.projects.list()).rejects.toThrow();
  });

  it("tasks.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tasks.list()).rejects.toThrow();
  });

  it("documents.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.list()).rejects.toThrow();
  });

  it("notifications.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.list()).rejects.toThrow();
  });

  it("preferences.get throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.preferences.get()).rejects.toThrow();
  });

  it("activity.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.activity.list()).rejects.toThrow();
  });
});

describe("input validation", () => {
  it("projects.create rejects empty name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.projects.create({ name: "" })
    ).rejects.toThrow();
  });

  it("projects.create rejects name longer than 255 chars", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.projects.create({ name: "a".repeat(256) })
    ).rejects.toThrow();
  });

  it("tasks.create rejects empty title", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tasks.create({ title: "" })
    ).rejects.toThrow();
  });

  it("documents.create rejects empty title", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.documents.create({ title: "" })
    ).rejects.toThrow();
  });

  it("preferences.update rejects invalid font size", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.preferences.update({ editorFontSize: 5 })
    ).rejects.toThrow();
  });

  it("preferences.update rejects invalid tab size", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.preferences.update({ editorTabSize: 10 })
    ).rejects.toThrow();
  });

  it("ai.generateComments rejects empty code", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.generateComments({ code: "" })
    ).rejects.toThrow();
  });

  it("ai.analyzeCode validates analysisType enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.analyzeCode({ code: "test", analysisType: "invalid" as any })
    ).rejects.toThrow();
  });
});

describe("files procedures require authentication", () => {
  it("files.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.files.list({ projectId: 1 })).rejects.toThrow();
  });

  it("files.create throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.files.create({ projectId: 1, name: "test.ts", type: "file" })
    ).rejects.toThrow();
  });
});

describe("files input validation", () => {
  it("files.create rejects empty name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.files.create({ projectId: 1, name: "", type: "file" })
    ).rejects.toThrow();
  });

  it("files.create rejects invalid type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.files.create({ projectId: 1, name: "test", type: "invalid" as any })
    ).rejects.toThrow();
  });
});

describe("notifications procedures require authentication", () => {
  it("notifications.markRead throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.markRead({ id: 1 })).rejects.toThrow();
  });

  it("notifications.markAllRead throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.markAllRead()).rejects.toThrow();
  });
});

describe("ai input validation", () => {
  it("ai.generateDocs rejects empty code", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.generateDocs({ code: "" })
    ).rejects.toThrow();
  });

  it("ai.analyzeCode rejects invalid analysisType", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.analyzeCode({ code: "const x = 1;", analysisType: "nonexistent" as any })
    ).rejects.toThrow();
  });
});

describe("projects input validation extended", () => {
  it("projects.update rejects invalid status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.projects.update({ id: 1, status: "invalid" as any })
    ).rejects.toThrow();
  });
});

describe("tasks input validation extended", () => {
  it("tasks.create rejects invalid priority", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tasks.create({ title: "Test", priority: "invalid" as any })
    ).rejects.toThrow();
  });

  it("tasks.create rejects invalid status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tasks.create({ title: "Test", status: "invalid" as any })
    ).rejects.toThrow();
  });
});
