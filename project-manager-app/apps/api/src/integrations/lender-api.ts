import axios from 'axios';
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * Lender API client — integración con plataformas de lenders.
 * Soporta: OAuth2, draw approvals, webhooks.
 */

export interface LenderDrawStatus {
  drawId: string;
  status: 'pending' | 'approved' | 'rejected' | 'funded';
  approvalDate?: string;
  fundingDate?: string;
}

export interface LenderProject {
  projectId: string;
  status: 'active' | 'completed' | 'default';
  totalBudget: number;
  amountFunded: number;
  drawsApproved: number;
}

/**
 * Lender API client con OAuth2.
 */
export class LenderClient {
  private readonly logger = new Logger(LenderClient.name);
  private readonly apiUrl = 'https://api.lender.com/v1';
  private accessToken?: string;

  /**
   * Obtener OAuth2 access token.
   */
  async authenticate(clientId: string, clientSecret: string): Promise<string> {
    this.logger.log('Authenticating with Lender API');

    try {
      const response = await axios.post(`${this.apiUrl}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });

      this.accessToken = String(response.data.access_token);
      return this.accessToken;
    } catch (error) {
      this.logger.error('Lender authentication failed', error);
      throw error;
    }
  }

  /**
   * Obtener status de un draw desde lender.
   */
  async getDrawStatus(drawId: string): Promise<LenderDrawStatus> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/draws/${drawId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      return {
        drawId,
        status: response.data.status,
        approvalDate: response.data.approvalDate,
        fundingDate: response.data.fundingDate,
      };
    } catch (error) {
      this.logger.error(`Failed to get draw status: ${drawId}`, error);
      throw error;
    }
  }

  /**
   * Sincronizar status de proyecto con lender.
   */
  async getProjectStatus(projectId: string): Promise<LenderProject> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      return {
        projectId,
        status: response.data.status,
        totalBudget: response.data.totalBudget,
        amountFunded: response.data.amountFunded,
        drawsApproved: response.data.drawsApproved,
      };
    } catch (error) {
      this.logger.error(`Failed to get project status: ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Verificar firma de webhook.
   */
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return computed === signature;
  }
}

/**
 * Mock Lender client para testing.
 */
export class MockLenderClient {
  private readonly logger = new Logger('MockLenderClient');

  async authenticate(clientId: string, clientSecret: string): Promise<string> {
    this.logger.debug('Mock: authenticating');
    return 'mock_access_token';
  }

  async getDrawStatus(drawId: string): Promise<LenderDrawStatus> {
    this.logger.debug(`Mock: getting draw status ${drawId}`);
    return {
      drawId,
      status: 'approved',
      approvalDate: new Date().toISOString(),
    };
  }

  async getProjectStatus(projectId: string): Promise<LenderProject> {
    this.logger.debug(`Mock: getting project status ${projectId}`);
    return {
      projectId,
      status: 'active',
      totalBudget: 400000,
      amountFunded: 250000,
      drawsApproved: 3,
    };
  }

  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    return true; // Mock always passes
  }
}

/**
 * Factory.
 */
export function createLenderClient(
  clientId: string,
  clientSecret: string,
  useMock = false
): LenderClient | MockLenderClient {
  if (useMock || !clientId) {
    return new MockLenderClient();
  }
  const client = new LenderClient();
  client.authenticate(clientId, clientSecret).catch((e) => {
    console.error('Lender auth error:', e);
  });
  return client;
}
