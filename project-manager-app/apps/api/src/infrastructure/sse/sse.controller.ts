import { Controller, Headers, MessageEvent, Param, Query, Sse } from "@nestjs/common";
import { Observable, from, interval, merge, of } from "rxjs";
import { catchError, filter, map, startWith, switchMap } from "rxjs/operators";
import { Public } from "../../common/public.decorator.js";
import { SseEventBusService } from "./sse-event-bus.service.js";
import { HealthService } from "../../modules/health/health.service.js";
import { AgentWorkPlanService } from "../../modules/agents/agent-work-plan.service.js";
import { AgentDelegationService } from "../../modules/agents/agent-delegation.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const KEEPALIVE_MS = 20_000;

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
   */
  @Sse("plans/:planId")
  @Public()
  planStream(
    @Param("planId") planId: string,
    @Headers("x-tenant-id") tenantId: string,
  ): Observable<MessageEvent> {
    if (!tenantId) return keepalive$();

    return from(this.plans.findById(tenantId, planId).catch(() => null)).pipe(
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

  @Sse("delegations")
  @Public()
  delegationsStream(
    @Query("projectId") projectId: string | undefined,
    @Headers("x-tenant-id") tenantId: string,
  ): Observable<MessageEvent> {
    if (!tenantId) return keepalive$();

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

  @Sse("context")
  @Public()
  contextStream(
    @Query("projectId") projectId: string | undefined,
    @Headers("x-tenant-id") tenantId: string,
  ): Observable<MessageEvent> {
    if (!tenantId) return keepalive$();

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
  @Public()
  financeStream(
    @Headers("x-tenant-id") tenantId: string,
  ): Observable<MessageEvent> {
    const channel = `finance:${tenantId}`;
    return merge(
      this.bus.on<unknown>(channel).pipe(
        map(e => toMsgEvent(e.data, e.event)),
      ),
      keepalive$(),
    );
  }

  @Sse("mission-control")
  @Public()
  missionControlStream(
    @Headers("x-tenant-id") tenantId: string,
  ): Observable<MessageEvent> {
    const global$ = this.bus.on<unknown>("mission-control:global").pipe(
      map(e => toMsgEvent(e.data, e.event)),
    );
    const tenant$ = tenantId
      ? this.bus.on<unknown>(`mission-control:${tenantId}`).pipe(
          map(e => toMsgEvent(e.data, e.event)),
        )
      : new Observable<MessageEvent>();

    return merge(global$, tenant$, keepalive$());
  }

  @Sse("buildops")
  @Public()
  buildopsStream(
    @Headers("x-tenant-id") tenantId: string,
  ): Observable<MessageEvent> {
    if (!tenantId) return keepalive$();
    return merge(
      this.bus.on<unknown>(`buildops:${tenantId}`).pipe(
        map(e => toMsgEvent(e.data, e.event)),
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
