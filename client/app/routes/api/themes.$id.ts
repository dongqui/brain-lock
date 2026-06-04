import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const id = Number(params.id)
  await prisma.theme.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
