import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  sheetId: z.string().min(1),
  /** The rows being moved, in the order they should end up. */
  ids: z.array(z.string().min(1)).min(1).max(500),
  /** 1-based position in the sheet the block should land at. */
  targetPosition: z.number().int().min(1),
})

/** Below this the float gap is too small to split again; renumber first. */
const MIN_GAP = 1e-6
const STEP = 1000

/**
 * Evenly spaced values strictly between `lo` and `hi`, either of which may be
 * null when the block is going to the very start or very end.
 */
function spread(lo: number | null, hi: number | null, n: number): number[] | null {
  if (lo === null && hi === null) {
    return Array.from({ length: n }, (_, i) => (i + 1) * STEP)
  }
  if (lo === null) {
    return Array.from({ length: n }, (_, i) => hi! - (n - i) * STEP)
  }
  if (hi === null) {
    return Array.from({ length: n }, (_, i) => lo + (i + 1) * STEP)
  }
  const gap = (hi - lo) / (n + 1)
  if (gap < MIN_GAP) return null // out of precision - caller renumbers
  return Array.from({ length: n }, (_, i) => lo + gap * (i + 1))
}

/**
 * Rewrite every position in the sheet as 1000, 2000, 3000... Only needed after
 * a long run of inserts into the same gap has exhausted float precision. One
 * statement, and invisible to the team - the order does not change.
 */
async function renumber(sheetId: string) {
  await prisma.$executeRaw(
    Prisma.sql`UPDATE "School" s
       SET position = t.rn * ${STEP}
       FROM (
         SELECT id, row_number() OVER (ORDER BY position, "createdAt", id) AS rn
         FROM "School" WHERE "sheetId" = ${sheetId}
       ) t
       WHERE s.id = t.id`
  )
}

/**
 * Move rows to a position in the sheet.
 *
 * Cost is one write per moved row - never per row in the sheet - because the
 * serial number is not stored. It is the row's place in this ordering,
 * rendered; so "everything below moves down by one" happens for free.
 */
export async function POST(request: Request) {
  const { error } = await apiUser()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })
  const { sheetId, ids, targetPosition } = parsed.data

  const moving = await prisma.school.findMany({
    where: { id: { in: ids }, sheetId },
    select: { id: true },
  })
  if (moving.length !== ids.length) {
    return Response.json(
      { error: 'Some of those rows are not in this sheet' },
      { status: 400 }
    )
  }

  async function place(): Promise<number[] | null> {
    // The sheet's order with the moved rows taken out - that is what the
    // target index counts against.
    const others = await prisma.school.findMany({
      where: { sheetId, id: { notIn: ids } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { position: true },
    })

    const idx = Math.max(0, Math.min(targetPosition - 1, others.length))
    const lo = idx > 0 ? others[idx - 1].position : null
    const hi = idx < others.length ? others[idx].position : null
    return spread(lo, hi, ids.length)
  }

  let positions = await place()
  if (!positions) {
    await renumber(sheetId)
    positions = await place()
  }
  if (!positions) {
    return Response.json({ error: 'Could not work out a position' }, { status: 500 })
  }

  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.school.update({ where: { id }, data: { position: positions[i] } })
    )
  )

  return Response.json({ ok: true, moved: ids.length })
}
