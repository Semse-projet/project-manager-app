import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { disconnectGoogle, getGoogleStatus } from "./_core/google";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  google: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return getGoogleStatus(ctx.user.id);
    }),
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      disconnectGoogle(ctx.user.id);
      return { success: true } as const;
    }),
  }),

  // ---- Dashboard ----
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return db.getDashboardStats(ctx.user.id);
    }),
    recentActivity: protectedProcedure.query(async ({ ctx }) => {
      return db.getActivityLog(ctx.user.id, 20);
    }),
  }),

  // ---- Projects ----
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getProjects(ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      return db.getProject(input.id, ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      language: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const project = await db.createProject({ userId: ctx.user.id, ...input });
      await db.logActivity({ userId: ctx.user.id, projectId: project?.id, action: "created", entityType: "project", entityId: project?.id, details: `Created project "${input.name}"` });
      return project;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      language: z.string().optional(),
      status: z.enum(["active", "archived", "deleted"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await db.updateProject(id, ctx.user.id, data);
      await db.logActivity({ userId: ctx.user.id, projectId: id, action: "updated", entityType: "project", entityId: id });
      return project;
    }),
  }),

  // ---- Files ----
  files: router({
    list: protectedProcedure.input(z.object({
      projectId: z.number(),
      parentId: z.number().nullable().optional(),
    })).query(async ({ input }) => {
      return db.getProjectFiles(input.projectId, input.parentId ?? null);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getFileById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      projectId: z.number(),
      parentId: z.number().nullable().optional(),
      name: z.string().min(1).max(255),
      type: z.enum(["file", "folder"]),
      content: z.string().optional(),
      language: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const file = await db.createFile(input);
      await db.logActivity({ userId: ctx.user.id, projectId: input.projectId, action: "created", entityType: input.type, entityId: file?.id, details: `Created ${input.type} "${input.name}"` });
      return file;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      content: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const file = await db.updateFile(id, data);
      if (file) {
        await db.logActivity({ userId: ctx.user.id, projectId: file.projectId, action: "updated", entityType: "file", entityId: id, details: `Updated file "${file.name}"` });
      }
      return file;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const file = await db.getFileById(input.id);
      if (file) {
        await db.deleteFile(input.id);
        await db.logActivity({ userId: ctx.user.id, projectId: file.projectId, action: "deleted", entityType: "file", entityId: input.id, details: `Deleted "${file.name}"` });
      }
      return { success: true };
    }),
    uploadToS3: protectedProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const file = await db.getFileById(input.id);
      if (!file || !file.content) return null;
      const key = `projects/${file.projectId}/files/${file.id}-${nanoid(6)}/${file.name}`;
      const { url } = await storagePut(key, file.content, "text/plain");
      await db.updateFile(input.id, { s3Url: url, s3Key: key });
      return { url, key };
    }),
  }),

  // ---- Documents ----
  documents: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      return db.getDocuments(ctx.user.id, input?.projectId);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      return db.getDocument(input.id, ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      projectId: z.number().optional(),
      title: z.string().min(1).max(255),
      content: z.string().optional(),
      type: z.enum(["note", "documentation", "generated"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const doc = await db.createDocument({ userId: ctx.user.id, ...input });
      await db.logActivity({ userId: ctx.user.id, projectId: input.projectId, action: "created", entityType: "document", entityId: doc?.id, details: `Created document "${input.title}"` });
      return doc;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await db.getDocument(id, ctx.user.id);
      const doc = await db.updateDocument(id, ctx.user.id, data);
      if (existing && data.content && data.content !== existing.content) {
        const versions = await db.getDocumentVersions(id);
        await db.createDocumentVersion({
          documentId: id, userId: ctx.user.id, content: existing.content ?? "",
          versionNumber: versions.length + 1, changeDescription: "Auto-saved version",
        });
      }
      return doc;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.deleteDocument(input.id, ctx.user.id);
      return { success: true };
    }),
    versions: protectedProcedure.input(z.object({ documentId: z.number() })).query(async ({ input }) => {
      return db.getDocumentVersions(input.documentId);
    }),
  }),

  // ---- Tasks ----
  tasks: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      return db.getTasks(ctx.user.id, input?.projectId);
    }),
    create: protectedProcedure.input(z.object({
      projectId: z.number().optional(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const task = await db.createTask({ userId: ctx.user.id, ...input });
      await db.logActivity({ userId: ctx.user.id, projectId: input.projectId, action: "created", entityType: "task", entityId: task?.id, details: `Created task "${input.title}"` });
      return task;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const task = await db.updateTask(id, ctx.user.id, data);
      return task;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.deleteTask(input.id, ctx.user.id);
      return { success: true };
    }),
  }),

  // ---- AI ----
  ai: router({
    generateComments: protectedProcedure.input(z.object({
      code: z.string().min(1),
      language: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are an expert code documentation assistant. Analyze the provided code and add comprehensive, descriptive comments in the same programming language. Return ONLY the code with added comments. Use the language's comment syntax. Write comments in Spanish. Keep the original code intact.` },
          { role: "user", content: `Language: ${input.language || "auto-detect"}\n\nCode:\n\`\`\`\n${input.code}\n\`\`\`` },
        ],
      });
      const content = response.choices[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter(c => c.type === "text").map(c => (c as any).text).join("") : "";
      await db.logActivity({ userId: ctx.user.id, action: "ai_comment", entityType: "code", details: "Generated AI comments" });
      return { commentedCode: text.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "") };
    }),
    generateDocs: protectedProcedure.input(z.object({
      code: z.string().min(1),
      language: z.string().optional(),
      projectName: z.string().optional(),
    })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a technical documentation generator. Analyze the provided code and generate comprehensive Markdown documentation. Include: overview, function/class descriptions, parameters, return values, usage examples, and dependencies. Write in Spanish. Use proper Markdown formatting with headers, code blocks, and tables.` },
          { role: "user", content: `Project: ${input.projectName || "Project"}\nLanguage: ${input.language || "auto-detect"}\n\nCode:\n\`\`\`\n${input.code}\n\`\`\`` },
        ],
      });
      const content = response.choices[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter(c => c.type === "text").map(c => (c as any).text).join("") : "";
      return { documentation: text };
    }),
    analyzeCode: protectedProcedure.input(z.object({
      code: z.string().min(1),
      language: z.string().optional(),
      analysisType: z.enum(["refactor", "bugs", "tests", "general"]),
    })).mutation(async ({ input }) => {
      const prompts: Record<string, string> = {
        refactor: "Analyze the code and suggest specific refactoring improvements. For each suggestion, explain why it improves the code and provide the refactored version. Write in Spanish.",
        bugs: "Analyze the code for potential bugs, security vulnerabilities, and edge cases. For each issue found, explain the problem, its severity, and provide a fix. Write in Spanish.",
        tests: "Generate comprehensive unit tests for the provided code. Use the appropriate testing framework for the language. Include edge cases, error handling, and boundary conditions. Write test descriptions in Spanish.",
        general: "Provide a comprehensive code review including: code quality assessment, potential improvements, best practices violations, performance considerations, and overall architecture feedback. Write in Spanish.",
      };
      const response = await invokeLLM({
        messages: [
          { role: "system", content: prompts[input.analysisType] },
          { role: "user", content: `Language: ${input.language || "auto-detect"}\n\nCode:\n\`\`\`\n${input.code}\n\`\`\`` },
        ],
      });
      const content = response.choices[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter(c => c.type === "text").map(c => (c as any).text).join("") : "";
      return { analysis: text };
    }),
    chat: protectedProcedure.input(z.object({
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      })),
    })).mutation(async ({ input }) => {
      const response = await invokeLLM({ messages: input.messages });
      const content = response.choices[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter(c => c.type === "text").map(c => (c as any).text).join("") : "";
      return { response: text };
    }),
  }),

  // ---- Preferences ----
  preferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserPreferences(ctx.user.id);
    }),
    update: protectedProcedure.input(z.object({
      theme: z.enum(["light", "dark"]).optional(),
      editorFontSize: z.number().min(10).max(32).optional(),
      editorTabSize: z.number().min(1).max(8).optional(),
      editorWordWrap: z.boolean().optional(),
      editorMinimap: z.boolean().optional(),
      editorLineNumbers: z.boolean().optional(),
      aiAutoComment: z.boolean().optional(),
      aiLanguage: z.string().optional(),
      keyboardShortcuts: z.any().optional(),
    })).mutation(async ({ ctx, input }) => {
      return db.upsertUserPreferences(ctx.user.id, input);
    }),
  }),

  // ---- Notifications ----
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserNotifications(ctx.user.id);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ---- Activity ----
  activity: router({
    list: protectedProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      return db.getActivityLog(ctx.user.id, input?.limit ?? 50);
    }),
  }),
});

export type AppRouter = typeof appRouter;
