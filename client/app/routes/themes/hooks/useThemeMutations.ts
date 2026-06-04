import { useMutation, useQueryClient } from '@tanstack/react-query'
import { themesQueryKey } from './useThemes'

export function useThemeMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: themesQueryKey })

  const createTheme = useMutation({
    mutationFn: (name: string) =>
      fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(r => r.json()),
    onSuccess: invalidate,
  })

  const deleteTheme = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/themes/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const addStock = useMutation({
    mutationFn: ({ themeId, stockCode, stockName }: { themeId: number; stockCode: string; stockName: string }) =>
      fetch(`/api/themes/${themeId}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockCode, stockName }),
      }),
    onSuccess: invalidate,
  })

  const removeStock = useMutation({
    mutationFn: ({ themeId, stockCode }: { themeId: number; stockCode: string }) =>
      fetch(`/api/themes/${themeId}/stocks/${stockCode}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const toggleLeader = useMutation({
    mutationFn: ({ themeId, stockCode, manualLeader }: { themeId: number; stockCode: string; manualLeader: boolean }) =>
      fetch(`/api/themes/${themeId}/stocks/${stockCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualLeader }),
      }),
    onSuccess: invalidate,
  })

  const reorderThemes = useMutation({
    mutationFn: (ids: number[]) =>
      fetch('/api/themes/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }),
    onSuccess: invalidate,
  })

  return { createTheme, deleteTheme, addStock, removeStock, toggleLeader, reorderThemes }
}
