import { kiwoomClient } from "./client.js";
import type {
  StockCancelOrderRequest,
  StockCancelOrderResponse,
  StockModifyOrderRequest,
  StockModifyOrderResponse,
  StockOrderRequest,
  StockOrderResponse,
} from "./types.js";

const ORDER_PATH = "/api/dostk/ordr";

function normalizeOrderBody(body: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ dmst_stex_tp: "SOR", ...body }).map(([key, value]) => [
      key,
      value == null ? "" : String(value),
    ])
  );
}

export function buyStock(
  request: StockOrderRequest
): Promise<StockOrderResponse> {
  return kiwoomClient
    .post<StockOrderResponse>(ORDER_PATH, normalizeOrderBody(request), {
      headers: { "api-id": "kt10000" },
    })
    .then((r) => r.data);
}

export function sellStock(
  request: StockOrderRequest
): Promise<StockOrderResponse> {
  return kiwoomClient
    .post<StockOrderResponse>(ORDER_PATH, normalizeOrderBody(request), {
      headers: { "api-id": "kt10001" },
    })
    .then((r) => r.data);
}

export function modifyStockOrder(
  request: StockModifyOrderRequest
): Promise<StockModifyOrderResponse> {
  return kiwoomClient
    .post<StockModifyOrderResponse>(ORDER_PATH, normalizeOrderBody(request), {
      headers: { "api-id": "kt10002" },
    })
    .then((r) => r.data);
}

export function cancelStockOrder(
  request: StockCancelOrderRequest
): Promise<StockCancelOrderResponse> {
  return kiwoomClient
    .post<StockCancelOrderResponse>(ORDER_PATH, normalizeOrderBody(request), {
      headers: { "api-id": "kt10003" },
    })
    .then((r) => r.data);
}
