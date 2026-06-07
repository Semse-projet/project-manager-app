import { Injectable, Logger } from "@nestjs/common";

export interface BlsPpiSeries {
  seriesId: string;
  materialKey: string;
  unit: string;
  basePrice: number; // fallback hardcoded price (USD)
}

export interface BlsPpiResult {
  seriesId: string;
  materialKey: string;
  indexValue: number;
  pricePerUnit: number;
  unit: string;
  basePrice: number;
  changeYoY: number | null;
  fetchedAt: Date;
}

// BLS PPI series mapped to SEMSE material keys
// Base prices are 2024 market averages used to convert index → USD
export const BLS_SERIES: BlsPpiSeries[] = [
  { seriesId: "WPU081",   materialKey: "lumber-framing",    unit: "board-ft",   basePrice: 0.65  }, // Lumber & wood products
  { seriesId: "WPU081",   materialKey: "lumber-plywood",    unit: "sqft",        basePrice: 0.85  },
  { seriesId: "WPU101901",materialKey: "steel-rebar",       unit: "ton",         basePrice: 820   }, // Steel mill products - rebar
  { seriesId: "WPU102501",materialKey: "copper-wire",       unit: "lb",          basePrice: 3.95  }, // Copper wire
  { seriesId: "WPU133",   materialKey: "drywall-sheet",     unit: "each",        basePrice: 18.50 }, // Gypsum products
  { seriesId: "WPU132",   materialKey: "concrete-ready-mix",unit: "cubic-yd",    basePrice: 145   }, // Concrete
  { seriesId: "WPU132",   materialKey: "concrete-block",    unit: "each",        basePrice: 2.10  },
  { seriesId: "WPU0561",  materialKey: "asphalt-shingles",  unit: "sq",          basePrice: 95    }, // Asphalt roofing
  { seriesId: "WPU0561",  materialKey: "architectural-shingles", unit: "sq",     basePrice: 120   },
  { seriesId: "WPU101",   materialKey: "steel-framing",     unit: "linear-ft",   basePrice: 1.85  }, // Metal products
  { seriesId: "WPU132",   materialKey: "masonry-brick",     unit: "each",        basePrice: 0.85  },
  { seriesId: "WPU0561",  materialKey: "roofing-underlayment", unit: "roll",     basePrice: 75    },
];

const BLS_API_BASE = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

@Injectable()
export class BlsPpiService {
  private readonly logger = new Logger(BlsPpiService.name);

  async fetchSeries(seriesIds: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(seriesIds)];
    const result = new Map<string, number>();

    try {
      const body = {
        seriesid: unique,
        startyear: String(new Date().getFullYear() - 1),
        endyear: String(new Date().getFullYear()),
      };

      const res = await fetch(BLS_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`BLS API responded ${res.status}`);
        return result;
      }

      const data = (await res.json()) as {
        status: string;
        Results?: { series: Array<{ seriesID: string; data: Array<{ value: string; year: string; period: string }> }> };
      };

      if (data.status !== "REQUEST_SUCCEEDED" || !data.Results) {
        this.logger.warn(`BLS API status: ${data.status}`);
        return result;
      }

      for (const series of data.Results.series) {
        const latest = series.data.find(d => d.period !== "M13"); // skip annual average
        if (latest) {
          result.set(series.seriesID, parseFloat(latest.value));
        }
      }
    } catch (err) {
      this.logger.warn(`BLS API fetch failed: ${(err as Error).message}`);
    }

    return result;
  }

  async fetchAllMaterialPrices(): Promise<BlsPpiResult[]> {
    const seriesIds = [...new Set(BLS_SERIES.map(s => s.seriesId))];
    const indexMap = await this.fetchSeries(seriesIds);

    const results: BlsPpiResult[] = [];
    const now = new Date();

    for (const series of BLS_SERIES) {
      const currentIndex = indexMap.get(series.seriesId);

      if (currentIndex) {
        // Convert PPI index (base 2012=100) to approximate USD price
        // Adjustment factor: current_index / 100 applied to base price
        const adjustmentFactor = currentIndex / 100;
        const pricePerUnit = Math.round(series.basePrice * adjustmentFactor * 100) / 100;

        // Approximate YoY change — would need prior year data for accuracy
        const changeYoY = Math.round((adjustmentFactor - 1) * 10000) / 100;

        results.push({
          seriesId: series.seriesId,
          materialKey: series.materialKey,
          indexValue: currentIndex,
          pricePerUnit,
          unit: series.unit,
          basePrice: series.basePrice,
          changeYoY,
          fetchedAt: now,
        });
      } else {
        // Fallback to base price when API unavailable
        results.push({
          seriesId: series.seriesId,
          materialKey: series.materialKey,
          indexValue: 100,
          pricePerUnit: series.basePrice,
          unit: series.unit,
          basePrice: series.basePrice,
          changeYoY: null,
          fetchedAt: now,
        });
        this.logger.debug(`Using base price for ${series.materialKey} (BLS series ${series.seriesId} not available)`);
      }
    }

    return results;
  }
}
