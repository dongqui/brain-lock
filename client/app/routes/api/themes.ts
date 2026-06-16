import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'
import { getTopTradingValue } from '@brain-lock/kiwoom'
import { buildThemesResponse } from '~/lib/themeScoring.server'

export async function loader() {
  const [themes, rankingResult] = await Promise.all([
    prisma.theme.findMany({
      include: { stocks: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    }),
    getTopTradingValue().catch(() => ({ trde_prica_upper: [] as never[] })),
  ])

  const rankingItems = rankingResult.trde_prica_upper ?? []
  return Response.json(buildThemesResponse(themes, rankingItems))
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const body = await request.json() as { name?: string }
  if (!body.name?.trim()) {
    return Response.json({ error: 'name required' }, { status: 400 })
  }
  const maxOrder = await prisma.theme.aggregate({ _max: { order: true } })
  const theme = await prisma.theme.create({
    data: { name: body.name.trim(), order: (maxOrder._max.order ?? 0) + 1 },
  })
  return Response.json(theme, { status: 201 })
}
