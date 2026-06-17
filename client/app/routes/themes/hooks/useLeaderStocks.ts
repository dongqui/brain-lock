import { useMemo } from 'react'
import { useThemes } from './useThemes'

export function useLeaderStocks(): Set<string> {
  const { data } = useThemes()
  return useMemo(() => {
    const top2 = data
      ? [...data.themes].sort((a, b) => b.themeScore - a.themeScore).slice(0, 2)
      : []
    const codes = top2.flatMap(t => t.stocks.filter(s => s.isLeader).map(s => s.stockCode))
    return new Set(codes)
  }, [data])
}
