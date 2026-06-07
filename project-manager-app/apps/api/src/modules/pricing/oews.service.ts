import { Injectable, Logger } from "@nestjs/common";

/** BLS SOC code mapped to a SEMSE trade key and national baseline wage. */
export interface OewsTradeMapping {
  tradeKey: string;
  socCode: string;        // BLS SOC code (e.g. "47-2031")
  nationalHourlyMean: number;  // 2024 national mean hourly wage (USD)
  nationalAnnualMean: number;
}

export interface OewsStateResult {
  stateCode: string;
  tradeKey: string;
  socCode: string;
  hourlyMean: number;
  annualMean: number;
  multiplier: number;  // vs. national avg
}

// BLS SOC codes + 2024 national mean wages for 12 key construction trades.
// Source: BLS OEWS May 2023 national estimates (publicly available).
export const OEWS_TRADES: OewsTradeMapping[] = [
  { tradeKey: "carpenter",     socCode: "47-2031", nationalHourlyMean: 25.82, nationalAnnualMean: 53700 },
  { tradeKey: "electrician",   socCode: "47-2111", nationalHourlyMean: 29.72, nationalAnnualMean: 61800 },
  { tradeKey: "plumber",       socCode: "47-2152", nationalHourlyMean: 29.78, nationalAnnualMean: 61900 },
  { tradeKey: "hvac",          socCode: "49-9021", nationalHourlyMean: 26.12, nationalAnnualMean: 54300 },
  { tradeKey: "roofer",        socCode: "47-2181", nationalHourlyMean: 23.96, nationalAnnualMean: 49800 },
  { tradeKey: "painter",       socCode: "47-2141", nationalHourlyMean: 22.21, nationalAnnualMean: 46200 },
  { tradeKey: "mason",         socCode: "47-2021", nationalHourlyMean: 23.78, nationalAnnualMean: 49500 },
  { tradeKey: "drywaller",     socCode: "47-2081", nationalHourlyMean: 23.60, nationalAnnualMean: 49100 },
  { tradeKey: "tile-setter",   socCode: "47-2044", nationalHourlyMean: 24.12, nationalAnnualMean: 50200 },
  { tradeKey: "insulation",    socCode: "47-2131", nationalHourlyMean: 21.55, nationalAnnualMean: 44800 },
  { tradeKey: "laborer",       socCode: "47-2061", nationalHourlyMean: 19.14, nationalAnnualMean: 39800 },
  { tradeKey: "concrete",      socCode: "47-2051", nationalHourlyMean: 23.12, nationalAnnualMean: 48100 },
];

// BLS API state codes (series prefix format: OEUS[state FIPS]0000000[SOC without dash]0[data element])
// Data element: 3 = mean hourly wage, 4 = mean annual wage
const BLS_OEWS_API = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

// State FIPS codes (leading zeros for 2-digit FIPS)
const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18",
  IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25",
  MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32",
  NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39",
  OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47",
  TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55",
  WY: "56", DC: "11",
};

@Injectable()
export class OewsService {
  private readonly logger = new Logger(OewsService.name);

