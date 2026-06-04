import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import type { ThemeWithLeader, RankingItem } from '@brain-lock/kiwoom'
import { useThemes, themesQueryKey } from './themes/hooks/useThemes'
import { useThemeMutations } from './themes/hooks/useThemeMutations'
import { ThemePanel } from './themes/components/ThemePanel'

function DraggableRankingItem({ item }: { item: RankingItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ranking-${item.stockCode}`,
    data: { type: 'ranking', item },
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-grab active:cursor-grabbing rounded transition-opacity ${isDragging ? 'opacity-30' : ''}`}
    >
      <span className="text-xs text-gray-500 w-5 text-right shrink-0">{item.rank}</span>
      <span className="flex-1 text-sm text-white truncate">{item.stockName}</span>
      <span className={`text-xs font-mono shrink-0 ${Number(item.changeRate) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
        {Number(item.changeRate) >= 0 ? '+' : ''}{item.changeRate}%
      </span>
    </div>
  )
}

function SortableThemePanel({
  theme,
  onDelete,
  onRemoveStock,
  onToggleLeader,
}: {
  theme: ThemeWithLeader
  onDelete: (id: number) => void
  onRemoveStock: (themeId: number, stockCode: string) => void
  onToggleLeader: (themeId: number, stockCode: string, current: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isOver } = useSortable({
    id: `theme-${theme.id}`,
    data: { type: 'theme', themeId: theme.id },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <ThemePanel
        theme={theme}
        onDelete={onDelete}
        onRemoveStock={onRemoveStock}
        onToggleLeader={onToggleLeader}
        isDropTarget={isOver}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

export default function Themes() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useThemes()
  const mutations = useThemeMutations()
  const [newThemeName, setNewThemeName] = useState('')
  const [activeRankingItem, setActiveRankingItem] = useState<RankingItem | null>(null)

  const themes = data?.themes ?? []
  const rankingItems = data?.rankingItems ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const item = event.active.data.current?.item as RankingItem | undefined
    if (item) setActiveRankingItem(item)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRankingItem(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('ranking-') && overId.startsWith('theme-')) {
      const item = active.data.current?.item as RankingItem | undefined
      const themeId = Number(overId.replace('theme-', ''))
      if (item) {
        mutations.addStock.mutate({ themeId, stockCode: item.stockCode, stockName: item.stockName })
      }
      return
    }

    if (activeId.startsWith('theme-') && overId.startsWith('theme-') && activeId !== overId) {
      const oldIndex = themes.findIndex(t => `theme-${t.id}` === activeId)
      const newIndex = themes.findIndex(t => `theme-${t.id}` === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(themes, oldIndex, newIndex)
        mutations.reorderThemes.mutate(reordered.map(t => t.id))
      }
    }
  }

  function handleCreateTheme(e: React.FormEvent) {
    e.preventDefault()
    if (!newThemeName.trim()) return
    mutations.createTheme.mutate(newThemeName.trim(), {
      onSuccess: () => setNewThemeName(''),
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">주도 테마 분석</h1>
          <a href="/" className="text-sm text-gray-400 hover:text-white">← 주문</a>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-[280px_1fr] gap-6">
            {/* Left: Ranking */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <span className="text-sm font-semibold text-white">거래대금 상위</span>
                <button
                  type="button"
                  onClick={() => queryClient.invalidateQueries({ queryKey: themesQueryKey })}
                  disabled={isLoading}
                  className="text-xs text-gray-400 hover:text-white disabled:opacity-40"
                >
                  {isLoading ? '로딩...' : '새로고침'}
                </button>
              </div>
              <div className="overflow-y-auto max-h-[600px]">
                {rankingItems.map(item => (
                  <DraggableRankingItem key={item.stockCode} item={item} />
                ))}
                {rankingItems.length === 0 && !isLoading && (
                  <p className="text-xs text-gray-600 px-3 py-4 text-center">데이터 없음</p>
                )}
              </div>
            </div>

            {/* Right: Themes */}
            <div className="space-y-3">
              <form onSubmit={handleCreateTheme} className="flex gap-2">
                <input
                  type="text"
                  value={newThemeName}
                  onChange={e => setNewThemeName(e.target.value)}
                  placeholder="새 테마 이름"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newThemeName.trim() || mutations.createTheme.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg"
                >
                  + 테마 추가
                </button>
              </form>

              <SortableContext
                items={themes.map(t => `theme-${t.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {themes.map(theme => (
                  <SortableThemePanel
                    key={theme.id}
                    theme={theme}
                    onDelete={id => mutations.deleteTheme.mutate(id)}
                    onRemoveStock={(themeId, stockCode) =>
                      mutations.removeStock.mutate({ themeId, stockCode })
                    }
                    onToggleLeader={(themeId, stockCode, current) =>
                      mutations.toggleLeader.mutate({ themeId, stockCode, manualLeader: !current })
                    }
                  />
                ))}
              </SortableContext>

              {themes.length === 0 && !isLoading && (
                <p className="text-sm text-gray-500 text-center py-8">
                  테마를 추가하고 거래대금 상위 종목을 드래그해서 매핑하세요.
                </p>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeRankingItem && (
              <div className="bg-gray-800 border border-blue-500 rounded-lg px-3 py-2 text-sm text-white shadow-xl">
                {activeRankingItem.stockName}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
