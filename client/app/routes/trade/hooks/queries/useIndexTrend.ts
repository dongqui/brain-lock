import { useQuery } from "@tanstack/react-query";
import { isMarketHours } from "~/shared/utils";

export type IndexTrend = {
  name: string;
  index: number | null;
  changeRate: number | null;
  isDowntrend: boolean;
  downStreak: number;
  upStreak: number;
};

async function fetchIndexTrend(market: "0" | "1"): Promise<IndexTrend> {
  const res = await fetch(`/api/index?market=${market}`);
  if (!res.ok) throw new Error("지수 데이터를 불러오지 못했습니다.");
  return res.json();
}

export function useIndexTrend(market: "0" | "1" | null) {
  return useQuery({
    queryKey: ["indexTrend", market],
    queryFn: () => fetchIndexTrend(market as "0" | "1"),
    enabled: market != null,
    refetchInterval: isMarketHours() ? 60_000 : false,
    staleTime: 60_000,
  });
}
