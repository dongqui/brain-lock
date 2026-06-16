import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  const id = Number(params.id)

  if (request.method === 'DELETE') {
    await prisma.theme.delete({ where: { id } })
    return new Response(null, { status: 204 })
  }

  if (request.method === 'PATCH') {
    const body = await request.json() as { collapsed?: boolean }
    if (typeof body.collapsed !== 'boolean') {
      return Response.json({ error: 'collapsed boolean required' }, { status: 400 })
    }
    await prisma.theme.update({ where: { id }, data: { collapsed: body.collapsed } })
    return new Response(null, { status: 204 })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
