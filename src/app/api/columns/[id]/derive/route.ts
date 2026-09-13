import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isCoreKey } from '@/lib/columns'

/**
 * Core keys that are real scalar columns on School and can be read as text.
 *
 * Whitelisted deliberately: these names are interpolated into SQL as
 * identifiers, which parameters cannot do, so nothing outside this list is
 * ever allowed through. "status" and "assignedTo" are absent on purpose -
 * they are relations, not text on the row.
 */
const READABLE_CORE = new Set([
  'name',
  'primaryPoc',
  'schoolType',
  'financeType',
  'studentStrength',
  'strength8',
  'strength9',
  'strength10',
  'strengthTotal',
  'district',
  'state',
  'connection',
  'pocName',
  'pocRole',
  'contact',
  'email',
  'address',
  'website',
  'remarks',
  'registeredStudents',
])

const Body = z.object({
  mode: z.enum(['copy', 'merge']),
  /** Column to read from. */
  from: z.string().min(1),
  /** Second column, for merge. */
  from2: z.string().min(1).optional(),
  /** What goes between the two values. Anything, including a space. */
  separator: z.string().max(20).default(' '),
  sheetId: z.string().nullish(),
  /** false (default) fills only rows where the new column is still empty. */
  overwrite: z.boolean().default(false),
})

/** A SQL fragment yielding the column's value as text, '' when absent. */
function readAsText(key: string): Prisma.Sql | null {
  if (isCoreKey(key)) {
    if (!READABLE_CORE.has(key)) return null
    // Safe: `key` has just been checked against a fixed whitelist.
    return Prisma.sql`COALESCE(${Prisma.raw(`"${key}"`)}::text, '')`
  }
  return Prisma.sql`COALESCE(extra ->> ${key}::text, '')`
}

/**
 * Fill a column from the ones already there - either a straight copy, or two
 * columns merged with a separator of the user's choosing.
 *
 * Runs as one UPDATE over the matching rows rather than reading and writing
 * each row in turn.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/columns/[id]/derive'>) {
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
  const b = parsed.data

  const target = await prisma.columnDef.findUnique({ where: { id } })
  if (!target) return Response.json({ error: 'Column not found' }, { status: 404 })
  if (target.isCore) {
    return Response.json(
      { error: 'Built-in columns cannot be filled from other columns' },
      { status: 400 }
    )
  }
  if (b.from === target.key || b.from2 === target.key) {
    return Response.json({ error: 'A column cannot be filled from itself' }, { status: 400 })
  }

  const a = readAsText(b.from)
  if (!a) return Response.json({ error: 'Cannot read that column' }, { status: 400 })

  let value: Prisma.Sql
  if (b.mode === 'copy') {
    value = a
  } else {
    if (!b.from2) {
      return Response.json({ error: 'Merging needs a second column' }, { status: 400 })
    }
    const second = readAsText(b.from2)
    if (!second) return Response.json({ error: 'Cannot read that column' }, { status: 400 })
    // concat_ws skips empty parts, so a row with only one of the two values
    // does not end up with a dangling separator.
    value = Prisma.sql`concat_ws(${b.separator}::text, NULLIF(${a}, ''), NULLIF(${second}, ''))`
  }

  const sheetClause = b.sheetId ? Prisma.sql`AND "sheetId" = ${b.sheetId}` : Prisma.empty
  const emptyClause = b.overwrite
    ? Prisma.empty
    : Prisma.sql`AND COALESCE(extra ->> ${target.key}::text, '') = ''`

  const count = await prisma.$executeRaw(
    Prisma.sql`UPDATE "School"
       SET extra = COALESCE(extra, '{}'::jsonb) || jsonb_build_object(${target.key}::text, ${value})
       WHERE COALESCE(${value}, '') <> ''
       ${sheetClause}
       ${emptyClause}`
  )

  return Response.json({ ok: true, count })
}
