import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { missingFields } from '@/lib/campaign'

const Body = z.object({
  schoolIds: z.array(z.string().min(1)).min(1).max(2000),
  /** false removes them from the list. */
  on: z.boolean().default(true),
  /** Values typed in for fields the school row does not carry. */
  data: z.record(z.string(), z.string()).optional(),
})

/**
 * Add schools to a list, or take them off it.
 *
 * Members do this as they work, which is the point of the lists. The values
 * are pulled from the school itself, so nothing has to be retyped; anything
 * the school genuinely lacks comes back as "not ready" rather than being
 * silently exported blank.
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
  const overrides = parsed.data.data ?? {}

  // Report what is incomplete rather than refusing: the team often adds a
  // school first and chases the missing email afterwards.
  const notReady = schools
    .map((s) => ({ id: s.id, name: s.name, missing: missingFields(s, overrides, required) }))
    .filter((r) => r.missing.length > 0)

  const res = await prisma.campaignEntry.createMany({
    data: schools.map((s) => ({
      listId: id,
      schoolId: s.id,
      addedById: user.id,
      data: overrides,
    })),
    // Already on the list is success, not a duplicate row.
    skipDuplicates: true,
  })

  return Response.json({
    ok: true,
    added: res.count,
    alreadyThere: schools.length - res.count,
    notReady,
  })
}
