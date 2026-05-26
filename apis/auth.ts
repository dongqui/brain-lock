import type {
  KiwoomEnvironment,
  KiwoomResponseBase,
  KiwoomTokenIssueResponse,
} from "./types.ts";

export const REST_BASE_URL: Record<KiwoomEnvironment, string> = {
  production: "https://api.kiwoom.com",
  mock: "https://mockapi.kiwoom.com",
};

const TOKEN_REFRESH_BUFFER_MS = 12 * 60 * 60 * 1000;

let _token: string | undefined;
let _tokenType = "Bearer";
let _expiresAt: number | undefined;
let _issuing: Promise<string> | undefined;

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

function isTokenUsable(): boolean {
  if (!_token) return false;
  if (!_expiresAt) return true;
  return Date.now() + TOKEN_REFRESH_BUFFER_MS < _expiresAt;
}

async function issueToken(baseUrl: string): Promise<string> {
  const appKey = import.meta.env.VITE_KIWOOM_APP_KEY ?? "";
  const secretKey = import.meta.env.VITE_KIWOOM_SECRET_KEY ?? "";

  const response = await fetch(`${baseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "api-id": "au10001",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      secretkey: secretKey,
    }),
  });

  const data = await readJsonResponse<KiwoomTokenIssueResponse>(
    response,
    "au10001"
  );
  _token = data.token;
  _tokenType =
    data.token_type?.toLowerCase() === "bearer"
      ? "Bearer"
      : data.token_type || "Bearer";
  _expiresAt = parseKiwoomExpiresAt(data.expires_dt);
  return _token;
}

export async function getAccessToken(baseUrl: string): Promise<string> {
  if (isTokenUsable()) return _token!;
  _issuing ??= issueToken(baseUrl).finally(() => {
    _issuing = undefined;
  });
  return _issuing;
}

export async function getAuthorizationHeader(baseUrl: string): Promise<string> {
  const token = await getAccessToken(baseUrl);
  return `${_tokenType} ${token}`;
}

export async function revokeToken(
  baseUrl: string,
  tokenToRevoke = _token
): Promise<void> {
  if (!tokenToRevoke) return;

  const appKey = import.meta.env.VITE_KIWOOM_APP_KEY ?? "";
  const secretKey = import.meta.env.VITE_KIWOOM_SECRET_KEY ?? "";

  const response = await fetch(`${baseUrl}/oauth2/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "api-id": "au10002",
      authorization: `${_tokenType} ${tokenToRevoke}`,
    },
    body: JSON.stringify({
      appkey: appKey,
      secretkey: secretKey,
      token: tokenToRevoke,
    }),
  });

  await readJsonResponse<KiwoomResponseBase>(response, "au10002");

  if (tokenToRevoke === _token) {
    _token = undefined;
    _expiresAt = undefined;
  }
}
