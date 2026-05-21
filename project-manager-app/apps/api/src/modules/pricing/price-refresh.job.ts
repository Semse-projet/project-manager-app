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

  async onModuleInit(): Promise<void> {
    // Check if prices are stale before first refresh
    const status = await this.pricing.getPricingStatus();
    if (status.stale) {
      this.logger.log("Prices stale on startup — running initial fetch");
      await this.run();
    } else {
      this.logger.log(`Prices valid until ${status.nextRefreshAt?.toISOString()} — skipping initial fetch`);
    }
    this.scheduleNext();
  }

  private scheduleNext(): void {
    this.timer = setTimeout(async () => {
      await this.run();
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
