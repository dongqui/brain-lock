import assert from "node:assert/strict";
import { createTrendTracker } from "./indexTrend.server";

// 첫 틱은 비교 없음(prev 설정만), 연속 3틱 하락에 진입
{
  const { recordTick } = createTrendTracker(3, 3);
  assert.equal(recordTick("0", 100).isDowntrend, false); // prev=100
  assert.equal(recordTick("0", 99).isDowntrend, false); // down1
  assert.equal(recordTick("0", 98).isDowntrend, false); // down2
  const r = recordTick("0", 97); // down3
  assert.equal(r.isDowntrend, true);
  assert.equal(r.downStreak, 3);
}

// 반등 1틱으론 해제 안 됨 (sticky)
{
  const { recordTick } = createTrendTracker(3, 3);
  [100, 99, 98, 97].forEach((v) => recordTick("0", v)); // isDowntrend=true
  const r = recordTick("0", 98); // up1
  assert.equal(r.isDowntrend, true);
  assert.equal(r.upStreak, 1);
  assert.equal(r.downStreak, 0);
}

// 연속 3틱 반등해야 해제
{
  const { recordTick } = createTrendTracker(3, 3);
  [100, 99, 98, 97].forEach((v) => recordTick("0", v)); // true
  recordTick("0", 98); // up1
  recordTick("0", 99); // up2
  const r = recordTick("0", 100); // up3
  assert.equal(r.isDowntrend, false);
}

// 보합은 양쪽 스트릭 리셋 → 하락세 진입 지연
{
  const { recordTick } = createTrendTracker(3, 3);
  recordTick("0", 100);
  recordTick("0", 99); // down1
  recordTick("0", 99); // 보합 → reset
  recordTick("0", 98); // down1
  assert.equal(recordTick("0", 97).isDowntrend, false); // down2 only
}

// 시장별 상태 독립
{
  const { recordTick } = createTrendTracker(3, 3);
  [100, 99, 98, 97].forEach((v) => recordTick("0", v));
  assert.equal(recordTick("1", 500).isDowntrend, false);
  assert.equal(recordTick("1", 501).isDowntrend, false);
}

console.log("indexTrend.server.test.ts OK");
