import { z } from 'zod'
import { apiAdmin, apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  label: z.string().min(1).optional(),
  type: z
    .enum([
      'TEXT',
      'LONGTEXT',
      'NUMBER',
      'PHONE',
      'EMAIL',
      'SELECT',
      'SELECT_FREE',
      'DATE',
      'CHECKBOX',
    ])
    .optional(),
  order: z.number().int().optional(),
  isVisible: z.boolean().optional(),
  width: z.number().int().min(60).max(600).nullish(),
  options: z.array(z.string()).nullish(),
})

/** Relabelling, reordering and hiding change no data, so members may. */
export async function PATCH(request: Request, ctx: RouteContext<'/api/columns/[id]'>) {
  const { error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  const existing = await prisma.columnDef.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
  // A core column's key backs a real database field; its label and position
  // are free to change but its type is not.
  if (existing.isCore && parsed.data.type) {
    return Response.json(
      { error: 'Built-in columns keep their type' },
      { status: 400 }
    )
  }

  const column = await prisma.columnDef.update({
    where: { id },
    data: {
      ...parsed.data,
      options: parsed.data.options === undefined ? undefined : (parsed.data.options ?? undefined),
    },
  })
  return Response.json({ ok: true, column })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/columns/[id]'>) {
  const { error } = await apiAdmin()
  if (error) return error
  const { id } = await ctx.params

  const column = await prisma.columnDef.findUnique({ where: { id } })
  if (!column) return Response.json({ error: 'Not found' }, { status: 404 })

  // Core columns back real School fields that the dashboard's district and
  // funnel maths depends on, so they can be hidden but never deleted.
  if (column.isCore) {
    return Response.json(
      { error: 'Built-in columns cannot be deleted. Hide it instead.' },
      { status: 400 }
    )
  }

  await prisma.columnDef.delete({ where: { id } })
  return Response.json({ ok: true })
}
