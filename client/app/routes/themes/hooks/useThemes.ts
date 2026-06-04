import { useQuery } from '@tanstack/react-query'
import type { ThemesApiResponse } from '@brain-lock/kiwoom'
import { isMarketHours } from '~/shared/utils'

async function fetchThemes(): Promise<ThemesApiResponse> {
  const res = await fetch('/api/themes')
  if (!res.ok) throw new Error('테마 데이터를 불러오지 못했습니다.')
  return res.json()
}

export const themesQueryKey = ['themes'] as const

export function useThemes() {
  return useQuery({
    queryKey: themesQueryKey,
    queryFn: fetchThemes,
    refetchInterval: isMarketHours() ? 5 * 60 * 1000 : false,
    staleTime: 60_000,
  })
}
