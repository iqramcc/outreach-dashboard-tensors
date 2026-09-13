import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const HEX = /^#[0-9a-fA-F]{6}$/

const Patch = z.object({
  name: z.string().min(1).optional(),
  hex: z.string().regex(HEX).optional(),
})

const Apply = z.object({
  /** Schools to mark or unmark. */
  schoolIds: z.array(z.string().min(1)).min(1).max(1000),
  on: z.boolean(),
})

/** Every route here is scoped to the caller, so one person's marks are theirs alone. */
async function ownTag(userId: string, id: string) {
  return prisma.personalTag.findFirst({ where: { id, userId } })
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/personal/tags/[id]'>) {
  const { user, error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  if (!(await ownTag(user.id, id))) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = Patch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  const tag = await prisma.personalTag.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
    },
  })
  return Response.json({ ok: true, tag })
}

/** Mark or unmark schools with this tag. */
export async function POST(request: Request, ctx: RouteContext<'/api/personal/tags/[id]'>) {
  const { user, error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  if (!(await ownTag(user.id, id))) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = Apply.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  if (parsed.data.on) {
    await prisma.schoolPersonalTag.createMany({
      data: parsed.data.schoolIds.map((schoolId) => ({ schoolId, tagId: id })),
      skipDuplicates: true,
    })
  } else {
    await prisma.schoolPersonalTag.deleteMany({
      where: { tagId: id, schoolId: { in: parsed.data.schoolIds } },
    })
  }

  return Response.json({ ok: true, count: parsed.data.schoolIds.length })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/personal/tags/[id]'>) {
  const { user, error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  if (!(await ownTag(user.id, id))) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Removing a private mark takes no shared data with it, so no confirmation
  // dance here - the rows it pointed at are untouched.
  await prisma.personalTag.delete({ where: { id } })
  return Response.json({ ok: true })
}
