import { Injectable, Logger } from '@nestjs/common';

/**
 * WeatherMatrixService — matriz de compatibilidad clima-trades.
 * 20 trades × condiciones clima = reglas de trabajo permitido.
 */

export interface TradeWeatherRule {
  trade: string;
  maxTemp?: number; // Si > maxTemp, no permitir
  minTemp?: number; // Si < minTemp, no permitir
  maxWind?: number; // Si > maxWind, no permitir (km/h)
  maxPrecipitation?: number; // Si > maxPrecipitation, no permitir (mm)
  minUV?: number; // Si < minUV, alerta
  restrictions: string[]; // Descripciones de restricciones
}

const WEATHER_TRADE_MATRIX: Record<string, TradeWeatherRule> = {
  'General Labor': {
    trade: 'General Labor',
    maxTemp: 40,
    minTemp: 0,
    maxWind: 50,
    maxPrecipitation: 10,
    restrictions: ['Heavy rain', 'Extreme heat'],
  },
  Framing: {
    trade: 'Roofing',
    maxTemp: 35,
    minTemp: 5,
    maxWind: 30,
    maxPrecipitation: 1, // NO trabajo con lluvia
    restrictions: ['No rain', 'Strong winds dangerous'],
  },
  Painting: {
    trade: 'Painting',
    maxTemp: 35,
    minTemp: 5,
    maxWind: 15, // Viento causa spray
    maxPrecipitation: 1,
    restrictions: ['Cannot paint wet surfaces', 'Wind affects finish'],
  },
  Electrical: {
    trade: 'Electrical',
    maxTemp: 45,
    minTemp: -10,
    maxWind: 60,
    maxPrecipitation: 10,
    restrictions: ['Interior work less affected', 'Watch for lightning'],
  },
  Concrete: {
    trade: 'Concrete',
    maxTemp: 40,
    minTemp: 5,
    maxWind: 50,
    maxPrecipitation: 0, // Lluvia daña concreto fresco
    restrictions: ['Rain ruins concrete curing', 'High temp causes cracking'],
  },
  Excavation: {
    trade: 'Excavation',
    maxTemp: 45,
    minTemp: -5,
    maxWind: 60,
    maxPrecipitation: 5,
    restrictions: ['Muddy conditions slow work', 'Extreme heat hazard'],
  },
  SelectiveDemolition: {
    trade: 'Demolition',
    maxTemp: 45,
    minTemp: -10,
    maxWind: 40, // Wind spreads dust
    maxPrecipitation: 10,
    restrictions: ['Dust control in dry conditions', 'Water suppression in rain'],
  },
  Plumbing: {
    trade: 'Plumbing',
    maxTemp: 40,
    minTemp: 0,
    maxWind: 60,
    maxPrecipitation: 10,
    restrictions: ['Freeze risk below 0C', 'Interior less affected'],
  },
  Carpentry: {
    trade: 'Carpentry',
    maxTemp: 40,
    minTemp: 5,
    maxWind: 60,
    maxPrecipitation: 5,
    restrictions: ['Moisture swells wood', 'Wind hazard with tall cuts'],
  },
  Masonry: {
    trade: 'Masonry',
    maxTemp: 35,
    minTemp: 5,
    maxWind: 50,
    maxPrecipitation: 1, // Rain weakens mortar
    restrictions: ['Rain ruins mortar', 'Freeze cracks grout'],
  },
  Roofing: {
    trade: 'Framing',
    maxTemp: 40,
    minTemp: -5,
    maxWind: 40,
    maxPrecipitation: 10,
    restrictions: ['Slippery when wet', 'Wind hazard'],
  },
  Drywall: {
    trade: 'Drywall',
    maxTemp: 35,
    minTemp: 5,
    maxWind: 60,
    maxPrecipitation: 5,
    restrictions: ['Moisture warps drywall', 'Dust control'],
  },
  Flooring: {
    trade: 'Flooring',
    maxTemp: 30,
    minTemp: 5,
    maxWind: 60,
    maxPrecipitation: 1,
    restrictions: ['Humidity affects wood', 'Moisture under flooring'],
  },
  Insulation: {
    trade: 'Insulation',
    maxTemp: 40,
    minTemp: -10,
    maxWind: 60,
    maxPrecipitation: 5,
    restrictions: ['Moisture damages insulation', 'Wind hazard'],
  },
  HVAC: {
    trade: 'HVAC',
    maxTemp: 45,
    minTemp: -15,
    maxWind: 60,
    maxPrecipitation: 10,
    restrictions: ['Extreme temps require special equipment'],
  },
  'Windows/Doors': {
    trade: 'Windows/Doors',
    maxTemp: 35,
    minTemp: 5,
    maxWind: 40,
    maxPrecipitation: 5,
    restrictions: ['Moisture affects seals', 'Wind during installation'],
  },
  Siding: {
    trade: 'Siding',
    maxTemp: 40,
    minTemp: 5,
    maxWind: 30,
    maxPrecipitation: 5,
    restrictions: ['Rain delays installation', 'High wind dangerous'],
  },
  Landscaping: {
    trade: 'Landscaping',
    maxTemp: 45,
    minTemp: -5,
    maxWind: 60,
    maxPrecipitation: 10,
    restrictions: ['Extreme heat hazard', 'Muddy conditions'],
  },
  Demolition: {
    trade: 'Demolition',
    maxTemp: 45,
    minTemp: -10,
    maxWind: 40,
    maxPrecipitation: 10,
    restrictions: ['Dust control needed', 'Wind safety'],
  },
  Finishes: {
    trade: 'Finishes',
    maxTemp: 30,
    minTemp: 10,
    maxWind: 15,
    maxPrecipitation: 1,
    restrictions: ['Humidity affects paint/stain', 'Dust contamination'],
  },
};

