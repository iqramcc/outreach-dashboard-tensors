import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isCoreKey } from '@/lib/columns'
import { missingFields, WRITABLE_CORE } from '@/lib/campaign'
import { toContactKey, toNameKey } from '@/lib/normalize'

const Body = z.object({
  schoolIds: z.array(z.string().min(1)).min(1).max(2000),
  /** false removes them from the list. */
  on: z.boolean().default(true),
  /**
   * Values the member typed, per school: { schoolId: { field: value } }.
   * Per school rather than shared, because each school has its own email.
   */
  overrides: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  /**
   * Refuse the whole batch if any compulsory field is still blank, so nothing
   * half-usable reaches the admin's export.
   */
  requireComplete: z.boolean().default(false),
})

/**
 * Add schools to a list, or take them off it.
 *
 * Anything the member types for a real school field is saved onto the school
 * itself, not just onto this list entry: if someone finally tracks down a
 * school's email, the next list should not have to ask for it again.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/campaigns/[id]/entries'>) {
  const { user, error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  const list = await prisma.campaignList.findUnique({ where: { id } })
  if (!list || list.isArchived) {
    return Response.json({ error: 'List not found' }, { status: 404 })
  }

  if (!parsed.data.on) {
    const res = await prisma.campaignEntry.deleteMany({
      where: { listId: id, schoolId: { in: parsed.data.schoolIds } },
    })
    return Response.json({ ok: true, removed: res.count })
  }

  const schools = await prisma.school.findMany({
    where: { id: { in: parsed.data.schoolIds } },
  })
  const required = (list.requiredFields as string[]) ?? []
  const overrides = parsed.data.overrides ?? {}

  const notReady = schools
    .map((s) => ({
      id: s.id,
      name: s.name,
      missing: missingFields(s, overrides[s.id] ?? {}, required),
    }))
    .filter((r) => r.missing.length > 0)

  // Nothing is written when the caller asked for a complete batch and it is
  // not - a half-added batch would be worse than a refusal.
  if (parsed.data.requireComplete && notReady.length > 0) {
    return Response.json(
      {
        error: 'Some schools are still missing a compulsory field',
        notReady,
      },
      { status: 409 }
    )
  }

  // Save what was typed onto the schools themselves, so the data is fixed
  // everywhere rather than only inside this list.
  const schoolWrites = []
  for (const s of schools) {
    const typed = overrides[s.id]
    if (!typed) continue

    const data: Record<string, unknown> = {}
    const extra = { ...((s.extra ?? {}) as Record<string, string>) }
    let touchedExtra = false

    for (const [key, raw] of Object.entries(typed)) {
      const value = String(raw).trim()
      if (!value) continue

      if (isCoreKey(key)) {
        if (!WRITABLE_CORE.has(key)) continue
        data[key] = value
        // Keep the duplicate-detection keys in step with what they mirror.
        if (key === 'name') data.nameKey = toNameKey(value)
        if (key === 'contact') data.contactKey = toContactKey(value)
      } else {
        extra[key] = value
        touchedExtra = true
      }
    }

    if (touchedExtra) data.extra = extra
    if (Object.keys(data).length > 0) {
      schoolWrites.push(prisma.school.update({ where: { id: s.id }, data }))
    }
  }
  if (schoolWrites.length > 0) await prisma.$transaction(schoolWrites)

  const res = await prisma.campaignEntry.createMany({
    data: schools.map((s) => ({
      listId: id,
      schoolId: s.id,
      addedById: user.id,
      // The values now live on the school, so the entry holds no copy of them
      // and the export always reflects the school as it stands today.
      data: {},
    })),
    // Already on the list is success, not a duplicate row.
    skipDuplicates: true,
  })

  return Response.json({
    ok: true,
    added: res.count,
    alreadyThere: schools.length - res.count,
    updatedSchools: schoolWrites.length,
    notReady,
  })
}
