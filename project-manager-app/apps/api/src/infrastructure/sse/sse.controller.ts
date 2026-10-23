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
import { isOpsAdmin } from "../../common/resource-scope.js";

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

  /*
   * AUDIT_REMEDIATION_PLAN 0.47 — plans/delegations/context/mission-control
   * had neither @Public() nor @RequirePermissions(), so the global
   * deny-by-default RbacGuard answered 403 "RBAC metadata required" to every
   * caller (OPS_ADMIN included) and the BFF masked it as "runtime disabled".
   * Each stream now declares the exact permission its REST twin uses, and the
   * same ProjectAccessService participation check (finding 0.37) runs before
   * any push channel opens — otherwise re-enabling these streams would have
   * reopened the cross-org-within-tenant hole already closed in REST.
   */

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
  @Sse("plans/:planId")
  @RequirePermissions("agents:run:create") // same as GET /v1/agents/plans/:planId
  planStream(
    @Param("planId") planId: string,
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const actor = resolveRequestContext(req);

    const authorizedPlan = async () => {
      const plan = await this.plans.findById(actor.tenantId, planId);
      // Same rule as REST: a plan inherits its project's access; a plan with no
      // project is visible only to its creator or OPS_ADMIN of the same tenant.
      await this.projectAccess.assertPlanAccess(actor, plan);
      return plan;
    };

    return from(authorizedPlan().catch(() => null)).pipe(
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
  @RequirePermissions("ops:coordinator:read") // same as GET /v1/agents/delegations
  delegationsStream(
    @Query("projectId") projectId: string | undefined,
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const actor = resolveRequestContext(req);
    const { tenantId } = actor;

    // No projectId → the channel is keyed by the caller's own tenantId and
    // carries project-less delegations; only reachable with ops:coordinator:read.
    if (!projectId) {
      const push$ = this.bus.on<unknown>(`delegations:${tenantId}`).pipe(
        map(e => toMsgEvent(e.data, e.event)),
      );
      return merge(push$, keepalive$());
    }

    // projectId given → verify the actor participates in that project (tenant
    // + org scope, 0.37) before opening the push channel. An empty delegations
    // list isn't a safe signal on its own (a legitimate new project has no
    // delegations yet), so check project access directly instead.
    return from(
      this.projectAccess.assertProjectAccess(actor, projectId).then(() => true, () => false),
    ).pipe(
      switchMap(allowed => {
        if (!allowed) return keepalive$();
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
  @RequirePermissions("agents:run:create") // same as GET /v1/ai-models/operational-context
  contextStream(
    @Query("projectId") projectId: string | undefined,
    @Req() req: SseRequest,
  ): Observable<MessageEvent> {
    const actor = resolveRequestContext(req);
    const admin = isOpsAdmin(actor);

    // Every invalidation is published on `context:<tenant>:tenant` with its
    // projectId/userId in the payload, so a tenant-wide prefix subscription
    // sees other orgs' projects and other users' scopes. Non-admins only get
    // project events for a project they were authorized for, and never
    // another user's user-scoped event.
    // OPS_ADMIN without a projectId keeps the tenant-wide view it had before.
    const seesAllProjects = admin && !projectId;
    const visible = (e: { data?: Record<string, unknown> }, allowedProjectId: string | null): boolean => {
      const eventProjectId = typeof e.data?.projectId === "string" ? e.data.projectId : null;
      const eventUserId = typeof e.data?.userId === "string" ? e.data.userId : null;
      if (eventProjectId !== null && !seesAllProjects && eventProjectId !== allowedProjectId) return false;
      if (eventUserId !== null && !admin && eventUserId !== actor.userId) return false;
      return true;
    };

    const stream$ = (allowedProjectId: string | null) => merge(
      this.bus.onPrefix<Record<string, unknown>>(`context:${actor.tenantId}:`).pipe(
        filter((e) => visible(e, allowedProjectId)),
        map(e => toMsgEvent(e.data, e.event)),
      ),
      keepalive$(),
    );

    if (!projectId) return stream$(null);

    return from(
      this.projectAccess.assertProjectAccess(actor, projectId).then(() => true, () => false),
    ).pipe(
      switchMap(allowed => (allowed ? stream$(projectId) : keepalive$())),
      catchError(() => keepalive$()),
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

  @Sse("mission-control")
  @RequirePermissions("ops:dashboard:read") // same as GET /v1/ops/mission-control
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

  /**
   * SEMSE Agents — real-time message bus activity (agents:system channel).
   * Was @Public(): any anonymous caller of the API could watch every tenant's
   * agent traffic (projectId, event names, raw handler error messages).
   * Its only consumer is /admin/agents, whose REST twin
   * (GET /v1/agents/semse/status) already requires ops:dashboard:read.
   */
  @Sse("agents")
  @RequirePermissions("ops:dashboard:read")
  agentsStream(): Observable<MessageEvent> {
    return merge(
      this.bus.on<unknown>("agents:system").pipe(
        map(e => toMsgEvent(e.data, e.event)),
      ),
      keepalive$(),
    );
  }
}
