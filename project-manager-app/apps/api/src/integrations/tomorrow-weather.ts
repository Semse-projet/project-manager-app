import axios, { AxiosError } from 'axios';
import { Logger } from '@nestjs/common';

/**
 * Tomorrow.io Weather API client.
 * https://www.tomorrow.io/weather-api/
 *
 * Datos: temperature, precipitation, windSpeed, uvIndex, weatherCode
 * Pricing: 500k requests/month free tier
 * Rate limit: 100 requests/hour
 */

export interface WeatherData {
  temperature: number; // Celsius
  precipitation: number; // mm
  windSpeed: number; // km/h
  uvIndex: number;
  weatherCode: string; // 'rainy', 'cloudy', 'clear', etc
  timestamp: string;
}

export interface WeatherForecast {
  hourly: WeatherData[];
  daily: WeatherData[];
  fetchedAt: Date;
}

/**
 * Tomorrow.io client con retry y caching.
 */
export class TomorrowWeatherClient {
  private readonly logger = new Logger(TomorrowWeatherClient.name);
  private readonly apiUrl = 'https://api.tomorrow.io/v4/weather/forecast';
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;
  private readonly cacheMs = 6 * 60 * 60 * 1000; // 6 horas
  private cache: Map<string, { data: WeatherForecast; timestamp: Date }> = new Map();

  /**
   * Obtener pronóstico del clima para una ubicación.
   */
  async getWeatherForecast(lat: number, lon: number, apiKey: string): Promise<WeatherForecast> {
    const cacheKey = `${lat},${lon}`;

    // Verificar cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      const age = Date.now() - cached.timestamp.getTime();
      if (age < this.cacheMs) {
        this.logger.debug(`Cache hit: ${cacheKey}`);
        return cached.data;
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await axios.get(
          `${this.apiUrl}?location=${lat},${lon}&apikey=${apiKey}&timesteps=1h,1d`
        );

        const forecast = this.parseResponse(response.data);

        // Guardar en cache
        this.cache.set(cacheKey, { data: forecast, timestamp: new Date() });

        this.logger.debug(`Weather fetched: ${lat}, ${lon}`);

        return forecast;
      } catch (error) {
        const err = error as AxiosError;
        lastError = error as Error;

        this.logger.warn(`Tomorrow.io attempt ${attempt + 1}/${this.maxRetries} failed`, {
          status: err.response?.status,
          message: err.message,
        });

        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Tomorrow.io API failed after retries');
  }

  /**
   * Parsear respuesta de Tomorrow.io.
   */
  private parseResponse(data: any): WeatherForecast {
    const forecast: WeatherForecast = {
      hourly: [],
      daily: [],
      fetchedAt: new Date(),
    };

    // Parsear datos hourly y daily
    // Estructura real de Tomorrow.io: data.timelines[].intervals[]
    if (data.timelines) {
      for (const timeline of data.timelines) {
        if (timeline.timestep === '1h') {
          for (const interval of timeline.intervals) {
            forecast.hourly.push({
              temperature: interval.values.temperature,
              precipitation: interval.values.precipitationSum || 0,
              windSpeed: interval.values.windSpeed,
              uvIndex: interval.values.uvIndex || 0,
              weatherCode: interval.values.weatherCode,
              timestamp: interval.startTime,
            });
          }
        } else if (timeline.timestep === '1d') {
          for (const interval of timeline.intervals) {
            forecast.daily.push({
              temperature: interval.values.temperatureAvg,
              precipitation: interval.values.precipitationSum || 0,
              windSpeed: interval.values.windSpeedMax,
              uvIndex: interval.values.uvIndexMax || 0,
              weatherCode: interval.values.weatherCodeMax,
              timestamp: interval.startTime,
            });
          }
        }
      }
    }

    return forecast;
  }

  /**
   * Limpiar cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Weather cache cleared');
  }
}

/**
 * Mock client para testing.
 */
export class MockTomorrowWeatherClient {
  private readonly logger = new Logger('MockTomorrowWeatherClient');

  async getWeatherForecast(lat: number, lon: number, apiKey: string): Promise<WeatherForecast> {
    this.logger.debug(`Mock: fetching weather for ${lat}, ${lon}`);

    return {
      hourly: [
        {
          temperature: 22,
          precipitation: 0,
          windSpeed: 10,
          uvIndex: 5,
          weatherCode: 'clear',
          timestamp: new Date().toISOString(),
        },
      ],
      daily: [
        {
          temperature: 24,
          precipitation: 0,
          windSpeed: 12,
          uvIndex: 6,
          weatherCode: 'clear',
          timestamp: new Date().toISOString(),
        },
      ],
      fetchedAt: new Date(),
    };
  }

  clearCache(): void {}
}

/**
 * Factory para crear cliente real o mock.
 */
export function createTomorrowWeatherClient(
  apiKey: string,
  useMock = false
): TomorrowWeatherClient | MockTomorrowWeatherClient {
  if (useMock || !apiKey) {
    return new MockTomorrowWeatherClient();
  }
  return new TomorrowWeatherClient();
}
