import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { OEWS_TRADES } from "./oews.service.js";

// National baseline: average hourly mean across all 12 tracked construction trades (BLS OEWS 2023)
export const NATIONAL_BASELINE_HOURLY_RATE =
  Math.round((OEWS_TRADES.reduce((s, t) => s + t.nationalHourlyMean, 0) / OEWS_TRADES.length) * 100) / 100;

export const CONTRACTOR_RATE_POLICY = {
  currency: "USD",
  laborRatePerHr: { min: 10, max: 250 },
  materialMarkup: { min: 0, max: 1 },
} as const;

export type ContractorRateOverrideView = {
  userId:         string;
  laborRatePerHr: number;   // $/hr contractor charges
  materialMarkup: number;   // e.g. 0.15 = 15% markup
  laborMultiplier: number;  // derived: rate / national baseline
  materialMultiplier: number; // derived: 1 + markup
  notes?:         string;
  updatedAt:      string;
};

export type UpsertContractorRateInput = {
  laborRatePerHr:  number;
  materialMarkup:  number;
  notes?:          string;
};

@Injectable()
export class ContractorRateService {
  private readonly logger = new Logger(ContractorRateService.name);
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getOverride(userId: string): Promise<ContractorRateOverrideView | null> {
    const row = await this.prisma.contractorRateOverride.findUnique({ where: { userId } });
    if (!row) return null;
    return this.toView(row);
  }

  async upsertOverride(userId: string, input: UpsertContractorRateInput): Promise<ContractorRateOverrideView> {
    this.assertValidOverride(input);
    const row = await this.prisma.contractorRateOverride.upsert({
      where:  { userId },
      create: {
        userId,
        laborRatePerHr: input.laborRatePerHr,
        materialMarkup: input.materialMarkup,
        notes:          input.notes ?? null,
      },
      update: {
        laborRatePerHr: input.laborRatePerHr,
        materialMarkup: input.materialMarkup,
        notes:          input.notes ?? null,
      },
    });
    this.logger.log(`[ContractorRate] upserted for user ${userId}: $${input.laborRatePerHr}/hr, markup ${(input.materialMarkup * 100).toFixed(1)}%`);
    return this.toView(row);
  }

  async deleteOverride(userId: string): Promise<void> {
    await this.prisma.contractorRateOverride.deleteMany({ where: { userId } });
  }

  private assertValidOverride(input: UpsertContractorRateInput): void {
    const rate = input.laborRatePerHr;
    if (
      !Number.isFinite(rate)
      || rate < CONTRACTOR_RATE_POLICY.laborRatePerHr.min
      || rate > CONTRACTOR_RATE_POLICY.laborRatePerHr.max
    ) {
      throw new BadRequestException(
        `laborRatePerHr must be between ${CONTRACTOR_RATE_POLICY.laborRatePerHr.min} and ${CONTRACTOR_RATE_POLICY.laborRatePerHr.max} USD`,
      );
    }

    const markup = input.materialMarkup;
    if (
      !Number.isFinite(markup)
      || markup < CONTRACTOR_RATE_POLICY.materialMarkup.min
      || markup > CONTRACTOR_RATE_POLICY.materialMarkup.max
    ) {
      throw new BadRequestException("materialMarkup must be between 0 and 1");
    }
  }

  /** Convert DB row to view object with derived multipliers. */
  private toView(row: { userId: string; laborRatePerHr: { toNumber(): number }; materialMarkup: { toNumber(): number }; notes: string | null; updatedAt: Date }): ContractorRateOverrideView {
    const laborRate = Number(row.laborRatePerHr);
    const markup    = Number(row.materialMarkup);
    return {
      userId:             row.userId,
      laborRatePerHr:     laborRate,
      materialMarkup:     markup,
      laborMultiplier:    Math.round((laborRate / NATIONAL_BASELINE_HOURLY_RATE) * 1000) / 1000,
      materialMultiplier: Math.round((1 + markup) * 10000) / 10000,
      notes:              row.notes ?? undefined,
      updatedAt:          row.updatedAt.toISOString(),
    };
  }

  static get nationalBaselineHourlyRate(): number {
    return NATIONAL_BASELINE_HOURLY_RATE;
  }
}
