import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  RawBody,
  UnauthorizedException,
} from "@nestjs/common";
import { Public } from "../../common/public.decorator.js";
import { LiveKitService } from "./livekit.service.js";
import { LiveSessionsService } from "./live-sessions.service.js";

/** `live-session:<tenantId>:<sessionId>` -> {tenantId, sessionId} */
function parseRoom(room: string): { tenantId: string; sessionId: string } | null {
  const m = /^live-session:([^:]+):([^:]+)$/.exec(room);
  return m ? { tenantId: m[1], sessionId: m[2] } : null;
}

/**
 * Recibe los webhooks de LiveKit y traduce `room_started` / `room_finished` /
 * error a transiciones de la FSM (spec §6, ADR-026). La autoridad es la firma
 * del webhook — no hay sesión de usuario aquí.
 */
@Controller()
export class LiveKitWebhookController {
  private readonly logger = new Logger(LiveKitWebhookController.name);

  constructor(
    private readonly livekit: LiveKitService,
    private readonly sessions: LiveSessionsService,
  ) {}

  @Post("v1/prometeo/live-sessions/webhooks/livekit")
  @Public()
  async handle(
    @Headers("authorization") auth: string | undefined,
    @Body() body: Record<string, unknown>,
    @RawBody() rawBody?: Buffer,
  ) {
    if (!rawBody) {
      throw new BadRequestException("raw request body required for LiveKit webhook signature verification");
    }
    if (!this.livekit.verifyWebhook(auth, rawBody)) {
      throw new UnauthorizedException("invalid LiveKit webhook signature");
    }
    const event = typeof body.event === "string" ? body.event : "";
    const room = (body.room as { name?: string } | undefined)?.name ?? "";
    const parsed = parseRoom(room);
    if (!parsed) throw new BadRequestException(`unrecognized room name: ${room}`);

    const correlationId = `livekit:${(body.id as string) ?? event}`;
    switch (event) {
      case "room_started":
      case "participant_joined":
        await this.sessions.driveFromWebhook(parsed.tenantId, parsed.sessionId, "ACTIVE", correlationId);
        break;
      case "room_finished":
        await this.sessions.driveFromWebhook(parsed.tenantId, parsed.sessionId, "ENDED", correlationId);
        break;
      default:
        this.logger.debug(`ignoring LiveKit event '${event}' for ${parsed.sessionId}`);
    }
    return { received: true };
  }
}
