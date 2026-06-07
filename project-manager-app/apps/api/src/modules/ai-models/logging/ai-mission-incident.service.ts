import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { SseEventBusService } from "../../../infrastructure/sse/sse-event-bus.service.js";

type IncidentRow = {
  id: string;
  tenantId: string | null;
  source: string;
  posture: string;
  severity: string;
  title: string;
  detail: string;
  alertIds: string[];
  createdAt: Date;
};

export type MissionIncidentSeverity = "critical" | "high" | "medium" | "info";
export type MissionIncidentSource = "bootstrap" | "manual" | "poll" | "health-stream" | "context-stream";

export type MissionIncidentInput = {
  tenantId?: string;
  source: MissionIncidentSource;
  posture: string;
  severity: MissionIncidentSeverity;
  title: string;
  detail: string;
  alertIds: string[];
};

export type MissionIncidentView = MissionIncidentInput & {
  id: string;
  createdAt: string;
};

@Injectable()
export class AiMissionIncidentService {
  private readonly logger = new Logger(AiMissionIncidentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly sseBus?: SseEventBusService,
  ) {}

  async persist(input: MissionIncidentInput): Promise<MissionIncidentView> {
    const row = await this.prisma.missionControlIncident.create({
      data: {
        tenantId: input.tenantId ?? null,
        source: input.source,
        posture: input.posture,
        severity: input.severity,
        title: input.title,
        detail: input.detail,
        alertIds: input.alertIds,
      },
    });

    const view: MissionIncidentView = {
      id: row.id,
      tenantId: row.tenantId ?? undefined,
      source: row.source as MissionIncidentSource,
      posture: row.posture,
      severity: row.severity as MissionIncidentSeverity,
      title: row.title,
      detail: row.detail,
      alertIds: row.alertIds,
      createdAt: row.createdAt.toISOString(),
    };

    if (input.severity === "critical" || input.severity === "high") {
      const channel = input.tenantId ? `mission-control:${input.tenantId}` : "mission-control:global";
      this.sseBus?.emit(channel, "mission-incident", view);
      this.sseBus?.emit("mission-control:global", "mission-incident", view);
      this.logger.warn(`[mission-incident] posture=${input.posture} severity=${input.severity} source=${input.source}`);
    }

    return view;
  }

  async getRecent(tenantId?: string, limit = 20): Promise<MissionIncidentView[]> {
    const rows = await this.prisma.missionControlIncident.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row: IncidentRow) => ({
      id: row.id,
      tenantId: row.tenantId ?? undefined,
      source: row.source as MissionIncidentSource,
      posture: row.posture,
      severity: row.severity as MissionIncidentSeverity,
      title: row.title,
      detail: row.detail,
      alertIds: row.alertIds,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
