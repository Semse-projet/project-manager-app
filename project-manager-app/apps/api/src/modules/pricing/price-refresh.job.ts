import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { MaterialPricingService } from "./material-pricing.service.js";

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Runs once on startup and then every 24 hours to refresh
 * material prices from BLS PPI API into DB cache.
 */
@Injectable()
export class PriceRefreshJob implements OnModuleInit {
  private readonly logger = new Logger(PriceRefreshJob.name);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly pricing: MaterialPricingService) {}

  onModuleInit(): void {
    // Run the startup DB check in the background so API health can start even
    // when Postgres is slow or temporarily unavailable during Railway boot.
    void this.runInitialRefresh().catch((error: unknown) => {
      this.logger.warn(`Initial price refresh skipped: ${(error as Error)?.message ?? String(error)}`);
    });
    this.scheduleNext();
  }

  private async runInitialRefresh(): Promise<void> {
    const status = await this.pricing.getPricingStatus();
    if (status.stale) {
      this.logger.log("Prices stale on startup — running initial fetch");
      await this.run();
      return;
    }

    this.logger.log(`Prices valid until ${status.nextRefreshAt?.toISOString()} — skipping initial fetch`);
  }

  private scheduleNext(): void {
    this.timer = setTimeout(async () => {
      await this.run().catch((error: unknown) => {
        this.logger.warn(`Scheduled price refresh failed: ${(error as Error)?.message ?? String(error)}`);
      });
      this.scheduleNext();
    }, REFRESH_INTERVAL_MS);
  }

  private async run(): Promise<void> {
    this.logger.log("[PriceRefreshJob] Fetching material prices from BLS PPI...");
    const result = await this.pricing.refreshPrices();
    this.logger.log(`[PriceRefreshJob] Done: ${result.updated} updated, ${result.failed} failed`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
