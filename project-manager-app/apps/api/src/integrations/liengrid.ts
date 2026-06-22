import axios, { AxiosError } from 'axios';
import { Logger } from '@nestjs/common';

/**
 * LienGrid API client — deadlines para preliminary notices en 50 estados US.
 * Documentación: https://api.liengrid.com/docs
 *
 * Pricing: $0.50 - $2.00 por consulta (variación por estado).
 * Rate limit: 100 req/sec
 */

export interface LienGridRequest {
  address: string; // "123 Main St, San Francisco, CA 94102"
  state: string; // "CA"
  projectStartDate: string; // ISO 8601
  projectDescription?: string;
  contractAmount?: number;
  apiKey: string; // LIENGRID_API_KEY
}

export interface LienGridDeadlines {
  state: string;
  preliminaryNoticeDeadline: string; // ISO 8601
  waiverDeadline: string;
  finalNoticeDeadline?: string;
  statusLienDeadline?: string;
  requiresNotary: boolean;
  requiresCertifiedMail: boolean;
  recipientTypes: string[]; // ["owner", "general_contractor", "lender"]
}

export interface LienGridError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class LienGridClient {
  private readonly logger = new Logger(LienGridClient.name);
  private readonly apiUrl = 'https://api.liengrid.com/v1';
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;
  private readonly timeoutMs = 10000;

  /**
   * Obtener deadlines de lien para un proyecto en un estado específico.
   * Con retry automático y timeout.
   */
  async getDeadlines(request: LienGridRequest): Promise<LienGridDeadlines> {
    const { address, state, projectStartDate, apiKey, ...rest } = request;

    const payload = {
      address,
      state,
      projectStartDate,
      ...rest,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await axios.post<LienGridDeadlines>(
          `${this.apiUrl}/deadlines`,
          payload,
          {
            headers: {
              'X-API-Key': apiKey,
              'Content-Type': 'application/json',
              'User-Agent': 'SEMSE/2.0',
            },
            timeout: this.timeoutMs,
          }
        );

        this.logger.debug(`LienGrid API success: ${state}`, {
          address,
          deadline: response.data.preliminaryNoticeDeadline,
        });

        return response.data;
      } catch (error) {
        const err = error as AxiosError;
        lastError = error as Error;

        this.logger.warn(`LienGrid API attempt ${attempt + 1}/${this.maxRetries} failed`, {
          state,
          status: err.response?.status,
          message: err.message,
        });

        // No retry si es 4xx (client error)
        if (err.response?.status && err.response.status >= 400 && err.response.status < 500) {
          throw this.transformError(err);
        }

        // Esperar antes de reintentar
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Si llegamos aquí, se agotaron los reintentos
    throw lastError || new Error('LienGrid API failed after retries');
  }

  /**
   * Transformar errores de LienGrid a formato esperado.
   */
  private transformError(error: AxiosError): LienGridError {
    const status = error.response?.status || 500;
    const data = (error.response?.data as Record<string, unknown>) || {};

    return {
      code: `LIENGRID_${status}`,
      message: (data.message as string) || error.message || 'LienGrid API error',
      details: data,
    };
  }
}

/**
 * Mock LienGrid client para testing.
 * Retorna deadlines pre-configurados por estado.
 */
export class MockLienGridClient implements Partial<LienGridClient> {
  private readonly logger = new Logger('MockLienGridClient');

  private readonly mockDeadlines: Record<string, LienGridDeadlines> = {
    CA: {
      state: 'CA',
      preliminaryNoticeDeadline: '2026-08-10T00:00:00Z',
      waiverDeadline: '2026-09-15T00:00:00Z',
      finalNoticeDeadline: '2026-10-20T00:00:00Z',
      statusLienDeadline: '2026-12-20T00:00:00Z',
      requiresNotary: false,
      requiresCertifiedMail: true,
      recipientTypes: ['owner', 'general_contractor', 'lender'],
    },
    TX: {
      state: 'TX',
      preliminaryNoticeDeadline: '2026-08-05T00:00:00Z',
      waiverDeadline: '2026-09-10T00:00:00Z',
      finalNoticeDeadline: '2026-10-15T00:00:00Z',
      statusLienDeadline: '2026-12-15T00:00:00Z',
      requiresNotary: true,
      requiresCertifiedMail: true,
      recipientTypes: ['owner', 'general_contractor'],
    },
    NY: {
      state: 'NY',
      preliminaryNoticeDeadline: '2026-08-15T00:00:00Z',
      waiverDeadline: '2026-09-20T00:00:00Z',
      requiresNotary: false,
      requiresCertifiedMail: false,
      recipientTypes: ['owner'],
    },
  };

  async getDeadlines(request: LienGridRequest): Promise<LienGridDeadlines> {
    const { state } = request;

    const result = this.mockDeadlines[state];
    if (!result) {
      throw new Error(`Mock: Unknown state ${state}`);
    }

    this.logger.debug(`Mock LienGrid: ${state}`, result);
    return result;
  }
}

/**
 * Factory para crear cliente real o mock.
 */
export function createLienGridClient(apiKey: string, useMock = false): LienGridClient | MockLienGridClient {
  if (useMock || !apiKey) {
    return new MockLienGridClient();
  }
  const client = new LienGridClient();
  // Inyectar apiKey si es necesario (lo pasamos en cada request)
  return client;
}
