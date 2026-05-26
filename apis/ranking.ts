import { kiwoomClient } from "./client.js";
import type {
  GetTopTradingValueParams,
  GetTopTradingValueResponse,
} from "./types.js";

export async function getTopTradingValue(
  params: GetTopTradingValueParams = {}
): Promise<GetTopTradingValueResponse> {
  const {
    marketType = "000",
    includeManagedStocks = false,
    exchangeType = "3",
  } = params;

  const { data } = await kiwoomClient.post<GetTopTradingValueResponse>(
    "/api/dostk/rkinfo",
    {
      mrkt_tp: marketType,
      mang_stk_incls: includeManagedStocks ? "1" : "0",
      stex_tp: exchangeType,
    },
    { headers: { "api-id": "ka10032" } }
  );

  return data;
}
