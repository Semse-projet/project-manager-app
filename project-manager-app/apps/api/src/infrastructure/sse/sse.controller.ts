import { Controller, MessageEvent, Param, Query, Req, Sse } from "@nestjs/common";
import { Observable, from, interval, merge, of } from "rxjs";
import { catchError, concatMap, filter, map, startWith, switchMap } from "rxjs/operators";
import { Public } from "../../common/public.decorator.js";
import { SseEventBusService } from "./sse-event-bus.service.js";
import { HealthService } from "../../modules/health/health.service.js";
import { AgentWorkPlanService } from "../../modules/agents/agent-work-plan.service.js";
import { AgentDelegationService } from "../../modules/agents/agent-delegation.service.js";
import { ProjectAccessService } from "../../modules/agents/project-access.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { resolveRequestContext, type RequestContext } from "../../common/request-context.js";

import { RequirePermissions } from "../../common/permissions.decorator.js";
import { canReadBuildOpsEvent } from "./buildops-event-access.js";
import { canReadFinanceEvent } from "./finance-event-access.js";

const KEEPALIVE_MS = 20_000;

type SseRequest = {
  headers?: Record<string, unknown>;
  authContext?: RequestContext;
};

function keepalive$(): Observable<MessageEvent> {
  return interval(KEEPALIVE_MS).pipe(
    map(() => ({ data: ":keepalive", type: "keepalive" } as MessageEvent)),
  );
}

function toMsgEvent(data: unknown, type: string): MessageEvent {
  return { data: JSON.stringify(data), type } as MessageEvent;
}

