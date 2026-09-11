import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Req,
  Sse,
} from "@nestjs/common";
import { Observable, from, interval, merge, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { LiveSessionsService, type LiveSessionActor } from "./live-sessions.service.js";
import { LiveKitService } from "./livekit.service.js";

type RequestLike = { headers?: Record<string, unknown> };

const KEEPALIVE_MS = 20_000;

@Controller()
export class LiveSessionsController {
  constructor(
    private readonly service: LiveSessionsService,
    private readonly livekit: LiveKitService,
    private readonly sse: SseEventBusService,
  ) {}

  private actor(req: RequestLike): LiveSessionActor {
    const c = resolveRequestContext(req);
    return { userId: c.userId, tenantId: c.tenantId, orgId: c.orgId, roles: c.roles };
  }

  @Post("v1/prometeo/live-sessions")
  @RequirePermissions("live_sessions:write")
  async create(@Req() req: RequestLike, @Body() body: Record<string, unknown>) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(requestId, await this.service.create(this.actor(req), requestId, body));
  }

  @Get("v1/prometeo/live-sessions/:sessionId")
  @RequirePermissions("live_sessions:read")
  async get(@Req() req: RequestLike, @Param("sessionId") sessionId: string) {
    return ok(resolveRequestId(req.headers ?? {}), await this.service.get(this.actor(req), sessionId));
  }

  @Get("v1/prometeo/live-sessions/:sessionId/participants")
  @RequirePermissions("live_sessions:read")
  async participants(@Req() req: RequestLike, @Param("sessionId") sessionId: string) {
    return ok(
      resolveRequestId(req.headers ?? {}),
      await this.service.listParticipants(this.actor(req), sessionId),
    );
  }

  @Post("v1/prometeo/live-sessions/:sessionId/participants")
  @RequirePermissions("live_sessions:write")
  async addParticipant(
    @Req() req: RequestLike,
    @Param("sessionId") sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(requestId, await this.service.addParticipant(this.actor(req), requestId, sessionId, body));
  }

  @Get("v1/prometeo/live-sessions/:sessionId/media-token")
  @RequirePermissions("live_sessions:read")
  async mediaToken(@Req() req: RequestLike, @Param("sessionId") sessionId: string) {
    const actor = this.actor(req);
    const row = await this.service.assertCanIssueMediaToken(actor, sessionId);
    const ttlSeconds = row.expiresAt
      ? Math.max(60, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000))
      : 60 * 60;
    const token = this.livekit.createParticipantToken({
      tenantId: actor.tenantId,
      sessionId: row.id,
      userId: actor.userId,
      ttlSeconds,
    });
    return ok(resolveRequestId(req.headers ?? {}), token);
  }

  @Post("v1/prometeo/live-sessions/:sessionId/transition")
  @RequirePermissions("live_sessions:write")
  async transition(
    @Req() req: RequestLike,
    @Param("sessionId") sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(requestId, await this.service.transition(this.actor(req), requestId, sessionId, body));
  }

  /**
   * Driver `PERMISSION_PENDING -> CONNECTING`. v1: transiciona cuando lo llama
   * cualquier participante activo tras conceder permisos de cámara/mic. El
   * refinamiento "todos los participantes listos" queda como TODO (spec §6).
   */
  @Post("v1/prometeo/live-sessions/:sessionId/participant-ready")
  @RequirePermissions("live_sessions:write")
  async participantReady(
    @Req() req: RequestLike,
    @Param("sessionId") sessionId: string,
    @Body() body: { expectedVersion?: number },
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(
      requestId,
      await this.service.markReady(this.actor(req), requestId, sessionId, Number(body?.expectedVersion)),
    );
  }

  /**
   * Barrido de sesiones vencidas -> terminal. Lo dispara `apps/worker` cada
   * minuto (kill switch `LIVE_SESSION_SWEEP_ENABLED`). También disponible para
   * disparo manual — mismo patrón que `POST /v1/reservations/sweep-expired`.
   */
  @Post("v1/prometeo/live-sessions/sweep-expired")
  @RequirePermissions("live_sessions:write")
  async sweepExpired(@Req() req: RequestLike, @Body() body: { maxItems?: number }) {
    const closed = await this.service.sweepExpired(new Date(), Number(body?.maxItems) || 100);
    return ok(resolveRequestId(req.headers ?? {}), { closed });
  }

  @Sse("v1/prometeo/live-sessions/:sessionId/events")
  @RequirePermissions("live_sessions:read")
  events(@Req() req: RequestLike, @Param("sessionId") sessionId: string): Observable<MessageEvent> {
    const actor = this.actor(req);
    const initial$ = from(this.service.get(actor, sessionId)).pipe(
      map((session) => ({ data: JSON.stringify(session), type: "live_session.snapshot.v1" }) as MessageEvent),
      switchMap((snapshot) => {
        const push$ = this.sse
          .on<unknown>(`live-session:${actor.tenantId}:${sessionId}`)
          .pipe(map((e) => ({ data: JSON.stringify(e.data), type: e.event }) as MessageEvent));
        const keepalive$ = interval(KEEPALIVE_MS).pipe(
          map(() => ({ data: ":keepalive", type: "keepalive" }) as MessageEvent),
        );
        return merge(of(snapshot), push$, keepalive$);
      }),
      catchError(() =>
        of({ data: JSON.stringify({ sessionId }), type: "live_session.error.v1" } as MessageEvent),
      ),
    );
    return initial$;
  }
}
