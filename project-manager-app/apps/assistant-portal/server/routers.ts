import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { disconnectGoogle, getGoogleStatus } from "./_core/google";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { stripe, PLANS, type PlanKey } from "./stripe";
import { encrypt, decrypt, encryptObject, decryptObject, validateCryptoSystem } from "./crypto";
import { createHash } from "crypto";

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
    })).query(async ({ ctx, input }) => {
      return db.getProjectFiles(input.projectId, input.parentId ?? null, ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      return db.getFileById(input.id, ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      projectId: z.number(),
      parentId: z.number().nullable().optional(),
      name: z.string().min(1).max(255),
      type: z.enum(["file", "folder"]),
      content: z.string().optional(),
      language: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      // Verify the project belongs to the user
      const project = await db.getProject(input.projectId, ctx.user.id);
      if (!project) return null;
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
      const file = await db.updateFile(id, data, ctx.user.id);
      if (file) {
        await db.logActivity({ userId: ctx.user.id, projectId: file.projectId, action: "updated", entityType: "file", entityId: id, details: `Updated file "${file.name}"` });
      }
      return file;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const file = await db.getFileById(input.id, ctx.user.id);
      if (file) {
        await db.deleteFile(input.id, ctx.user.id);
        await db.logActivity({ userId: ctx.user.id, projectId: file.projectId, action: "deleted", entityType: "file", entityId: input.id, details: `Deleted "${file.name}"` });
      }
      return { success: true };
    }),
    uploadToS3: protectedProcedure.input(z.object({
      id: z.number(),
      encrypted: z.boolean().optional().default(true),
    })).mutation(async ({ ctx, input }) => {
      const file = await db.getFileById(input.id, ctx.user.id);
      if (!file || !file.content) return null;
      const key = `projects/${file.projectId}/files/${file.id}-${nanoid(6)}/${file.name}`;

      // Encrypt content before uploading to remote storage
      const contentToUpload = input.encrypted
        ? encrypt(file.content)
        : file.content;

      const { url } = await storagePut(key, contentToUpload, "text/plain");
      await db.updateFile(input.id, { s3Url: url, s3Key: key }, ctx.user.id);
      return { url, key, encrypted: input.encrypted };
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
    versions: protectedProcedure.input(z.object({ documentId: z.number() })).query(async ({ ctx, input }) => {
      // Verify the document belongs to the user before returning versions
      const doc = await db.getDocument(input.documentId, ctx.user.id);
      if (!doc) return [];
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

  // ---- Billing / Stripe ----
  billing: router({
    plans: publicProcedure.query(() => {
      return Object.entries(PLANS).map(([key, plan]) => ({
        key,
        ...plan,
      }));
    }),

    subscription: protectedProcedure.query(async ({ ctx }) => {
      const sub = await db.getActiveSubscription(ctx.user.id);
      if (!sub) return null;
      return {
        ...sub,
        planKey: determinePlanKey(sub.stripePriceId),
      };
    }),

    createCheckout: protectedProcedure
      .input(z.object({
        planKey: z.enum(["pro", "team"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = PLANS[input.planKey as PlanKey];
        if (!plan || plan.price === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid plan" });
        }
        if (!stripe) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
        }

        const origin = ctx.req.headers.origin || ctx.req.headers.referer || "";

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email || undefined,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email || "",
            customer_name: ctx.user.name || "",
            plan_key: input.planKey,
          },
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: plan.name, description: plan.description },
              unit_amount: plan.price,
              recurring: { interval: plan.interval || "month" },
            },
            quantity: 1,
          }],
          allow_promotion_codes: true,
          success_url: `${origin}/billing?success=true`,
          cancel_url: `${origin}/billing?canceled=true`,
        });

        if (!session.url) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout" });
        }

        return { url: session.url };
      }),

    createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer found" });
      }
      if (!stripe) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      }

      const origin = ctx.req.headers.origin || ctx.req.headers.referer || "";

      const session = await stripe.billingPortal.sessions.create({
        customer: ctx.user.stripeCustomerId,
        return_url: `${origin}/billing`,
      });

      return { url: session.url };
    }),

    payments: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.stripeCustomerId || !stripe) return [];

      try {
        const charges = await stripe.charges.list({
          customer: ctx.user.stripeCustomerId,
          limit: 20,
        });

        return charges.data.map((charge) => ({
          id: charge.id,
          amount: charge.amount,
          currency: charge.currency,
          status: charge.status,
          description: charge.description,
          created: charge.created * 1000,
          receiptUrl: charge.receipt_url,
        }));
      } catch (error) {
        console.error("[Billing] Error fetching payments:", error);
        return [];
      }
    }),
  }),

  // ---- Encrypted Vault (Cifrado / Descifrado) ----
  vault: router({
    /**
     * RUTA 1: CIFRAR — Recibe datos en texto plano, los cifra con AES-256-GCM
     * y los almacena en la bóveda cifrada del usuario.
     */
    encrypt: protectedProcedure
      .input(z.object({
        label: z.string().min(1).max(255),
        category: z.string().max(100).optional(),
        data: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const encryptedData = encrypt(input.data);
        const checksum = createHash("sha256").update(input.data).digest("hex").slice(0, 16);

        const entry = await db.createVaultEntry({
          userId: ctx.user.id,
          label: input.label,
          category: input.category || "general",
          encryptedData,
          checksum,
        });

        return {
          id: entry.id,
          label: input.label,
          category: input.category || "general",
          checksum,
          message: "Datos cifrados y almacenados correctamente",
        };
      }),

    /**
     * RUTA 2: DESCIFRAR — Recupera un registro cifrado de la bóveda,
     * lo descifra y devuelve los datos originales al usuario.
     */
    decrypt: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const entry = await db.getVaultEntry(input.id, ctx.user.id);
        if (!entry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Registro no encontrado o no autorizado" });
        }

        try {
          const decryptedData = decrypt(entry.encryptedData);

          // Verify integrity with stored checksum
          const currentChecksum = createHash("sha256").update(decryptedData).digest("hex").slice(0, 16);
          const integrityOk = currentChecksum === entry.checksum;

          return {
            id: entry.id,
            label: entry.label,
            category: entry.category,
            data: decryptedData,
            integrityVerified: integrityOk,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al descifrar: " + error.message,
          });
        }
      }),

    /**
     * Lista todos los registros cifrados del usuario (sin revelar datos).
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getVaultEntries(ctx.user.id);
    }),

    /**
     * Elimina un registro cifrado de la bóveda.
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const entry = await db.getVaultEntry(input.id, ctx.user.id);
        if (!entry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Registro no encontrado o no autorizado" });
        }
        await db.deleteVaultEntry(input.id, ctx.user.id);
        return { success: true, message: "Registro eliminado permanentemente" };
      }),

    /**
     * Cifrado directo sin almacenamiento — cifra y devuelve el payload.
     * Útil para cifrar datos que el cliente quiere gestionar por su cuenta.
     */
    encryptInline: protectedProcedure
      .input(z.object({ data: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const encrypted = encrypt(input.data);
        const checksum = createHash("sha256").update(input.data).digest("hex").slice(0, 16);
        return { encrypted, checksum };
      }),

    /**
     * Descifrado directo — recibe un payload cifrado y devuelve el texto plano.
     */
    decryptInline: protectedProcedure
      .input(z.object({ encrypted: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          const decrypted = decrypt(input.encrypted);
          return { data: decrypted };
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Error al descifrar: " + error.message,
          });
        }
      }),

    /**
     * Verifica que el sistema de cifrado esté operativo.
     */
    status: protectedProcedure.query(() => {
      return validateCryptoSystem();
    }),
  }),
});

// Helper to determine plan key from price ID
function determinePlanKey(stripePriceId: string): string {
  // For dynamic prices (price_data), we store plan_key in subscription metadata
  // For static prices, map price IDs to plan keys here
  return "pro"; // Default fallback
}

export type AppRouter = typeof appRouter;
