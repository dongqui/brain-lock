import type { TopTradingValueItem } from '@brain-lock/kiwoom'
import type { ThemeWithLeader, ThemeStockWithLeader, RankingItem, ThemesApiResponse } from '@brain-lock/kiwoom'

type RawThemeStock = {
  stockCode: string
  stockName: string
  manualLeader: boolean
}

type RawTheme = {
  id: number
  name: string
  order: number
  stocks: RawThemeStock[]
}

function stockScore(item: TopTradingValueItem, maxTV: number, maxCR: number): number {
  const tv = maxTV > 0 ? (Number(item.trde_prica) || 0) / maxTV : 0
  const cr = maxCR > 0 ? Math.abs(Number(item.flu_rt) || 0) / maxCR : 0
  return tv * 0.6 + cr * 0.4
}

export function buildThemesResponse(
  themes: RawTheme[],
  rankingItems: TopTradingValueItem[]
): ThemesApiResponse {
  const rankingMap = new Map(rankingItems.map(r => [r.stk_cd, r]))

  const allTV = rankingItems.map(r => Number(r.trde_prica) || 0)
  const allCR = rankingItems.map(r => Math.abs(Number(r.flu_rt)) || 0)
  const maxTV = allTV.length > 0 ? Math.max(...allTV) : 1
  const maxCR = allCR.length > 0 ? Math.max(...allCR) : 1

  const scored = themes.map((theme): ThemeWithLeader => {
    const manualLeader = theme.stocks.find(s => s.manualLeader)

    let leaderCode: string | null = null

    if (manualLeader) {
      leaderCode = manualLeader.stockCode
    } else {
      let best = -1
      for (const s of theme.stocks) {
        const rankItem = rankingMap.get(s.stockCode)
        if (!rankItem) continue
        const score = stockScore(rankItem, maxTV, maxCR)
        if (score > best) {
          best = score
          leaderCode = s.stockCode
        }
      }
    }

    const stocks: ThemeStockWithLeader[] = theme.stocks.map(s => {
      const rankItem = rankingMap.get(s.stockCode)
      return {
        stockCode: s.stockCode,
        stockName: s.stockName,
        manualLeader: s.manualLeader,
        isLeader: s.stockCode === leaderCode,
        rankingData: rankItem
          ? { tradingValue: rankItem.trde_prica, changeRate: rankItem.flu_rt }
          : undefined,
      }
    })

    const inRanking = theme.stocks
      .map(s => rankingMap.get(s.stockCode))
      .filter((r): r is TopTradingValueItem => r !== undefined)

    const themeScore =
      inRanking.length === 0
        ? 0
        : inRanking.length *
          (inRanking.reduce((sum, r) => sum + stockScore(r, maxTV, maxCR), 0) / inRanking.length)

    const leadingStock = leaderCode
      ? (theme.stocks.find(s => s.stockCode === leaderCode) ?? null)
      : null

    return {
      id: theme.id,
      name: theme.name,
      order: theme.order,
      themeScore,
      isLeadingTheme: false,
      stocks,
      leadingStock: leadingStock
        ? { stockCode: leadingStock.stockCode, stockName: leadingStock.stockName }
        : null,
    }
  })

  scored.sort((a, b) => b.themeScore - a.themeScore)
  if (scored.length > 0) scored[0].isLeadingTheme = true

  scored.sort((a, b) => a.order - b.order)

  const normalizedRanking: RankingItem[] = rankingItems.map((r, i) => ({
    stockCode: r.stk_cd,
    stockName: r.stk_nm,
    tradingValue: r.trde_prica,
    changeRate: r.flu_rt,
    rank: i + 1,
  }))

  return { themes: scored, rankingItems: normalizedRanking }
}
