import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  const themeId = Number(params.id)
  const stockCode = params.code as string

  if (request.method === 'DELETE') {
    await prisma.themeStock.delete({
      where: { themeId_stockCode: { themeId, stockCode } },
    })
    return new Response(null, { status: 204 })
  }

  if (request.method === 'PATCH') {
    const body = await request.json() as { manualLeader?: boolean }
    const updated = await prisma.themeStock.update({
      where: { themeId_stockCode: { themeId, stockCode } },
      data: { manualLeader: body.manualLeader ?? false },
    })
    return Response.json(updated)
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
