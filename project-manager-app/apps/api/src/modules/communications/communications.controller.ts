import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, RawBody, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import { CommunicationProvider, CommunicationThreadStatus } from "@prisma/client";
import {
  communicationChannelAccountCreateSchema,
  communicationInboundMessageSchema,
  communicationMessageTemplateCreateSchema,
  communicationSendMessageSchema,
} from "@semse/schemas";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { Public } from "../../common/public.decorator.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { CommunicationsService } from "./communications.service.js";
import type { CommunicationsActor } from "./communications.types.js";
import { WhatsAppCloudAdapter } from "./providers/whatsapp-cloud.adapter.js";

function actor(req: FastifyRequest): CommunicationsActor {
  const context = resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
  return {
    tenantId: context.tenantId,
    orgId: context.orgId,
    userId: context.userId,
  };
}

function parseLimit(limit?: string, fallback = 50, max = 200): number {
  if (!limit) return fallback;
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

function parseOffset(offset?: string): number {
  if (!offset) return 0;
  const parsed = Number(offset);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

@Controller("v1/communications")
export class CommunicationsController {
  constructor(
    private readonly communications: CommunicationsService,
    private readonly whatsapp: WhatsAppCloudAdapter,
  ) {}

  @Post("channel-accounts")
  @RequirePermissions("communications:admin")
  async createChannelAccount(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const input = parseWithSchema(communicationChannelAccountCreateSchema, body);
    const created = await this.communications.createChannelAccount(actor(req), {
      ...input,
      provider: input.provider as CommunicationProvider,
    });
    return ok(rid, created);
  }

  @Get("channel-accounts")
  @RequirePermissions("communications:read")
  async listChannelAccounts(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.communications.listChannelAccounts(actor(req)));
  }

  @Post("templates")
  @RequirePermissions("communications:admin")
  async createTemplate(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const input = parseWithSchema(communicationMessageTemplateCreateSchema, body);
    const template = await this.communications.createTemplate(actor(req), {
      ...input,
      channel: input.channel as CommunicationProvider,
      locale: input.locale ?? "es",
      category: input.category ?? "utility",
      status: input.status ?? "draft",
    });
    return ok(rid, template);
  }

  @Get("templates")
  @RequirePermissions("communications:read")
  async listTemplates(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.communications.listTemplates(actor(req)));
  }

  @Get("threads")
  @RequirePermissions("communications:read")
  async listThreads(
    @Req() req: FastifyRequest,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsedStatus = status && status in CommunicationThreadStatus
      ? status as CommunicationThreadStatus
      : undefined;
    const threads = await this.communications.listThreads(actor(req), {
      status: parsedStatus,
      limit: parseLimit(limit),
      offset: parseOffset(offset),
    });
    return ok(rid, threads);
  }

  @Get("threads/:threadId/messages")
  @RequirePermissions("communications:read")
  async listMessages(
    @Req() req: FastifyRequest,
    @Param("threadId") threadId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const messages = await this.communications.listMessages(actor(req), {
      threadId,
      limit: parseLimit(limit, 100, 500),
      offset: parseOffset(offset),
    });
    return ok(rid, messages);
  }

  @Patch("threads/:threadId")
  @RequirePermissions("communications:write")
  async updateThread(
    @Req() req: FastifyRequest,
    @Param("threadId") threadId: string,
    @Body() body: unknown,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const input = body as Record<string, unknown>;
    const result = await this.communications.updateThread(actor(req), threadId, {
      status: typeof input.status === "string" ? input.status as CommunicationThreadStatus : undefined,
      assignedToUserId: typeof input.assignedToUserId === "string" ? input.assignedToUserId : undefined,
      intent: typeof input.intent === "string" ? input.intent : undefined,
    });
    return ok(rid, result);
  }

  @Post("inbound")
  @RequirePermissions("communications:write")
  async receiveInbound(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const input = parseWithSchema(communicationInboundMessageSchema, body);
    const result = await this.communications.receiveInbound(actor(req), {
      ...input,
      channel: input.channel as CommunicationProvider,
    });
    return ok(rid, result);
  }

  @Post("send")
  @RequirePermissions("communications:write")
  async send(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const input = parseWithSchema(communicationSendMessageSchema, body);
    const result = await this.communications.sendMessage(actor(req), {
      ...input,
      channel: input.channel as CommunicationProvider,
    });
    return ok(rid, result);
  }

  @Get("webhooks/whatsapp")
  @Public()
  verifyWhatsAppWebhook(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") token: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    const response = this.communications.verifyWhatsAppWebhook({ mode, token, challenge });
    return reply.type("text/plain").send(response);
  }

  @Post("webhooks/whatsapp")
  @Public()
  async receiveWhatsAppWebhook(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
    @RawBody() rawBody?: Buffer,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    if (!this.whatsapp.appSecret && this.whatsapp.requiresWebhookSignature) {
      throw new ServiceUnavailableException("WHATSAPP_APP_SECRET is not configured");
    }

    const validSignature = this.whatsapp.validateWebhookSignature({
      payload: rawBody,
      signatureHeader: singleHeader(req.headers["x-hub-signature-256"]),
    });
    if (!validSignature) {
      throw new ForbiddenException("Invalid WhatsApp webhook signature");
    }

    return ok(rid, await this.communications.handleWhatsAppWebhook(body));
  }
}
