import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ThemeStockWithLeader } from "@brain-lock/kiwoom";

interface ThemeStockItemProps {
  stock: ThemeStockWithLeader;
  themeId: number;
  onRemove: (themeId: number, stockCode: string) => void;
  onToggleLeader: (
    themeId: number,
    stockCode: string,
    current: boolean
  ) => void;
}

export function ThemeStockItem({
  stock,
  themeId,
  onRemove,
  onToggleLeader,
}: ThemeStockItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `stock-${themeId}-${stock.stockCode}`,
      data: { type: "stock", themeId, stockCode: stock.stockCode },
    });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded group"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-gray-600 cursor-grab active:cursor-grabbing select-none shrink-0"
        title="드래그해서 순서 변경"
      >
        ≡
      </span>
      <button
        type="button"
        onClick={() =>
          onToggleLeader(themeId, stock.stockCode, stock.manualLeader)
        }
        title={stock.manualLeader ? "수동 주도주 해제" : "수동 주도주 지정"}
        className="text-sm shrink-0"
      >
        {stock.isLeader ? "⭐" : "☆"}
      </button>
      <span className="flex-1 text-sm text-white truncate">
        {stock.stockName}
      </span>
      <span className="text-xs text-gray-500 font-mono">{stock.stockCode}</span>
      {stock.rankingData && (
        <span
          className={`text-xs font-mono ${Number(stock.rankingData.changeRate) >= 0 ? "text-red-400" : "text-blue-400"}`}
        >
          {stock.rankingData.changeRate}%
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(themeId, stock.stockCode)}
        className="text-gray-600 hover:text-white text-xs opacity-0 group-hover:opacity-100 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
