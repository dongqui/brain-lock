import { kiwoomClient } from "./client.js";
import type {
  IndustryIndexItem,
  IndustryIndexResponse,
  IndustryTheme,
  SectorMarketType,
} from "./types.js";

// 코스피 종합지수 upjong_cd "001", 코스닥 종합지수 "101"
const COMPOSITE_CODE: Record<SectorMarketType, string> = {
  "0": "001",
  "1": "101",
};

export function toIndustryTheme(item: IndustryIndexItem): IndustryTheme {
  return {
    code: item.upjong_cd,
    name: item.upjong_nm,
    index: Number(item.cur_idx),
    change: Number(item.pred_pre),
    changeRate: Number(item.flu_rt),
    tradingVolume: Number(item.trde_qty),
    tradingAmount: Number(item.trde_prica),
    upCount: Number(item.up_cnt),
    downCount: Number(item.down_cnt),
    flatCount: Number(item.flat_cnt),
  };
}

// 종합지수 코드로 찾고, 없으면 목록 첫 항목으로 폴백 (실제 코드값 미확정 대비)
export function pickCompositeIndex(
  themes: IndustryTheme[],
  market: SectorMarketType
): IndustryTheme | undefined {
  const code = COMPOSITE_CODE[market];
  return themes.find((t) => t.code === code) ?? themes[0];
}

export async function getIndustryIndices(
  market: SectorMarketType
): Promise<IndustryTheme[]> {
  const { data } = await kiwoomClient.post<IndustryIndexResponse>(
    "/api/dostk/sector",
    { mrkt_tp: market },
    { headers: { "api-id": "ka20003" } }
  );
  return (data.upjong_index ?? []).map(toIndustryTheme);
}

export async function getCompositeIndex(
  market: SectorMarketType
): Promise<IndustryTheme> {
  const themes = await getIndustryIndices(market);
  const composite = pickCompositeIndex(themes, market);
  if (!composite) throw new Error("composite index not found");
  return composite;
}