@Controller("v1/sse")
export class SseController {
  constructor(
    private readonly bus: SseEventBusService,
    private readonly health: HealthService,
    private readonly plans: AgentWorkPlanService,
    private readonly delegations: AgentDelegationService,
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /**
   * planStream/delegationsStream used to merge in the live push$ channel
   * unconditionally — even when the initial tenant-ownership lookup failed
   * or no tenantId header was sent at all. Since the push channel key
   * (`plan:${planId}` / `delegations:${projectId}`) doesn't itself embed a
   * tenant, that meant any caller who knew/guessed a planId or projectId
   * got live cross-tenant events regardless of the snapshot check's result.
   * Both streams below now gate the push$ subscription behind the ownership
   * check succeeding — no ownership, no push channel, keepalive-only.
   *
   * WS-01C G1 finding (point 24, docs/ws-01c/WS-01C-G1-AS-IS-Reconciliation.md):
   * these streams (and contextStream/financeStream/buildopsStream below) were
   * additionally @Public() and trusted a client-supplied `x-tenant-id` header
   * as their only tenant signal — the ownership checks above were real, but
   * they checked ownership against whatever tenantId the caller claimed, not
   * against who the caller actually is. Any unauthenticated caller could set
   * that header to any tenant's id directly against the public API (the web
   * BFF's own auth doesn't protect this — it's a convenience proxy, not a
   * network boundary; the API is reachable directly). Fixed the same way
   * missionControlStream already does it correctly: no @Public(), tenantId
   * comes from resolveRequestContext's verified session/token, never from a
   * header the caller controls.
   */
  // Same permission and the same plan-access check as GET /v1/agents/plans/:planId.
  // The permission alone would let a client of another organization in the
  // tenant follow any plan whose id it knows (KIT-F3-01).
  @Sse("plans/:planId")
  @RequirePermissions("agents:run:create")
  planStream(
    @Param("planId") planId: string,
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const actor = resolveRequestContext(req);

    const visiblePlan = this.plans.findById(actor.tenantId, planId).then(async (plan) => {
      await this.projectAccess.assertPlanAccess(actor, { projectId: plan.projectId, createdBy: plan.createdBy });
      return plan;
    });

    return from(visiblePlan.catch(() => null)).pipe(
      switchMap(plan => {
        if (!plan) return keepalive$();
        const push$ = this.bus.on<unknown>(`plan:${planId}`).pipe(
          map(e => toMsgEvent(e.data, e.event)),
        );
        return merge(of(toMsgEvent(plan, "plan-update")), push$, keepalive$());
      }),
      catchError(() => keepalive$()),
    );
  }

  // Same permission as GET /v1/agents/delegations (coordinator dashboard).
  @Sse("delegations")
  @RequirePermissions("ops:coordinator:read")
  delegationsStream(
    @Query("projectId") projectId: string | undefined,
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const { tenantId } = resolveRequestContext(req);

    // No projectId → the channel is keyed by the caller's own tenantId, already safe.
    if (!projectId) {
      const push$ = this.bus.on<unknown>(`delegations:${tenantId}`).pipe(
        map(e => toMsgEvent(e.data, e.event)),
      );
      return merge(push$, keepalive$());
    }

    // projectId given → verify it actually belongs to this tenant before
    // opening the push channel. An empty delegations list isn't a safe
    // signal on its own (a legitimate new project has no delegations yet),
    // so check project ownership directly instead.
    return from(
      this.prisma.project.findFirst({ where: { id: projectId, tenantId }, select: { id: true } }),
    ).pipe(
      switchMap(project => {
        if (!project) return keepalive$();
        const push$ = this.bus.on<unknown>(`delegations:${projectId}`).pipe(
          map(e => toMsgEvent(e.data, e.event)),
        );
        const initial$ = from(this.delegations.listByProject({ tenantId, projectId }).catch(() => [])).pipe(
          map(list => toMsgEvent(list, "delegations-update")),
        );
        return merge(initial$, push$, keepalive$());
      }),
      catchError(() => keepalive$()),
    );
  }

  @Sse("health")
  @Public()
  healthStream(): Observable<MessageEvent> {
    const push$ = this.bus.on<unknown>("health").pipe(
      map(e => toMsgEvent(e.data, e.event)),
    );

    const poll$ = interval(15_000).pipe(
      startWith(0),
      map(() => toMsgEvent(this.health.getHealth(), "health-update")),
    );

    return merge(poll$, push$, keepalive$());
  }

  // Context events are tenant-wide (`context:${tenantId}:…`), not scoped to an
  // organization, so only OPS may follow them until they are filtered by org.
  // The only consumer is /admin/semse-x.
  @Sse("context")
  @RequirePermissions("ops:dashboard:read")
  contextStream(
    @Query("projectId") projectId: string | undefined,
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const { tenantId } = resolveRequestContext(req);

    return merge(
      this.bus.onPrefix<Record<string, unknown>>(`context:${tenantId}:`).pipe(
        filter((e) => {
          if (!projectId) return true;
          const eventProjectId = typeof e.data?.projectId === "string" ? e.data.projectId : null;
          return eventProjectId === null || eventProjectId === projectId;
        }),
        map(e => toMsgEvent(e.data, e.event)),
      ),
      keepalive$(),
    );
  }

  @Sse("finance")
  @RequirePermissions("finance:read")
  financeStream(
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const actor = resolveRequestContext(req);
    const channel = `finance:${actor.tenantId}`;
    return merge(
      this.bus.on<unknown>(channel).pipe(
        concatMap(e => from(canReadFinanceEvent(actor, e.data, this.prisma)).pipe(map(allowed => allowed ? e : null))),
        filter((e): e is NonNullable<typeof e> => e !== null),
        map(e => toMsgEvent(e.data, e.event)),
      ),
      keepalive$(),
    );
  }

  // Same permission as GET /v1/ops/mission-control/exceptions.
  @Sse("mission-control")
  @RequirePermissions("ops:dashboard:read")
  missionControlStream(
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const { tenantId } = resolveRequestContext(req);
    const global$ = this.bus.on<unknown>("mission-control:global").pipe(
      map(e => toMsgEvent(e.data, e.event)),
    );
    const tenant$ = this.bus.on<unknown>(`mission-control:${tenantId}`).pipe(
      map(e => toMsgEvent(e.data, e.event)),
    );

    return merge(global$, tenant$, keepalive$());
  }

  @Sse("buildops")
  @RequirePermissions("projects:read")
  buildopsStream(
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const actor = resolveRequestContext(req);
    return merge(
      this.bus.on<unknown>(`buildops:${actor.tenantId}`).pipe(
        concatMap(event => from(canReadBuildOpsEvent(this.prisma, actor, event)).pipe(
          // A failed/denied lookup drops only that event; keepalive and later
          // events continue. concatMap preserves order and stops queued work on disconnect.
          catchError(() => of(false)),
          filter(allowed => allowed),
          map(() => toMsgEvent(event.data, event.event)),
        )),
      ),
      keepalive$(),
    );
  }

  /** SEMSE Agents — real-time message bus activity (agents:system channel) */
  @Sse("agents")
  @Public()
  agentsStream(): Observable<MessageEvent> {
    return merge(
      this.bus.on<unknown>("agents:system").pipe(
        map(e => toMsgEvent(e.data, e.event)),
      ),
      keepalive$(),
    );
  }
}
