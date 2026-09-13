import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isCoreKey } from '@/lib/columns'

const Body = z.object({
  /** The value to write onto rows that have nothing for this column. */
  value: z.string().min(1),
  /** Limit to one sheet, or every school in the database. */
  sheetId: z.string().nullish(),
  /**
   * false (default) fills only rows where the column is empty, so an existing
   * answer is never clobbered. true overwrites everything.
   */
  overwrite: z.boolean().default(false),
})

/**
 * Give every existing school a value for a newly added column, instead of
 * leaving thousands of blanks behind.
 *
 * Custom columns live in the School.extra JSON blob, so this is a single
 * jsonb merge over the matching rows rather than a read-modify-write per row.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/columns/[id]/backfill'>) {
  const { error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad request' },
      { status: 400 }
    )
  }

  const column = await prisma.columnDef.findUnique({ where: { id } })
  if (!column) return Response.json({ error: 'Column not found' }, { status: 404 })
  if (column.isCore || isCoreKey(column.key)) {
    return Response.json(
      { error: 'Built-in columns cannot be bulk-filled from here' },
      { status: 400 }
    )
  }

  const { value, sheetId, overwrite } = parsed.data
  const patch = JSON.stringify({ [column.key]: value })

  // Scope. Filling the whole database is allowed but has to be asked for.
  const sheetClause = sheetId
    ? Prisma.sql`AND "sheetId" = ${sheetId}`
    : Prisma.empty

  // Only touch rows with no answer yet, unless overwriting was requested.
  // `->>` yields NULL for a missing key as well as a null value, so this
  // covers both without the jsonb `?` operator, whose question mark collides
  // with the driver's parameter placeholders.
  const emptyClause = overwrite
    ? Prisma.empty
    : Prisma.sql`AND COALESCE(extra ->> ${column.key}, '') = ''`

  const count = await prisma.$executeRaw(
    Prisma.sql`UPDATE "School"
       SET extra = COALESCE(extra, '{}'::jsonb) || ${patch}::jsonb
       WHERE TRUE ${sheetClause} ${emptyClause}`
  )

  return Response.json({ ok: true, count })
}
