import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * Lob.com API client — envío de correo certificado digital.
 * Documentación: https://lob.com/docs
 *
 * Pricing: ~$0.50 per letter + postage
 * Rate limit: No specific limit, pero bueno para ~1k/day
 */

export interface LobSendLetterRequest {
  to: {
    name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip: string;
  };
  from: {
    name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip: string;
  };
  html: string; // HTML content
  subject: string;
  apiKey: string;
}

export interface LobLetter {
  id: string;
  to: Record<string, unknown>;
  from: Record<string, unknown>;
  url: string; // PDF URL
  tracking_events: Array<{
    type: string;
    name: string;
    created_at: string;
  }>;
  status: string; // 'processed', 'in_transit', 'delivered', 'returned_to_sender'
  expected_delivery_date?: string;
}

export interface LobWebhookSignature {
  timestamp: number;
  signature: string;
}

/**
 * Lob.com API client con retry automático.
 */
export class LobClient {
  private readonly logger = new Logger(LobClient.name);
  private readonly apiUrl = 'https://api.lob.com/v1';
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;
  private readonly timeoutMs = 30000;

  /**
   * Enviar letter vía Lob.com (correo certificado digital).
   */
  async sendLetter(request: LobSendLetterRequest): Promise<LobLetter> {
    const { html, to, from, subject, apiKey } = request;

    const payload = {
      to,
      from,
      html,
      subject,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await axios.post<LobLetter>(
          `${this.apiUrl}/letters`,
          payload,
          {
            auth: {
              username: apiKey,
              password: '', // Lob uses API key as username, blank password
            },
            timeout: this.timeoutMs,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'SEMSE/2.0',
            },
          }
        );

        this.logger.debug(`Lob letter sent successfully`, {
          letterId: response.data.id,
          status: response.data.status,
        });

        return response.data;
      } catch (error) {
        const err = error as AxiosError;
        lastError = error as Error;

        this.logger.warn(`Lob API attempt ${attempt + 1}/${this.maxRetries} failed`, {
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

    throw lastError || new Error('Lob API failed after retries');
  }

  /**
   * Transformar errores de Lob a formato esperado.
   */
  private transformError(error: AxiosError): Error {
    const status = error.response?.status || 500;
    const data = (error.response?.data as Record<string, unknown>) || {};

    const message = (data.message as string) || error.message || 'Lob API error';
    return new Error(`LOB_${status}: ${message}`);
  }

  /**
   * Verificar webhook signature (HMAC-256).
   * Lob envía X-Lob-Signature header.
   */
  static verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    const computed = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload, 'utf-8')
      .digest('hex');

    return computed === signature;
  }
}

/**
 * Mock Lob client para testing.
 */
export class MockLobClient implements Partial<LobClient> {
  private readonly logger = new Logger('MockLobClient');

  async sendLetter(request: LobSendLetterRequest): Promise<LobLetter> {
    const { to, subject } = request;

    this.logger.debug(`Mock Lob: sending letter to ${to.name}`);

    return {
      id: `ltr_mock_${Date.now()}`,
      to,
      from: request.from,
      url: `https://cdn.lob.com/mock/${Date.now()}.pdf`,
      tracking_events: [
        {
          type: 'processed',
          name: 'Processed for delivery',
          created_at: new Date().toISOString(),
        },
      ],
      status: 'processed',
      expected_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    };
  }
}

/**
 * Factory para crear cliente real o mock.
 */
export function createLobClient(apiKey: string, useMock = false): LobClient | MockLobClient {
  if (useMock || !apiKey) {
    return new MockLobClient();
  }
  const client = new LobClient();
  // Inyectar apiKey si es necesario
  return client;
}
