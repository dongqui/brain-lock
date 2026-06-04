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
  const stock = await prisma.themeStock.upsert({
    where: { themeId_stockCode: { themeId, stockCode: body.stockCode } },
    create: { themeId, stockCode: body.stockCode, stockName: body.stockName },
    update: {},
  })
  return Response.json(stock, { status: 201 })
}
