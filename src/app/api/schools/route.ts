import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripSchoolCode, toContactKey, toNameKey } from '@/lib/normalize'

const Body = z.object({
  sheetId: z.string().min(1),
  name: z.string().min(1, 'School name is required'),
  district: z.string().nullish(),
  regionCategory: z
    .enum(['KERALA', 'TAMIL_NADU', 'MIDDLE_EAST', 'OTHER_STATE'])
    .default('KERALA'),
  listType: z.enum(['MASS_CALL', 'CONNECTED', 'OFFLINE_OUTREACH']).default('MASS_CALL'),
  entityType: z.enum(['SCHOOL', 'TUITION_CENTRE', 'OTHER']).default('SCHOOL'),
  contact: z.string().nullish(),
  email: z.string().nullish(),
  pocName: z.string().nullish(),
  connection: z.string().nullish(),
  remarks: z.string().nullish(),
  statusId: z.string().nullish(),
  /** Values for custom columns, keyed by ColumnDef.key. */
  extra: z.record(z.string(), z.string()).optional(),
  /** Warn rather than block - the user decides whether it is really a dupe. */
  force: z.boolean().default(false),
})

export async function POST(request: Request) {
  const { user, error } = await apiUser()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad request' },
      { status: 400 }
    )
  }
  const b = parsed.data
  const name = stripSchoolCode(b.name)
  const nameKey = toNameKey(name)

  // Same rule as the importer: a name is only a duplicate within the same
  // district, because one name can legitimately exist in several districts.
  if (!b.force) {
    const clash = await prisma.school.findFirst({
      where: { nameKey, district: b.district || null },
      select: { id: true, name: true, sheet: { select: { name: true } } },
    })
    if (clash) {
      const where = b.district ? ' in ' + b.district : ''
      return Response.json(
        {
          error: 'duplicate',
          message: clash.name + ' already exists' + where + ' (sheet: ' + clash.sheet.name + ').',
          existingId: clash.id,
        },
        { status: 409 }
      )
    }
  }

  const fallback = await prisma.outreachStatus.findFirst({ where: { isDefault: true } })
  const statusId = b.statusId || fallback?.id || null

  const school = await prisma.school.create({
    data: {
      sheetId: b.sheetId,
      name,
      nameKey,
      district: b.district || null,
      regionCategory: b.regionCategory,
      listType: b.listType,
      entityType: b.entityType,
      contact: b.contact || null,
      contactKey: toContactKey(b.contact),
      email: b.email ? b.email.toLowerCase() : null,
      pocName: b.pocName || null,
      connection: b.connection || null,
      remarks: b.remarks || null,
      statusId,
      extra: b.extra ?? {},
      createdById: user.id,
    },
    include: { status: true, assignedTo: { select: { id: true, name: true } } },
  })

  return Response.json({ ok: true, school })
}
