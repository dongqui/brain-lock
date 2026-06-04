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
    const manualLeader = body.manualLeader ?? false

    if (manualLeader) {
      // 테마당 수동 주도주는 하나만 — 기존 지정을 모두 해제한 뒤 대상만 지정
      await prisma.$transaction([
        prisma.themeStock.updateMany({
          where: { themeId, manualLeader: true },
          data: { manualLeader: false },
        }),
        prisma.themeStock.update({
          where: { themeId_stockCode: { themeId, stockCode } },
          data: { manualLeader: true },
        }),
      ])
    } else {
      await prisma.themeStock.update({
        where: { themeId_stockCode: { themeId, stockCode } },
        data: { manualLeader: false },
      })
    }
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
