import { Controller, Headers, MessageEvent, Param, Query, Sse } from "@nestjs/common";
import { Observable, from, interval, merge, of } from "rxjs";
import { catchError, filter, map, startWith } from "rxjs/operators";
import { Public } from "../../common/public.decorator.js";
import { SseEventBusService } from "./sse-event-bus.service.js";
import { HealthService } from "../../modules/health/health.service.js";
import { AgentWorkPlanService } from "../../modules/agents/agent-work-plan.service.js";
import { AgentDelegationService } from "../../modules/agents/agent-delegation.service.js";

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
  ) {}

  @Sse("plans/:planId")
  @Public()
  planStream(
    @Param("planId") planId: string,
    @Headers("x-tenant-id") tenantId: string,
  ): Observable<MessageEvent> {
    const push$ = this.bus.on<unknown>(`plan:${planId}`).pipe(
      map(e => toMsgEvent(e.data, e.event)),
    );

    const initial$ = from(
      tenantId
        ? this.plans.findById(tenantId, planId).catch(() => null)
        : Promise.resolve(null),
    ).pipe(
      map(plan => plan ? toMsgEvent(plan, "plan-update") : null),
      catchError(() => of(null)),
    ) as Observable<MessageEvent | null>;

    const nonNull$ = new Observable<MessageEvent>(sub => {
      initial$.subscribe({
        next(v) { if (v) sub.next(v); },
        error() { sub.complete(); },
        complete() { sub.complete(); },
      });
    });

    return merge(nonNull$, push$, keepalive$());
  }

  @Sse("delegations")
  @Public()
  delegationsStream(
    @Query("projectId") projectId: string | undefined,
    @Headers("x-tenant-id") tenantId: string,
  ): Observable<MessageEvent> {
    const channel = projectId ? `delegations:${projectId}` : `delegations:${tenantId}`;

    const push$ = this.bus.on<unknown>(channel).pipe(
      map(e => toMsgEvent(e.data, e.event)),
    );

    const initial$ = new Observable<MessageEvent>(sub => {
      if (!tenantId) { sub.complete(); return; }
      this.delegations.listByProject({ tenantId, projectId: projectId ?? "" })
        .then(list => {
          sub.next(toMsgEvent(list, "delegations-update"));
          sub.complete();
        })
        .catch(() => sub.complete());
    });

    return merge(initial$, push$, keepalive$());
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
}
