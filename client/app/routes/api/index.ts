import type { LoaderFunctionArgs } from "react-router";
import { getCompositeIndex } from "@brain-lock/kiwoom";
import { getTrendTracker } from "~/lib/indexTrend.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const market = new URL(request.url).searchParams.get("market");
  if (market !== "0" && market !== "1") {
    return Response.json({ error: "invalid market" }, { status: 400 });
  }

  try {
    const composite = await getCompositeIndex(market);
    const trend = getTrendTracker().recordTick(market, composite.index);
    return Response.json({
      name: composite.name,
      index: composite.index,
      changeRate: composite.changeRate,
      isDowntrend: trend.isDowntrend,
      downStreak: trend.downStreak,
      upStreak: trend.upStreak,
    });
  } catch {
    // 폴백: 매수 차단하지 않도록 중립 상태 반환
    return Response.json({
      name: market === "0" ? "코스피" : "코스닥",
      index: null,
      changeRate: null,
      isDowntrend: false,
      downStreak: 0,
      upStreak: 0,
    });
  }
}
