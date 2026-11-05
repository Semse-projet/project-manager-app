import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { BlsPpiService, BLS_SERIES } from "./bls-ppi.service.js";

export type MaterialPriceMap = Record<string, number>; // materialKey → pricePerUnit USD

export type MaterialPriceDetails = {
  prices: MaterialPriceMap;
  source: "LEGACY_CACHE_UNVERIFIED" | "HARDCODED_FALLBACK_UNVERIFIED";
  provenance: Record<string, {
    verification: "UNVERIFIED";
    origin: "LEGACY_CACHE" | "HARDCODED_FALLBACK";
    recordedSource: string | null;
    fetchedAt: string | null;
    validUntil: string | null;
    reason: "HISTORICAL_INDEX_AND_PRICE_PROVENANCE_NOT_PROVEN" | "MISSING_OR_EXPIRED_CACHE";
  }>;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class MaterialPricingService {
  private readonly logger = new Logger(MaterialPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bls: BlsPpiService,
  ) {}

  /**
   * Legacy numeric map for existing calculators. It intentionally retains
   * its shape; callers MUST NOT infer BLS verification from these numbers.
   */
  async getCurrentPrices(): Promise<MaterialPriceMap> {
    return (await this.getCurrentPricesWithProvenance()).prices;
  }

  /**
   * Read-only view of the existing cache: no change to money or DB rows.
   * Historical snapshots do not retain true BLS observation provenance,
   * so even an unexpired BLS_PPI row is NEVER represented as verified.
   */
  async getCurrentPricesWithProvenance(): Promise<MaterialPriceDetails> {
    const now = new Date();
    const snapshots = await this.prisma.materialPriceSnapshot.findMany({
      where: { validUntil: { gt: now } },
    });

    const prices: MaterialPriceMap = {};
    const provenance: MaterialPriceDetails["provenance"] = {};

    if (snapshots.length > 0) {
      for (const snapshot of snapshots) {
        prices[snapshot.materialKey] = Number(snapshot.pricePerUnit);
        provenance[snapshot.materialKey] = {
          verification: "UNVERIFIED",
          origin: "LEGACY_CACHE",
          recordedSource: snapshot.source,
          fetchedAt: snapshot.fetchedAt.toISOString(),
          validUntil: snapshot.validUntil.toISOString(),
          reason: "HISTORICAL_INDEX_AND_PRICE_PROVENANCE_NOT_PROVEN",
        };
      }
      return { prices, source: "LEGACY_CACHE_UNVERIFIED", provenance };
    }

    // Same numeric fallback as before, but never advertised as BLS data.
    this.logger.debug("Material price cache empty or expired — returning unverified base prices");
    Object.assign(prices, this.getBasePrices());
    for (const series of BLS_SERIES) {
      provenance[series.materialKey] = {
        verification: "UNVERIFIED",
        origin: "HARDCODED_FALLBACK",
        recordedSource: null,
        fetchedAt: null,
        validUntil: null,
        reason: "MISSING_OR_EXPIRED_CACHE",
      };
    }
    return { prices, source: "HARDCODED_FALLBACK_UNVERIFIED", provenance };
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
        // T-008b: never label an unavailable or invalid BLS observation as
        // a refreshed BLS_PPI snapshot. This checks INDEX provenance only:
        // the old pricePerUnit = basePrice * index / 100 formula remains
        // commercially unverified and is handled separately in T-008.
        if (
          r.indexOrigin !== "BLS_OBSERVED" ||
          !Number.isFinite(r.indexValue) || r.indexValue <= 0 ||
          !Number.isFinite(r.pricePerUnit) || r.pricePerUnit <= 0
        ) {
          failed++;
          this.logger.warn(`Skipping unverified BLS index for ${r.materialKey}; preserving existing snapshot`);
          continue;
        }

        try {
          await this.prisma.materialPriceSnapshot.upsert({
            // Prisma's extended unique filter makes BLS refresh conditional
            // on the persisted row still being BLS-owned. A MANUAL/FRED row
            // must never receive a BLS-derived number while retaining its
            // original source label; concurrent inserts fail closed on the
            // materialKey unique constraint instead of overwriting overrides.
            where: { materialKey: r.materialKey, source: "BLS_PPI" },
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