  /** Fetch mean hourly wages for a given state from BLS OEWS.
   *  Returns multipliers vs. national average per trade key.
   *  Falls back to static estimates if BLS is unavailable. */
  async fetchStateMultipliers(stateCode: string): Promise<OewsStateResult[]> {
    const fips = STATE_FIPS[stateCode.toUpperCase()];
    if (!fips) {
      this.logger.warn(`Unknown state code: ${stateCode}`);
      return this.staticFallback(stateCode);
    }

    try {
      // Build OEWS series IDs for this state + our 12 trades
      // Series format: OEUS{state_fips}{area_fips}{soc_no_dash}{data_type}
      // area_fips "0000000" = statewide, data_type "03" = hourly mean wage
      const seriesIds = OEWS_TRADES.map(t => {
        const soc = t.socCode.replace("-", "");
        return `OEUS${fips}0000000${soc}03`;
      });

      const body = {
        seriesid: seriesIds,
        startyear: String(new Date().getFullYear() - 1),
        endyear: String(new Date().getFullYear()),
      };

      const res = await fetch(BLS_OEWS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) {
        this.logger.warn(`BLS OEWS responded ${res.status} for state ${stateCode}`);
        return this.staticFallback(stateCode);
      }

      const data = (await res.json()) as {
        status: string;
        Results?: { series: Array<{ seriesID: string; data: Array<{ value: string }> }> };
      };

      if (data.status !== "REQUEST_SUCCEEDED" || !data.Results) {
        return this.staticFallback(stateCode);
      }

      const results: OewsStateResult[] = [];
      for (const series of data.Results.series) {
        const latest = series.data[0];
        if (!latest || latest.value === "-") continue;

        const hourly = parseFloat(latest.value);
        if (isNaN(hourly) || hourly <= 0) continue;

        // Match to our trade mapping by SOC code embedded in series ID
        const socFromId = series.seriesID.slice(10, 17); // extract SOC portion
        const trade = OEWS_TRADES.find(t => t.socCode.replace("-", "") === socFromId);
        if (!trade) continue;

        results.push({
          stateCode: stateCode.toUpperCase(),
          tradeKey: trade.tradeKey,
          socCode: trade.socCode,
          hourlyMean: hourly,
          annualMean: Math.round(hourly * 2080),
          multiplier: Math.round((hourly / trade.nationalHourlyMean) * 1000) / 1000,
        });
      }

      if (results.length < 4) {
        this.logger.warn(`BLS OEWS returned too few records for ${stateCode} (${results.length}), using fallback`);
        return this.staticFallback(stateCode);
      }

      this.logger.log(`BLS OEWS: ${results.length} trade rates fetched for ${stateCode}`);
      return results;
    } catch (err) {
      this.logger.warn(`BLS OEWS fetch failed for ${stateCode}: ${(err as Error).message}`);
      return this.staticFallback(stateCode);
    }
  }

  /** Mean labor multiplier across all 12 trades for this state. */
  aggregateMultiplier(results: OewsStateResult[]): number {
    if (results.length === 0) return 1.0;
    const sum = results.reduce((s, r) => s + r.multiplier, 0);
    return Math.round((sum / results.length) * 1000) / 1000;
  }

  /** Static fallback multipliers based on known BLS OEWS state patterns.
   *  These are conservative estimates validated against 2022-2023 OEWS data. */
  staticFallback(stateCode: string): OewsStateResult[] {
    const mult = STATIC_LABOR_MULTIPLIERS[stateCode.toUpperCase()] ?? 1.0;
    return OEWS_TRADES.map(t => ({
      stateCode: stateCode.toUpperCase(),
      tradeKey: t.tradeKey,
      socCode: t.socCode,
      hourlyMean: Math.round(t.nationalHourlyMean * mult * 100) / 100,
      annualMean: Math.round(t.nationalAnnualMean * mult),
      multiplier: mult,
    }));
  }
}

/** Static labor cost multipliers by state (vs. national avg = 1.00).
 *  Source: BLS OEWS 2023 state-level construction wage data, rounded to 2 decimals. */
export const STATIC_LABOR_MULTIPLIERS: Record<string, number> = {
  AK: 1.42, AL: 0.85, AR: 0.83, AZ: 0.97, CA: 1.38,
  CO: 1.08, CT: 1.22, DC: 1.35, DE: 1.14, FL: 0.93,
  GA: 0.90, HI: 1.48, IA: 0.95, ID: 0.92, IL: 1.18,
  IN: 0.96, KS: 0.90, KY: 0.88, LA: 0.87, MA: 1.28,
  MD: 1.15, ME: 1.00, MI: 1.02, MN: 1.09, MO: 0.94,
  MS: 0.82, MT: 0.96, NC: 0.88, ND: 1.02, NE: 0.92,
  NH: 1.12, NJ: 1.32, NM: 0.93, NV: 1.08, NY: 1.42,
  OH: 1.01, OK: 0.86, OR: 1.14, PA: 1.10, RI: 1.18,
  SC: 0.87, SD: 0.88, TN: 0.88, TX: 0.95, UT: 0.98,
  VA: 1.05, VT: 1.04, WA: 1.22, WI: 1.02, WV: 0.88,
  WY: 1.00,
};
