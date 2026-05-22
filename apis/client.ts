import { KiwoomAuthService, REST_BASE_URL } from './auth.js';
import type { KiwoomConfig, KiwoomEnvironment, KiwoomResponseBase } from './types.js';

export class KiwoomRestClient {
  private readonly staticAccessToken?: string;
  private readonly auth?: KiwoomAuthService;
  private readonly baseUrl: string;

  constructor(config: KiwoomConfig) {
    const environment: KiwoomEnvironment = config.environment ?? 'production';
    this.staticAccessToken = config.accessToken;
    this.auth = config.credentials ? new KiwoomAuthService(config.credentials, environment) : undefined;
    this.baseUrl = REST_BASE_URL[environment];

    if (!this.staticAccessToken && !this.auth) {
      throw new Error('KiwoomRestClient requires either accessToken or credentials.');
    }
  }

  async post<TResponse extends KiwoomResponseBase>(apiId: string, path: string, body: unknown): Promise<TResponse> {
    const authorization = await this.getAuthorizationHeader();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'api-id': apiId,
        authorization,
      },
      body: JSON.stringify(body ?? {}),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(`Kiwoom REST ${apiId} failed: HTTP ${response.status} ${text}`);
    }

    if (data?.return_code !== undefined && Number(data.return_code) !== 0) {
      throw new Error(`Kiwoom REST ${apiId} failed: ${data.return_code} ${data.return_msg ?? ''}`);
    }

    return data as TResponse;
  }

  private async getAuthorizationHeader(): Promise<string> {
    if (this.staticAccessToken) return `Bearer ${this.staticAccessToken}`;
    return this.auth!.getAuthorizationHeader();
  }
}
