import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { KiwoomStockMasterItem } from "../../../../apis/stocks";

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

type NormalizedStock = KiwoomStockMasterItem & {
  normalizedName: string;
  normalizedCode: string;
};

async function fetchStockMaster(): Promise<KiwoomStockMasterItem[]> {
  const res = await fetch("/api/stocks");
  if (!res.ok) throw new Error("종목 마스터를 불러오지 못했습니다.");
  return res.json();
}

export function useStockMaster() {
  return useQuery({
    queryKey: ["stock-master"],
    queryFn: fetchStockMaster,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useStockSearch(keyword: string, limit = 30) {
  const { data, isLoading, isError } = useStockMaster();

  const normalizedStocks = useMemo<NormalizedStock[]>(() => {
    if (!data) return [];
    return data.map((stock) => ({
      ...stock,
      normalizedName: normalizeKeyword(stock.name),
      normalizedCode: normalizeKeyword(stock.code),
    }));
  }, [data]);

  const results = useMemo<KiwoomStockMasterItem[]>(() => {
    const normalizedKeyword = normalizeKeyword(keyword);
    if (!normalizedKeyword) return [];

    return normalizedStocks
      .filter(
        (stock) =>
          stock.normalizedName.includes(normalizedKeyword) ||
          stock.normalizedCode.includes(normalizedKeyword)
      )
      .slice(0, limit)
      .map(({ normalizedName, normalizedCode, ...stock }) => stock);
  }, [normalizedStocks, keyword, limit]);

  return { results, isLoading, isError };
}
