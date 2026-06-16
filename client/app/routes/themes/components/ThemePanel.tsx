import type { ThemeWithLeader } from "@brain-lock/kiwoom";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ThemeStockItem } from "./ThemeStockItem";

interface ThemePanelProps {
  theme: ThemeWithLeader;
  onDelete: (id: number) => void;
  onRemoveStock: (themeId: number, stockCode: string) => void;
  onToggleLeader: (
    themeId: number,
    stockCode: string,
    current: boolean
  ) => void;
  onToggleCollapse: (themeId: number, collapsed: boolean) => void;
  isDropTarget?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function ThemePanel({
  theme,
  onDelete,
  onRemoveStock,
  onToggleLeader,
  onToggleCollapse,
  isDropTarget = false,
  dragHandleProps,
}: ThemePanelProps) {
  const collapsed = theme.collapsed;
  return (
    <div
      className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
        isDropTarget ? "border-blue-500 bg-gray-800" : "border-gray-700"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <div
          {...dragHandleProps}
          className="text-gray-500 cursor-grab active:cursor-grabbing select-none px-1"
          title="드래그해서 순서 변경"
        >
          ≡
        </div>
        <button
          type="button"
          onClick={() => onToggleCollapse(theme.id, !collapsed)}
          className="text-gray-500 hover:text-white text-xs w-4 shrink-0"
          title={collapsed ? "펼치기" : "접기"}
        >
          {collapsed ? "▶" : "▼"}
        </button>
        <span className="flex-1 text-sm font-semibold text-white">
          {theme.name}
        </span>
        {collapsed && (
          <span className="text-xs text-gray-500">
            {theme.stocks.length}종목
          </span>
        )}

        {theme.isLeadingTheme && (
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
            ⭐ 주도 테마
          </span>
        )}
        <button
          type="button"
          onClick={() => onDelete(theme.id)}
          className="text-gray-600 hover:text-red-400 text-xs"
        >
          삭제
        </button>
      </div>
      {!collapsed && (
        <div className="py-1 min-h-[40px]">
          {theme.stocks.length === 0 ? (
            <p className="text-xs text-gray-600 px-3 py-2">
              종목을 드래그해서 추가하세요
            </p>
          ) : (
            <SortableContext
              items={theme.stocks.map(
                (s) => `stock-${theme.id}-${s.stockCode}`
              )}
              strategy={verticalListSortingStrategy}
            >
              {theme.stocks.map((stock) => (
                <ThemeStockItem
                  key={stock.stockCode}
                  stock={stock}
                  themeId={theme.id}
                  onRemove={onRemoveStock}
                  onToggleLeader={onToggleLeader}
                />
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}
