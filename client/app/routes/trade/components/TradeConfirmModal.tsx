import { useState } from "react";
import { Modal } from "~/shared/components/Modal";
import { useStockThemeStatus } from "~/routes/themes/hooks/useStockThemeStatus";

interface TradeConfirmModalProps {
  open: boolean;
  side: "buy" | "sell";
  stockCode: string | null;
  changeRate: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TradeConfirmModal({
  open,
  side,
  stockCode,
  changeRate,
  onCancel,
  onConfirm,
}: TradeConfirmModalProps) {
  const themeStatus = useStockThemeStatus(stockCode);
  const [checked, setChecked] = useState<boolean[]>([false, false]);

  const isChase = changeRate != null && changeRate >= 15;
  const chaseLabel =
    changeRate == null
      ? "등락률 확인 중..."
      : isChase
      ? `⚠️ 현재 등락률 +${changeRate.toFixed(1)}% — 추격 매수 아닌가?`
      : `✅ 등락률 ${changeRate >= 0 ? "+" : ""}${changeRate.toFixed(1)}% — 추격 매수 아님`;

  const themeLabel = themeStatus.isLeader
    ? `✅ ${themeStatus.themeName} (${themeStatus.rank}위) 주도주`
    : themeStatus.isInTop2
    ? `🟡 ${themeStatus.themeName} 소속 (주도주 아님)`
    : `⚠️ 상위 2개 테마 미등록`;

  const checks = [chaseLabel, themeLabel];

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function reset() {
    setChecked([false, false]);
  }

  function handleConfirm() {
    reset();
    onConfirm();
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  const allChecked = side === "sell" || checked.every(Boolean);

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={side === "buy" ? "매수 전 체크리스트" : "매도 확인"}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-2.5 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allChecked}
            className={`flex-1 py-2.5 rounded-lg disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors ${
              side === "buy"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {side === "buy" ? "매수 주문" : "매도 주문"}
          </button>
        </div>
      }
    >
      {side === "buy" ? (
        <>
          <p className="text-sm text-red-700">* 당장 버는 것이 중요하지 않아.</p>
          <p className="text-sm text-red-700">* 원칙을 지켜야해.</p>
          <ul className="space-y-3 mt-4">
            {checks.map((label, i) => (
              <li key={i}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    onChange={() => toggle(i)}
                    className="mt-0.5 accent-red-500 w-4 h-4 shrink-0"
                  />
                  <span className="text-sm text-gray-200">{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-gray-300">매도 주문을 접수하시겠습니까?</p>
      )}
    </Modal>
  );
}
