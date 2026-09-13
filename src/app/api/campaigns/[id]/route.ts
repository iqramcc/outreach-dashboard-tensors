import { z } from 'zod'
import { apiAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
  requiredFields: z.array(z.string()).optional(),
  optionalFields: z.array(z.string()).optional(),
  order: z.number().int().optional(),
})

export async function PATCH(request: Request, ctx: RouteContext<'/api/campaigns/[id]'>) {
  const { error } = await apiAdmin()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  if (parsed.data.name) {
    const clash = await prisma.campaignList.findFirst({
      where: { name: parsed.data.name.trim(), NOT: { id } },
    })
    if (clash) {
      return Response.json({ error: 'A list with that name already exists' }, { status: 409 })
    }
  }

  const list = await prisma.campaignList.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
    },
  })
  return Response.json({ ok: true, list })
}

/**
 * Archived rather than deleted, and only once it is empty of unsent work -
 * a list that has been sent from is a record of what went out, and throwing
 * that away silently would lose the team's own history.
 */
export async function DELETE(request: Request, ctx: RouteContext<'/api/campaigns/[id]'>) {
  const { error } = await apiAdmin()
  if (error) return error

  const { id } = await ctx.params
  const list = await prisma.campaignList.findUnique({
    where: { id },
    include: { _count: { select: { entries: true } } },
  })
  if (!list) return Response.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(request.url)
  const claimed = Number(url.searchParams.get('expectedEntries'))
  if (!Number.isFinite(claimed) || claimed !== list._count.entries) {
    return Response.json(
      {
        error: `"${list.name}" holds ${list._count.entries} school(s). Confirm that number to remove it.`,
        entries: list._count.entries,
      },
      { status: 409 }
    )
  }

  await prisma.campaignList.update({ where: { id }, data: { isArchived: true } })
  return Response.json({ ok: true })
}
