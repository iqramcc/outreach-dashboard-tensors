import { z } from 'zod'
import { apiAdmin, apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
  order: z.number().int().optional(),
})

/** Renaming is safe, so members may do it. */
export async function PATCH(request: Request, ctx: RouteContext<'/api/sheets/[id]'>) {
  const { error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  if (parsed.data.name) {
    const name = parsed.data.name.trim()
    const clash = await prisma.sheet.findFirst({
      where: { name, isArchived: false, NOT: { id } },
    })
    if (clash) {
      return Response.json({ error: 'A sheet with that name already exists' }, { status: 409 })
    }
  }

  const sheet = await prisma.sheet.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      description: parsed.data.description === undefined ? undefined : parsed.data.description,
    },
  })
  return Response.json({ ok: true, sheet })
}

/**
 * Admins only, and never silently: deleting a sheet deletes every school row
 * in it (School.sheetId cascades), so the caller has to say how many rows it
 * expects to lose.
 */
export async function DELETE(request: Request, ctx: RouteContext<'/api/sheets/[id]'>) {
  const { error } = await apiAdmin()
  if (error) return error

  const { id } = await ctx.params
  const sheet = await prisma.sheet.findUnique({
    where: { id },
    include: { _count: { select: { schools: true } } },
  })
  if (!sheet) return Response.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(request.url)
  const confirmed = Number(url.searchParams.get('expectedRows'))
  if (!Number.isFinite(confirmed) || confirmed !== sheet._count.schools) {
    return Response.json(
      {
        error: `This sheet holds ${sheet._count.schools} school(s). Confirm that number to delete it.`,
        rows: sheet._count.schools,
      },
      { status: 409 }
    )
  }

  await prisma.sheet.delete({ where: { id } })
  return Response.json({ ok: true, deletedRows: sheet._count.schools })
}
