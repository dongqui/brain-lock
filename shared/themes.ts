export type RankingItem = {
  stockCode: string
  stockName: string
  tradingValue: string
  changeRate: string
  rank: number
}

export type ThemeStockWithLeader = {
  stockCode: string
  stockName: string
  manualLeader: boolean
  isLeader: boolean
  order: number
  rankingData?: {
    tradingValue: string
    changeRate: string
  }
}

export type ThemeWithLeader = {
  id: number
  name: string
  order: number
  collapsed: boolean
  themeScore: number
  isLeadingTheme: boolean
  stocks: ThemeStockWithLeader[]
  leadingStock: { stockCode: string; stockName: string } | null
}

export type ThemesApiResponse = {
  themes: ThemeWithLeader[]
  rankingItems: RankingItem[]
}
