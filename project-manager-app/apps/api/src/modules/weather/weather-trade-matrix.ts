import type { WeatherData } from '../../integrations/tomorrow-weather.js';

/**
 * Bloque 2.3.A de docs/specs/tools/fase-2/m2.3-weather.spec.md.
 * Pure classification logic (no I/O) so it can be unit-tested without a
 * Prisma client or a real Tomorrow.io response.
 *
 * Scope decision (2026-08-27): implements RAIN/FROST/WIND/SNOW/HEAT from
 * the spec's §6 Trade-Weather Impact Matrix. HAIL is deliberately excluded
 * — Tomorrow.io's `precipitationType` enum (rain/snow/freezing_rain/
 * ice_pellets) has no "hail" value; a real hail signal needs decoding the
 * numeric `weatherCode` table (thunderstorm/hail codes), which
 * tomorrow-weather.ts's TomorrowWeatherClient does not do. Rather than
 * guess a mapping for a legally/financially consequential (auto-halt,
 * change-order) classification, HAIL is left unimplemented pending that
 * decode work. `freezing_rain`/`ice_pellets` are likewise not classified
 * into any eventType today for the same reason — they don't cleanly map to
 * any of the five implemented types without guessing.
 */

export const TRADES = ['roofing', 'concrete', 'framing', 'siding'] as const;
export type Trade = (typeof TRADES)[number];

export type WeatherEventType = 'RAIN' | 'FROST' | 'WIND' | 'SNOW' | 'HEAT';
export type WeatherSeverity = 'MODERATE' | 'HIGH';
export type TradeImpact = 'CRITICAL' | 'PARTIAL' | 'SAFE';

/** Trade-Weather Impact Matrix — m2.3-weather.spec.md §6, transcribed verbatim. */
export const TRADE_IMPACT_MATRIX: Record<WeatherEventType, Record<Trade, TradeImpact>> = {
  RAIN: { roofing: 'CRITICAL', concrete: 'CRITICAL', framing: 'PARTIAL', siding: 'PARTIAL' },
  FROST: { roofing: 'CRITICAL', concrete: 'CRITICAL', framing: 'SAFE', siding: 'SAFE' },
  WIND: { roofing: 'CRITICAL', concrete: 'SAFE', framing: 'CRITICAL', siding: 'CRITICAL' },
  SNOW: { roofing: 'CRITICAL', concrete: 'CRITICAL', framing: 'SAFE', siding: 'PARTIAL' },
  HEAT: { roofing: 'SAFE', concrete: 'PARTIAL', framing: 'SAFE', siding: 'SAFE' },
};

export function classifyTradeImpact(eventType: WeatherEventType): {
  affectedTrades: Trade[];
  notCriticalFor: Trade[];
} {
  const impacts = TRADE_IMPACT_MATRIX[eventType];
  const affectedTrades: Trade[] = [];
  const notCriticalFor: Trade[] = [];

  for (const trade of TRADES) {
    if (impacts[trade] === 'SAFE') {
      notCriticalFor.push(trade);
    } else {
      affectedTrades.push(trade);
    }
  }

  return { affectedTrades, notCriticalFor };
}

export interface ClassifiedEvent {
  eventType: WeatherEventType;
  severity: WeatherSeverity;
}

// Fixed thresholds — Bloque 2.3.C ("OPS_ADMIN calibra alertas por región",
// permission weather:calibrate) would make these per-tenant/region instead
// of constants; not implemented.
const FROST_C = 0;
const FROST_HIGH_C = -5;
const HEAT_C = 35; // ~95°F
const HEAT_HIGH_C = 40;
const WIND_KMH = 32; // ~20mph
const WIND_HIGH_KMH = 50;
const RAIN_HIGH_MM = 10;
const SNOW_HIGH_MM = 5;

/**
 * Classify a single forecast interval into zero or more concurrent weather
 * events (e.g. a windy rainstorm produces both RAIN and WIND).
 */
export function classifyForecastEntry(entry: WeatherData): ClassifiedEvent[] {
  const events: ClassifiedEvent[] = [];

  if (entry.temperature <= FROST_C) {
    events.push({ eventType: 'FROST', severity: entry.temperature <= FROST_HIGH_C ? 'HIGH' : 'MODERATE' });
  }
  if (entry.temperature >= HEAT_C) {
    events.push({ eventType: 'HEAT', severity: entry.temperature >= HEAT_HIGH_C ? 'HIGH' : 'MODERATE' });
  }
  if (entry.windSpeed >= WIND_KMH) {
    events.push({ eventType: 'WIND', severity: entry.windSpeed >= WIND_HIGH_KMH ? 'HIGH' : 'MODERATE' });
  }
  if (entry.precipitation > 0 && entry.precipitationType === 'rain') {
    events.push({ eventType: 'RAIN', severity: entry.precipitation >= RAIN_HIGH_MM ? 'HIGH' : 'MODERATE' });
  }
  if (entry.precipitation > 0 && entry.precipitationType === 'snow') {
    events.push({ eventType: 'SNOW', severity: entry.precipitation >= SNOW_HIGH_MM ? 'HIGH' : 'MODERATE' });
  }

  return events;
}
