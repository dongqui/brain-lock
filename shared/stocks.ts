import { kiwoomClient } from "./client.js";
import type { SectorMarketType } from "./types.js";

export type KiwoomMarketType =
  | "0" // 코스피
  | "10"; // 코스닥

export type KiwoomStockMasterItem = {
  code: string;
  name: string;
  market?: SectorMarketType;
  marketCode?: string;
  marketName?: string;
  lastPrice?: string;
  state?: string;
  raw: Record<string, unknown>;
};

type KiwoomStockMasterRawItem = {
  code?: string;
  name?: string;
  listCount?: string;
  auditInfo?: string;
  regDay?: string;
  lastPrice?: string;
  state?: string;
  marketCode?: string;
  marketName?: string;
  upName?: string;
  upSizeName?: string;
  companyClassName?: string;
  orderWarning?: string;
  nxtEnable?: string;
};

type KiwoomStockMasterResponse = {
  list?: KiwoomStockMasterRawItem[];
  return_code?: number;
  return_msg?: string;
};

export async function fetchStockMasterByMarket(
  marketType: KiwoomMarketType
): Promise<KiwoomStockMasterItem[]> {
  const response = await kiwoomClient.post<KiwoomStockMasterResponse>(
    "/api/dostk/stkinfo",
    {
      mrkt_tp: marketType,
    },
    {
      headers: {
        "api-id": "ka10099",
      },
    }
  );

  return (response.data.list ?? [])
    .filter((item) => item.code && item.name)
    .map((item: KiwoomStockMasterRawItem) => ({
      code: item.code!,
      name: item.name!,
      market: (marketType === "0" ? "0" : "1") as SectorMarketType,
      marketCode: item.marketCode,
      marketName: item.marketName,
      lastPrice: item.lastPrice,
      state: item.state,
      raw: item as Record<string, unknown>,
    }));
}

export async function fetchKoreanStockMaster(): Promise<
  KiwoomStockMasterItem[]
> {
  const [kospi, kosdaq] = await Promise.all([
    fetchStockMasterByMarket("0"),
    fetchStockMasterByMarket("10"),
  ]);

  return [...kospi, ...kosdaq];
}
