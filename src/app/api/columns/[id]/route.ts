import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { apiUser } from '@/lib/auth'
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
    return Response.json({ error: 'Built-in columns keep their type' }, { status: 400 })
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

/**
 * How many schools actually hold a value for this column. Deleting is allowed,
 * but never blind: the caller has to have been told this number and send it
 * back, so the loss is always a deliberate choice rather than a mis-click.
 */
async function valueCount(key: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(
    Prisma.sql`SELECT count(*)::bigint AS n
       FROM "School"
       WHERE COALESCE(extra ->> ${key}, '') <> ''`
  )
  return Number(rows[0]?.n ?? 0)
}

/**
 * GET tells you what deleting would cost, so the confirmation can name a real
 * number instead of a vague warning.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/columns/[id]'>) {
  const { error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const column = await prisma.columnDef.findUnique({ where: { id } })
  if (!column) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({
    column,
    filledRows: column.isCore ? null : await valueCount(column.key),
  })
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/columns/[id]'>) {
  const { error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const column = await prisma.columnDef.findUnique({ where: { id } })
  if (!column) return Response.json({ error: 'Not found' }, { status: 404 })

  // Core columns back real School fields the dashboard is calculated from.
  // Nobody deletes these - they can be hidden instead.
  if (column.isCore) {
    return Response.json(
      { error: 'Built-in columns cannot be deleted. Hide it instead.' },
      { status: 400 }
    )
  }

  const filled = await valueCount(column.key)
  const url = new URL(request.url)
  const claimed = Number(url.searchParams.get('expectedRows'))

  if (!Number.isFinite(claimed) || claimed !== filled) {
    return Response.json(
      {
        error:
          filled === 0
            ? 'Confirm the deletion to continue.'
            : `${filled} school(s) have a value in "${column.label}". That data is lost. Confirm to continue.`,
        filledRows: filled,
      },
      { status: 409 }
    )
  }

  // Drop the column definition and the values stored under its key. Without
  // the second step the data would linger invisibly in every row's JSON.
  await prisma.$transaction([
    // `->>` is NULL for a missing key, which avoids the jsonb `?` operator -
    // its question mark collides with the driver's parameter placeholders.
    prisma.$executeRaw(
      Prisma.sql`UPDATE "School"
         SET extra = extra - ${column.key}
         WHERE extra ->> ${column.key} IS NOT NULL`
    ),
    prisma.columnDef.delete({ where: { id } }),
  ])

  return Response.json({ ok: true, clearedFrom: filled })
}
