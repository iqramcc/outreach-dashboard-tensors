import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isCoreKey } from '@/lib/columns'
import { stripSchoolCode, toContactKey, toNameKey, totalStrength } from '@/lib/normalize'

/** Core fields a member may edit inline, and how to coerce each one. */
const TEXT_FIELDS = new Set([
  'name',
  'primaryPoc',
  'schoolType',
  'financeType',
  'studentStrength',
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
])

/** Per-class strengths; editing one re-derives the total. */
const STRENGTH_FIELDS = new Set(['strength8', 'strength9', 'strength10'])

const ENUM_FIELDS: Record<string, readonly string[]> = {
  entityType: ['SCHOOL', 'TUITION_CENTRE', 'OTHER'],
  regionCategory: ['KERALA', 'TAMIL_NADU', 'MIDDLE_EAST', 'OTHER_STATE'],
  listType: ['MASS_CALL', 'CONNECTED', 'OFFLINE_OUTREACH'],
}

/** One extra number, with the person's name when it is known. */
const ContactEntry = z.object({
  name: z.string().nullish(),
  number: z.string().min(1),
})

const Body = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null(), z.array(ContactEntry)]),
})

export async function PATCH(request: Request, ctx: RouteContext<'/api/schools/[id]'>) {
  const { user, error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  const { key } = parsed.data
  const raw = parsed.data.value
  const value = typeof raw === 'string' ? raw.trim() : raw

  const current = await prisma.school.findUnique({
    where: { id },
    select: {
      id: true,
      extra: true,
      statusId: true,
      strength8: true,
      strength9: true,
      strength10: true,
      strengthTotal: true,
      status: { select: { name: true } },
    },
  })
  if (!current) return Response.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}

  if (key === 'status') {
    // Status changes drive the funnel, so they are recorded as history too.
    const statusId = value ? String(value) : null
    const next = statusId
      ? await prisma.outreachStatus.findUnique({ where: { id: statusId } })
      : null
    if (statusId && !next) return Response.json({ error: 'Unknown status' }, { status: 400 })

    data.statusId = statusId
    if (next?.isContacted) data.lastContactedAt = new Date()

    await prisma.outreachLog.create({
      data: {
        schoolId: id,
        userId: user.id,
        channel: 'OTHER',
        outcome: 'Status changed',
        fromStatusName: current.status?.name ?? null,
        toStatusName: next?.name ?? null,
      },
    })
  } else if (key === 'contacts') {
    // Extra numbers live as a list; the primary one stays in the `contact`
    // column, so imports and duplicate matching keep working unchanged.
    if (!Array.isArray(value)) {
      return Response.json({ error: 'Expected a list of contacts' }, { status: 400 })
    }
    data.contacts = value
      .map((c) => ({ name: c.name?.trim() || null, number: String(c.number).trim() }))
      .filter((c) => c.number)
  } else if (key === 'assignedTo') {
    data.assignedToId = value ? String(value) : null
  } else if (key === 'nextFollowUpAt') {
    data.nextFollowUpAt = value ? new Date(String(value)) : null
  } else if (STRENGTH_FIELDS.has(key)) {
    const n = value === null || value === '' ? null : Number(value)
    if (n !== null && (!Number.isFinite(n) || n < 0)) {
      return Response.json({ error: 'Must be a number' }, { status: 400 })
    }
    data[key] = n
    // The team can fill classes 8-10 separately or just set a total; whenever
    // any class is filled the total follows from them, so the two can't drift.
    data.strengthTotal = totalStrength({
      c8: key === 'strength8' ? n : current.strength8,
      c9: key === 'strength9' ? n : current.strength9,
      c10: key === 'strength10' ? n : current.strength10,
      total: current.strengthTotal,
    })
  } else if (key === 'strengthTotal' || key === 'registeredStudents') {
    const n = value === null || value === '' ? null : Number(value)
    if (n !== null && !Number.isFinite(n)) {
      return Response.json({ error: 'Must be a number' }, { status: 400 })
    }
    data[key] = n
  } else if (key in ENUM_FIELDS) {
    if (!ENUM_FIELDS[key].includes(String(value))) {
      return Response.json({ error: 'Invalid value' }, { status: 400 })
    }
    data[key] = value
  } else if (TEXT_FIELDS.has(key)) {
    const s = value === null || value === '' ? null : String(value)
    data[key] = s
    // Keep the duplicate-detection keys in step with the values they mirror.
    if (key === 'name') {
      if (!s) return Response.json({ error: 'Name cannot be empty' }, { status: 400 })
      const clean = stripSchoolCode(s)
      data.name = clean
      data.nameKey = toNameKey(clean)
    }
    if (key === 'contact') data.contactKey = toContactKey(s)
  } else if (!isCoreKey(key)) {
    // A custom column - store it in the JSON blob.
    const extra = { ...(current.extra as Record<string, unknown>) }
    if (value === null || value === '') delete extra[key]
    else extra[key] = String(value)
    data.extra = extra
  } else {
    return Response.json({ error: 'That field is not editable' }, { status: 400 })
  }

  const updated = await prisma.school.update({
    where: { id },
    data,
    include: { status: true, assignedTo: { select: { id: true, name: true } } },
  })
  return Response.json({ ok: true, school: updated })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/schools/[id]'>) {
  const { user, error } = await apiUser()
  if (error) return error
  if (user.role !== 'ADMIN') {
    return Response.json({ error: 'Only admins can delete rows' }, { status: 403 })
  }
  const { id } = await ctx.params
  await prisma.school.delete({ where: { id } })
  return Response.json({ ok: true })
}
