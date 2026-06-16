import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const themeId = Number(params.id)
  const body = await request.json() as { stockCodes?: string[] }
  if (!Array.isArray(body.stockCodes)) {
    return Response.json({ error: 'stockCodes array required' }, { status: 400 })
  }
  await Promise.all(
    body.stockCodes.map((stockCode, index) =>
      prisma.themeStock.update({
        where: { themeId_stockCode: { themeId, stockCode } },
        data: { order: index },
      })
    )
  )
  return new Response(null, { status: 204 })
}
