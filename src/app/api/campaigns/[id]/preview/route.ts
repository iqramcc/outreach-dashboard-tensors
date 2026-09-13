import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isCoreKey, resolveColumns } from '@/lib/columns'
import { fieldValue, missingFields, WRITABLE_CORE } from '@/lib/campaign'

const Body = z.object({
  schoolIds: z.array(z.string().min(1)).min(1).max(500),
})

/**
 * What this list will take from each of these schools, and what is still
 * missing - so the member is asked before anything is added, rather than told
 * afterwards that half the batch was unusable.
 *
 * Writes nothing.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/campaigns/[id]/preview'>) {
  const { error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  const [list, defs] = await Promise.all([
    prisma.campaignList.findUnique({ where: { id } }),
    prisma.columnDef.findMany({ where: { sheetId: null }, orderBy: { order: 'asc' } }),
  ])
  if (!list || list.isArchived) {
    return Response.json({ error: 'List not found' }, { status: 404 })
  }

  const required = (list.requiredFields as string[]) ?? []
  const optional = (list.optionalFields as string[]) ?? []
  const labels = new Map(resolveColumns(defs).map((c) => [c.key, c.label]))

  const schools = await prisma.school.findMany({ where: { id: { in: parsed.data.schoolIds } } })
  const already = await prisma.campaignEntry.findMany({
    where: { listId: id, schoolId: { in: parsed.data.schoolIds } },
    select: { schoolId: true },
  })
  const onList = new Set(already.map((a) => a.schoolId))

  const describe = (key: string, isRequired: boolean) => ({
    key,
    label: labels.get(key) ?? key,
    required: isRequired,
    // Only these can be typed in and saved back onto the school.
    fillable: isCoreKey(key) ? WRITABLE_CORE.has(key) : true,
  })

  return Response.json({
    list: { id: list.id, name: list.name },
    fields: [
      ...required.map((f) => describe(f, true)),
      ...optional.filter((f) => !required.includes(f)).map((f) => describe(f, false)),
    ],
    schools: schools.map((s) => {
      const values: Record<string, string> = {}
      for (const f of [...required, ...optional]) values[f] = fieldValue(s, {}, f)
      return {
        id: s.id,
        name: s.name,
        values,
        missingRequired: missingFields(s, {}, required),
        alreadyOnList: onList.has(s.id),
      }
    }),
  })
}
