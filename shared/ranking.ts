import { kiwoomClient } from "./client.js";
import type {
  GetTopTradingValueParams,
  GetTopTradingValueResponse,
  TopTradingValueItem,
} from "./types.js";

export async function getTopTradingValue(
  params: GetTopTradingValueParams = {}
): Promise<GetTopTradingValueResponse> {
  const {
    marketType = "000",
    includeManagedStocks = true,
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
  data.trde_prica_upper = data.trde_prica_upper.filter(
    (stock) => !isExcludedStock(stock)
  );
  return data;
}

function isExcludedStock(stock: TopTradingValueItem) {
  const name = stock.stk_nm.toUpperCase();

  return (
    name.includes("ETF") ||
    name.includes("ETN") ||
    name.includes("스팩") ||
    name.includes("SPAC") ||
    name.includes("KODEX ") ||
    name.includes("TIGER ") ||
    name.includes("SOL ") ||
    name.includes("RISE ")
  );
}
