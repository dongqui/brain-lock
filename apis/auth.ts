import type {
  KiwoomCredentials,
  KiwoomEnvironment,
  KiwoomResponseBase,
  KiwoomTokenIssueResponse,
} from "./types.ts";

export const REST_BASE_URL: Record<KiwoomEnvironment, string> = {
  production: "https://api.kiwoom.com",
  mock: "https://mockapi.kiwoom.com",
};

const TOKEN_REFRESH_BUFFER_MS = 60_000;

function parseKiwoomExpiresAt(expiresDt?: string): number | undefined {
  // 문서 예시: 20241107083713 (YYYYMMDDHHmmss)
  if (!expiresDt || !/^\d{14}$/.test(expiresDt)) return undefined;

  const year = Number(expiresDt.slice(0, 4));
  const month = Number(expiresDt.slice(4, 6)) - 1;
  const day = Number(expiresDt.slice(6, 8));
  const hour = Number(expiresDt.slice(8, 10));
  const minute = Number(expiresDt.slice(10, 12));
  const second = Number(expiresDt.slice(12, 14));

  return new Date(year, month, day, hour, minute, second).getTime();
}

async function readJsonResponse<T extends KiwoomResponseBase>(
  response: Response,
  apiId: string
): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      `Kiwoom Auth ${apiId} failed: HTTP ${response.status} ${text}`
    );
  }

  if (data?.return_code !== undefined && Number(data.return_code) !== 0) {
    throw new Error(
      `Kiwoom Auth ${apiId} failed: ${data.return_code} ${data.return_msg ?? ""}`
    );
  }

  return data as T;
}

export class KiwoomAuthService {
  private token?: string;
  private tokenType = "Bearer";
  private expiresAt?: number;
  private issuing?: Promise<string>;
  private readonly baseUrl: string;

  constructor(
    private readonly credentials: KiwoomCredentials,
    environment: KiwoomEnvironment = "production"
  ) {
    this.baseUrl = REST_BASE_URL[environment];
  }

  async getAccessToken(): Promise<string> {
    if (this.isTokenUsable()) return this.token!;
    this.issuing ??= this.issueToken().finally(() => {
      this.issuing = undefined;
    });
    return this.issuing;
  }

  async getAuthorizationHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `${this.tokenType} ${token}`;
  }

  async issueToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": "au10001",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: this.credentials.appkey,
        secretkey: this.credentials.secretkey,
      }),
    });

    const data = await readJsonResponse<KiwoomTokenIssueResponse>(
      response,
      "au10001"
    );
    this.token = data.token;
    this.tokenType =
      data.token_type?.toLowerCase() === "bearer"
        ? "Bearer"
        : data.token_type || "Bearer";
    this.expiresAt = parseKiwoomExpiresAt(data.expires_dt);
    return this.token;
  }

  async revokeToken(token = this.token): Promise<void> {
    if (!token) return;

    const response = await fetch(`${this.baseUrl}/oauth2/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": "au10002",
        authorization: `${this.tokenType} ${token}`,
      },
      body: JSON.stringify({
        appkey: this.credentials.appkey,
        secretkey: this.credentials.secretkey,
        token,
      }),
    });

    await readJsonResponse<KiwoomResponseBase>(response, "au10002");

    if (token === this.token) {
      this.token = undefined;
      this.expiresAt = undefined;
    }
  }

  private isTokenUsable(): boolean {
    if (!this.token) return false;
    if (!this.expiresAt) return true;
    return Date.now() + TOKEN_REFRESH_BUFFER_MS < this.expiresAt;
  }
}
