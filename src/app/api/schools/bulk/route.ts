import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildSchoolWhere } from '@/lib/schoolFilter'

const Filter = z.object({
  sheetId: z.string().nullish(),
  q: z.string().nullish(),
  district: z.string().nullish(),
  region: z.string().nullish(),
  list: z.string().nullish(),
  status: z.string().nullish(),
  assigned: z.string().nullish(),
  due: z.string().nullish(),
})

const Body = z.object({
  /** Assign the rows ticked on screen, or everything matching the filters. */
  scope: z.enum(['ids', 'filter']),
  ids: z.array(z.string()).optional(),
  filter: Filter.optional(),
  /** null unassigns. */
  assignedToId: z.string().nullable(),
})

/**
 * Hand a batch of schools to one volunteer - either the rows they ticked, or
 * the whole filtered list ("all 277 in Thiruvananthapuram", "everything not
 * contacted yet").
 *
 * Members may assign, including to themselves, since claiming a stretch of the
 * call list is ordinary work. Nothing here deletes anything.
 */
export async function POST(request: Request) {
  const { error } = await apiUser()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })
  const b = parsed.data

  if (b.assignedToId) {
    const target = await prisma.user.findUnique({
      where: { id: b.assignedToId },
      select: { isActive: true },
    })
    if (!target?.isActive) {
      return Response.json({ error: 'That member is not active' }, { status: 400 })
    }
  }

  let where
  if (b.scope === 'ids') {
    if (!b.ids || b.ids.length === 0) {
      return Response.json({ error: 'No rows selected' }, { status: 400 })
    }
    where = { id: { in: b.ids } }
  } else {
    if (!b.filter) return Response.json({ error: 'No filter given' }, { status: 400 })
    where = buildSchoolWhere(b.filter)
    // Assigning the entire database by accident would be very hard to undo.
    if (!b.filter.sheetId) {
      return Response.json(
        { error: 'Pick a sheet before assigning a whole list' },
        { status: 400 }
      )
    }
  }

  const res = await prisma.school.updateMany({
    where,
    data: { assignedToId: b.assignedToId },
  })

  return Response.json({ ok: true, count: res.count })
}
