import { fetchAccountEvaluation, sellStock } from "@brain-lock/kiwoom";
import { computeForeignSells } from "./computeForeign";
import {
  getGuardSetting,
  getApprovedMap,
  getPendingMap,
  clearExpiredPendingSells,
  insertPendingSell,
} from "./ledger.server";

const POLL_MS = 3000;
const PENDING_TTL_MS = 60_000;

async function tick() {
  const setting = await getGuardSetting();
  if (!setting.enabled) return;

  await clearExpiredPendingSells(PENDING_TTL_MS);

  const [acct, approved, pending] = await Promise.all([
    fetchAccountEvaluation(),
    getApprovedMap(),
    getPendingMap(),
  ]);

  const sells = computeForeignSells(acct.holdings, approved, pending);

  for (const s of sells) {
    let res: Awaited<ReturnType<typeof sellStock>>;
    try {
      res = await sellStock({
        stk_cd: s.stockCode,
        ord_qty: String(s.qty),
        ord_uv: "",
        trde_tp: "3", // 시장가
      });
    } catch (e) {
      console.error(`[guard] 매도 실패 ${s.stockName}(${s.stockCode}) x${s.qty}`, e);
      continue;
    }

    // 매도는 접수됨. pending 기록 실패 시 다음 틱 중복 매도 위험이 있으므로 구분해 로깅.
    try {
      await insertPendingSell(s.stockCode, s.qty, res.ord_no);
      console.log(
        `[guard] 외부 포지션 시장가 매도: ${s.stockName}(${s.stockCode}) x${s.qty} ord_no=${res.ord_no ?? "?"}`
      );
    } catch (e) {
      console.error(
        `[guard] CRITICAL: 매도 접수됐으나 PendingSell 기록 실패 — 다음 틱 중복 매도 위험 ${s.stockName}(${s.stockCode}) x${s.qty} ord_no=${res.ord_no ?? "?"}`,
        e
      );
    }
  }
}

/** 서버 부팅 시 1회 호출. globalThis 가드로 중복 시작 방지(dev HMR 포함). */
export function startWatcher() {
  const g = globalThis as unknown as {
    __guardWatcher?: ReturnType<typeof setInterval>;
  };
  if (g.__guardWatcher) return;

  let running = false;
  g.__guardWatcher = setInterval(() => {
    if (running) return; // 직전 틱이 아직 진행 중이면 건너뜀(틱 겹침 → 중복 매도 방지)
    running = true;
    tick()
      .catch((e) => console.error("[guard] tick error", e))
      .finally(() => {
        running = false;
      });
  }, POLL_MS);
  console.log("[guard] balance watcher 시작");
}
