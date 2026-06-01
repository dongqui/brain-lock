import { useState } from "react";
import { Modal } from "~/shared/components/Modal";

const CHECKS = [
  "주도 테마 주도주인가?",
  "장 초반 혹은 급등 후 추격 매수는 아닌가?",
  "상위 차트가 괜찮은가?",
  "돌파, 상다, 눌림목 - 내가 아는 패턴인가?",
] as const;

interface TradeConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TradeConfirmModal({
  open,
  onCancel,
  onConfirm,
}: TradeConfirmModalProps) {
  const [checked, setChecked] = useState<boolean[]>(() =>
    Array(CHECKS.length).fill(false)
  );

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function handleConfirm() {
    setChecked(Array(CHECKS.length).fill(false));
    onConfirm();
  }

  function handleCancel() {
    setChecked(Array(CHECKS.length).fill(false));
    onCancel();
  }

  const allChecked = checked.every(Boolean);

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="매수 전 체크리스트"
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
            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold transition-colors"
          >
            매수 주문
          </button>
        </div>
      }
    >
      <p className="text-sm text-red-700">* 당장 버는 것이 중요하지 않아. </p>
      <p className="text-sm text-red-700">* 원칙을 지켜야해.</p>
      <ul className="space-y-3 mt-4">
        {CHECKS.map((label, i) => (
          <li key={label}>
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
    </Modal>
  );
}
