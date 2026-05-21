import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { BlsPpiService, BLS_SERIES } from "./bls-ppi.service.js";

export type MaterialPriceMap = Record<string, number>; // materialKey → pricePerUnit USD

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class MaterialPricingService {
  private readonly logger = new Logger(MaterialPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bls: BlsPpiService,
  ) {}

  /**
   * Returns current material prices from DB cache.
   * Falls back to hardcoded base prices if cache is empty or all expired.
   */
  async getCurrentPrices(): Promise<MaterialPriceMap> {
    const now = new Date();

    const snapshots = await this.prisma.materialPriceSnapshot.findMany({
      where: { validUntil: { gt: now } },
    });

    if (snapshots.length > 0) {
      const map: MaterialPriceMap = {};
      for (const s of snapshots) {
        map[s.materialKey] = Number(s.pricePerUnit);
      }
      return map;
    }

    // Cache miss: return base prices (worker will refresh in background)
    this.logger.debug("Material price cache empty or expired — returning base prices");
    return this.getBasePrices();
  }

  /**
   * Refreshes prices from BLS PPI API and stores in DB.
   * Called by the worker job every 24 hours.
   */
  async refreshPrices(): Promise<{ updated: number; failed: number }> {
    this.logger.log("Refreshing material prices from BLS PPI...");
    let updated = 0;
    let failed = 0;

    try {
      const results = await this.bls.fetchAllMaterialPrices();
      const validUntil = new Date(Date.now() + CACHE_TTL_MS);

      for (const r of results) {
        try {
          await this.prisma.materialPriceSnapshot.upsert({
            where: { materialKey: r.materialKey },
            create: {
              materialKey: r.materialKey,
              blsSeriesId: r.seriesId,
              source: "BLS_PPI",
              pricePerUnit: r.pricePerUnit,
              unit: r.unit,
              indexValue: r.indexValue,
              basePrice: r.basePrice,
              changeYoY: r.changeYoY ?? undefined,
              fetchedAt: r.fetchedAt,
              validUntil,
            },
            update: {
              pricePerUnit: r.pricePerUnit,
              indexValue: r.indexValue,
              changeYoY: r.changeYoY ?? undefined,
              fetchedAt: r.fetchedAt,
              validUntil,
            },
          });
          updated++;
        } catch (err) {
          failed++;
          this.logger.warn(`Failed to upsert price for ${r.materialKey}: ${(err as Error).message}`);
        }
      }

      this.logger.log(`Material prices refreshed: ${updated} updated, ${failed} failed`);
    } catch (err) {
      this.logger.error(`Price refresh failed: ${(err as Error).message}`);
      failed = BLS_SERIES.length;
    }

    return { updated, failed };
  }

  /**
   * Returns the last successful refresh time and price count.
   */
  async getPricingStatus(): Promise<{
    cachedPrices: number;
    lastFetchedAt: Date | null;
    nextRefreshAt: Date | null;
    stale: boolean;
  }> {
    const snapshots = await this.prisma.materialPriceSnapshot.findMany({
      orderBy: { fetchedAt: "desc" },
    });

    const now = new Date();
    const valid = snapshots.filter(s => s.validUntil > now);
    const latest = snapshots[0];

    return {
      cachedPrices: valid.length,
      lastFetchedAt: latest?.fetchedAt ?? null,
      nextRefreshAt: latest?.validUntil ?? null,
      stale: valid.length === 0,
    };
  }

  private getBasePrices(): MaterialPriceMap {
    const map: MaterialPriceMap = {};
    for (const s of BLS_SERIES) {
      map[s.materialKey] = s.basePrice;
    }
    return map;
  }
}
