import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { MaterialPricingService } from "./material-pricing.service.js";

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

// Public BLS pricing telemetry is not needed in private/no-egress environments.
// Preserve the existing default behavior; only an explicit "false" opts out.
// This gate does not disable manual price reads from the local DB cache.
export function isExternalPriceRefreshEnabled(
  env: Pick<NodeJS.ProcessEnv, "SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED"> = process.env,
): boolean {
  return env.SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED !== "false";
}

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
    if (!isExternalPriceRefreshEnabled()) {
      this.logger.log("External BLS material-price refresh disabled by operator");
      return;
    }
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