@Injectable()
export class WeatherMatrixService {
  private readonly logger = new Logger(WeatherMatrixService.name);

  /**
   * Obtener regla para un trade.
   */
  getTradeRule(trade: string): TradeWeatherRule | null {
    return WEATHER_TRADE_MATRIX[trade] || null;
  }

  /**
   * Evaluar si el clima es seguro para un trade.
   * Retorna: score 0-100 (0 = no permitir, 100 = ideal)
   */
  evaluateWeatherForTrade(trade: string, weather: any): number {
    const rule = this.getTradeRule(trade);
    if (!rule) return 50; // Default if no rule

    let score = 100;

    // Temperatura
    if (weather.temperature > (rule.maxTemp || 50)) {
      score -= Math.min(50, (weather.temperature - (rule.maxTemp || 50)) * 2);
    }
    if (weather.temperature < (rule.minTemp || -20)) {
      score -= Math.min(50, ((rule.minTemp || -20) - weather.temperature) * 2);
    }

    // Viento
    if (weather.windSpeed > (rule.maxWind || 60)) {
      score -= Math.min(40, (weather.windSpeed - (rule.maxWind || 60)) * 1.5);
    }

    // Precipitación
    if (weather.precipitation > (rule.maxPrecipitation ?? 10)) {
      score -= Math.min(50, (weather.precipitation - (rule.maxPrecipitation ?? 10)) * 5);
    }

    return Math.max(0, score);
  }

  /**
   * Obtener matriz completa (para UI).
   */
  getFullMatrix(): Record<string, TradeWeatherRule> {
    return WEATHER_TRADE_MATRIX;
  }

  /**
   * Obtener recomendaciones para un trade con clima actual.
   */
  getRecommendations(trade: string, weather: any): { score: number; message: string } {
    const score = this.evaluateWeatherForTrade(trade, weather);
    const rule = this.getTradeRule(trade);

    let message = '';
    if (score >= 80) {
      message = 'Excellent conditions for work';
    } else if (score >= 60) {
      message = 'Good conditions, minor precautions needed';
    } else if (score >= 40) {
      message = 'Poor conditions, significant precautions needed';
    } else {
      message = 'Not recommended to work today';
    }

    if (rule) {
      message += `. Restrictions: ${rule.restrictions.join(', ')}`;
    }

    return { score, message };
  }
}
