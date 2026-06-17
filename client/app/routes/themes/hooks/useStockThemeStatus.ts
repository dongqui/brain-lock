import { useMemo } from "react";
import { useThemes } from "./useThemes";

export type StockThemeStatus = {
  isLeader: boolean;
  isInTop2: boolean;
  themeName: string | null;
  rank: 1 | 2 | null;
};

export function useStockThemeStatus(
  stockCode: string | null
): StockThemeStatus {
  const { data } = useThemes();
  return useMemo(() => {
    if (!stockCode || !data) {
      return { isLeader: false, isInTop2: false, themeName: null, rank: null };
    }
    const top2 = [...data.themes]
      .sort((a, b) => b.themeScore - a.themeScore)
      .slice(0, 2);
    for (let i = 0; i < top2.length; i++) {
      const theme = top2[i];
      const stock = theme.stocks.find(
        (s) => s.stockCode.split("_")[0] === stockCode
      );
      if (stock) {
        return {
          isLeader: stock.isLeader,
          isInTop2: true,
          themeName: theme.name,
          rank: (i + 1) as 1 | 2,
        };
      }
    }
    return { isLeader: false, isInTop2: false, themeName: null, rank: null };
  }, [stockCode, data]);
}
