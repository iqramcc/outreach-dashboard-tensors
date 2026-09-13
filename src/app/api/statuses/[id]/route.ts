import { z } from 'zod'
import { apiAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

const HEX = /^#[0-9a-fA-F]{6}$/

const Body = z.object({
  name: z.string().min(1).optional(),
  hex: z.string().regex(HEX).optional(),
  order: z.number().int().optional(),
  isContacted: z.boolean().optional(),
  isPositive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

export async function PATCH(request: Request, ctx: RouteContext<'/api/statuses/[id]'>) {
  const { error } = await apiAdmin()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  // Only one status can be the default for new rows.
  if (parsed.data.isDefault) {
    await prisma.outreachStatus.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  const status = await prisma.outreachStatus.update({ where: { id }, data: parsed.data })
  return Response.json({ ok: true, status })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/statuses/[id]'>) {
  const { error } = await apiAdmin()
  if (error) return error
  const { id } = await ctx.params

  // Schools keep existing with a null status (School.statusId is SetNull), so
  // deleting a label never deletes anyone's data - but say how many it frees.
  const affected = await prisma.school.count({ where: { statusId: id } })
  await prisma.outreachStatus.delete({ where: { id } })
  return Response.json({ ok: true, clearedFrom: affected })
}
