import type { SectorMarketType } from "@brain-lock/kiwoom";

export const DOWN_TICK_THRESHOLD = 3; // 연속 3틱 하락 → 하락세 진입
export const REBOUND_TICK_THRESHOLD = 3; // 연속 3틱 반등 → 하락세 해제

export type TrendResult = {
  isDowntrend: boolean;
  downStreak: number;
  upStreak: number;
};

type TrendState = {
  prev: number | null;
  downStreak: number;
  upStreak: number;
  isDowntrend: boolean;
};

export function createTrendTracker(
  downThreshold: number = DOWN_TICK_THRESHOLD,
  reboundThreshold: number = REBOUND_TICK_THRESHOLD
) {
  const states = new Map<SectorMarketType, TrendState>();

  function recordTick(market: SectorMarketType, index: number): TrendResult {
    const s = states.get(market) ?? {
      prev: null,
      downStreak: 0,
      upStreak: 0,
      isDowntrend: false,
    };

    if (s.prev !== null) {
      if (index < s.prev) {
        s.downStreak++;
        s.upStreak = 0;
      } else if (index > s.prev) {
        s.upStreak++;
        s.downStreak = 0;
      } else {
        s.downStreak = 0;
        s.upStreak = 0;
      }
    }
    s.prev = index;

    if (!s.isDowntrend && s.downStreak >= downThreshold) {
      s.isDowntrend = true;
    } else if (s.isDowntrend && s.upStreak >= reboundThreshold) {
      s.isDowntrend = false;
    }

    states.set(market, s);
    return {
      isDowntrend: s.isDowntrend,
      downStreak: s.downStreak,
      upStreak: s.upStreak,
    };
  }

  return { recordTick };
}

let singleton: ReturnType<typeof createTrendTracker> | null = null;

export function getTrendTracker() {
  if (!singleton) singleton = createTrendTracker();
  return singleton;
}
