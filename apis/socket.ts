import WebSocket from 'ws';
import { KiwoomAuthService } from './auth.js';
import type { KiwoomConfig, KiwoomEnvironment, RealtimeMessage, RealtimeRegisterRequest, RealtimeType } from './types.js';

const SOCKET_BASE_URL: Record<KiwoomEnvironment, string> = {
  production: 'wss://api.kiwoom.com:10000/api/dostk/websocket',
  mock: 'wss://mockapi.kiwoom.com:10000/api/dostk/websocket',
};

export class KiwoomSocketClient {
  private socket: WebSocket | null = null;
  private readonly staticAccessToken?: string;
  private readonly auth?: KiwoomAuthService;
  private readonly url: string;

  constructor(config: KiwoomConfig) {
    const environment: KiwoomEnvironment = config.environment ?? 'production';
    this.staticAccessToken = config.accessToken;
    this.auth = config.credentials ? new KiwoomAuthService(config.credentials, environment) : undefined;
    this.url = SOCKET_BASE_URL[environment];

    if (!this.staticAccessToken && !this.auth) {
      throw new Error('KiwoomSocketClient requires either accessToken or credentials.');
    }
  }

  async connect(apiId: RealtimeType = '0B'): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const authorization = await this.getAuthorizationHeader();
    this.socket = new WebSocket(this.url, {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'api-id': apiId,
        authorization,
      },
    });

    return new Promise((resolve, reject) => {
      this.socket?.once('open', () => resolve());
      this.socket?.once('error', reject);
    });
  }

  onMessage(handler: (message: RealtimeMessage) => void): void {
    this.socket?.on('message', (raw) => {
      const text = raw.toString();
      handler(JSON.parse(text) as RealtimeMessage);
    });
  }

  onClose(handler: (code: number, reason: Buffer) => void): void {
    this.socket?.on('close', handler);
  }

  register(type: RealtimeType, items: string[], groupNo = '1', refresh: '0' | '1' = '1'): void {
    this.send({
      trnm: 'REG',
      grp_no: groupNo,
      refresh,
      data: [{ item: items, type: [type] }],
    });
  }

  remove(type: RealtimeType, items: string[], groupNo = '1'): void {
    this.send({
      trnm: 'REMOVE',
      grp_no: groupNo,
      data: [{ item: items, type: [type] }],
    });
  }

  /** 주문체결(00), 잔고(04)는 종목코드와 상관없이 계좌 이벤트가 내려오므로 item은 빈 문자열로 등록 */
  registerAccountEvents(groupNo = '1'): void {
    this.send({
      trnm: 'REG',
      grp_no: groupNo,
      refresh: '1',
      data: [
        { item: [''], type: ['00'] },
        { item: [''], type: ['04'] },
      ],
    });
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private async getAuthorizationHeader(): Promise<string> {
    if (this.staticAccessToken) return `Bearer ${this.staticAccessToken}`;
    return this.auth!.getAuthorizationHeader();
  }

  private send(payload: RealtimeRegisterRequest): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Kiwoom socket is not connected. Call connect() first.');
    }
    this.socket.send(JSON.stringify(payload));
  }
}
