import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SemseToolResult } from "../../../../../packages/tools/dist/index.js";

type AlgorithmRunContext = {
  tenantId?: string;
  userId?: string;
  jobId?: string;
  buildOpsProjectId?: string;
};

@Injectable()
export class AlgorithmRunService {
  private readonly logger = new Logger(AlgorithmRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a tool calculation run for auditing and future analytics.
   * Failures are swallowed — never blocks the tool calculation response.
   */
  async record(
    tool: string,
    input: Record<string, unknown>,
    result: SemseToolResult,
    context?: AlgorithmRunContext,
  ): Promise<void> {
    try {
      const extended = result as SemseToolResult & {
        confidenceScore?: { score: number };
        readinessScore?:  { score: number };
        disputeRisk?:     { score: number };
        priceBands?:      { low: number; mid: number; high: number };
        safeToProceed?:   { canPublish: boolean; canCreateBuildOpsPlan: boolean; canCreateContract: boolean };
        algorithmTrace?:  { algorithmVersion?: string };
      };

      await this.prisma.algorithmRun.create({
        data: {
          id:                `arn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          tenantId:          context?.tenantId ?? null,
          userId:            context?.userId ?? null,
          jobId:             context?.jobId ?? null,
          buildOpsProjectId: context?.buildOpsProjectId ?? null,
          trade:             result.trade,
          toolName:          tool,
          algorithmVersion:  extended.algorithmTrace?.algorithmVersion ?? "unknown-v1.0.0",
          inputJson:         input as Prisma.InputJsonValue,
          outputJson:        {
            toolId:       result.toolId,
            trade:        result.trade,
            projectType:  result.projectType,
            costs:        result.costs,
            risk:         { score: result.risk.score, level: result.risk.level },
            warnings:     result.warnings?.slice(0, 10) ?? [],
            isValid:      result.isValid,
          } as Prisma.InputJsonValue,
          confidenceScore:  extended.confidenceScore?.score ?? null,
          riskScore:        result.risk.score,
          readinessScore:   extended.readinessScore?.score ?? null,
          disputeRiskScore: extended.disputeRisk?.score ?? null,
          priceBandLow:     extended.priceBands ? new Prisma.Decimal(extended.priceBands.low) : null,
          priceBandMid:     extended.priceBands ? new Prisma.Decimal(extended.priceBands.mid) : null,
          priceBandHigh:    extended.priceBands ? new Prisma.Decimal(extended.priceBands.high) : null,
          canPublish:       extended.safeToProceed?.canPublish ?? true,
          canCreateBuildOps: extended.safeToProceed?.canCreateBuildOpsPlan ?? false,
          canCreateContract: extended.safeToProceed?.canCreateContract ?? false,
        },
      });
    } catch (error) {
      // Never block the calculation — just log and continue
      this.logger.warn({ tool, error }, "AlgorithmRun record failed — skipping");
    }
  }

  async listByTrade(trade: string, limit = 50) {
    return this.prisma.algorithmRun.findMany({
      where:   { trade },
      orderBy: { createdAt: "desc" },
      take:    Math.min(limit, 200),
      select: {
        id: true, trade: true, toolName: true, algorithmVersion: true,
        riskScore: true, confidenceScore: true, readinessScore: true,
        priceBandMid: true, canPublish: true, createdAt: true,
      },
    });
  }

  async getStats() {
    const [total, byTrade] = await Promise.all([
      this.prisma.algorithmRun.count(),
      this.prisma.algorithmRun.groupBy({
        by: ["trade"],
        _count: { id: true },
        _avg:   { riskScore: true, confidenceScore: true },
      }),
    ]);
    return { total, byTrade };
  }
}
