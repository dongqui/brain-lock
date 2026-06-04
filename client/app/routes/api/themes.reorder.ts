import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const body = await request.json() as { ids?: number[] }
  if (!Array.isArray(body.ids)) {
    return Response.json({ error: 'ids array required' }, { status: 400 })
  }
  await Promise.all(
    body.ids.map((id, index) =>
      prisma.theme.update({ where: { id }, data: { order: index } })
    )
  )
  return new Response(null, { status: 204 })
}
