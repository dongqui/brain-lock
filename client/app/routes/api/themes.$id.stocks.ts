import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const themeId = Number(params.id)
  const body = await request.json() as { stockCode?: string; stockName?: string }
  if (!body.stockCode || !body.stockName) {
    return Response.json({ error: 'stockCode and stockName required' }, { status: 400 })
  }
  const maxOrder = await prisma.themeStock.aggregate({
    where: { themeId },
    _max: { order: true },
  })
  const stock = await prisma.themeStock.upsert({
    where: { themeId_stockCode: { themeId, stockCode: body.stockCode } },
    create: {
      themeId,
      stockCode: body.stockCode,
      stockName: body.stockName,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    update: {},
  })
  return Response.json(stock, { status: 201 })
}
