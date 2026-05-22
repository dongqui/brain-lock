import { KiwoomRestClient } from './client.js';
import type {
  StockCancelOrderRequest,
  StockCancelOrderResponse,
  StockModifyOrderRequest,
  StockModifyOrderResponse,
  StockOrderRequest,
  StockOrderResponse,
} from './types.js';

const ORDER_PATH = '/api/dostk/ordr';

function normalizeOrderBody(body: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ dmst_stex_tp: 'SOR', ...body }).map(([key, value]) => [key, value == null ? '' : String(value)]),
  );
}

export class KiwoomOrderService {
  constructor(private readonly client: KiwoomRestClient) {}

  buyStock(request: StockOrderRequest): Promise<StockOrderResponse> {
    return this.client.post<StockOrderResponse>('kt10000', ORDER_PATH, normalizeOrderBody(request));
  }

  sellStock(request: StockOrderRequest): Promise<StockOrderResponse> {
    return this.client.post<StockOrderResponse>('kt10001', ORDER_PATH, normalizeOrderBody(request));
  }

  modifyStockOrder(request: StockModifyOrderRequest): Promise<StockModifyOrderResponse> {
    return this.client.post<StockModifyOrderResponse>('kt10002', ORDER_PATH, normalizeOrderBody(request));
  }

  cancelStockOrder(request: StockCancelOrderRequest): Promise<StockCancelOrderResponse> {
    return this.client.post<StockCancelOrderResponse>('kt10003', ORDER_PATH, normalizeOrderBody(request));
  }
}
