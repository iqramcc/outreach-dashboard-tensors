import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  schoolId: z.string().min(1),
  channel: z.enum(['CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'OTHER']).default('CALL'),
  outcome: z.string().nullish(),
  note: z.string().nullish(),
  nextFollowUpAt: z.string().nullish(),
  /** Optionally move the school to a new status in the same action. */
  statusId: z.string().nullish(),
})

export async function POST(request: Request) {
  const { user, error } = await apiUser()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })
  const b = parsed.data

  const school = await prisma.school.findUnique({
    where: { id: b.schoolId },
    select: { id: true, status: { select: { id: true, name: true } } },
  })
  if (!school) return Response.json({ error: 'Not found' }, { status: 404 })

  const nextStatus =
    b.statusId && b.statusId !== school.status?.id
      ? await prisma.outreachStatus.findUnique({ where: { id: b.statusId } })
      : null

  const followUp = b.nextFollowUpAt ? new Date(b.nextFollowUpAt) : null

  const log = await prisma.outreachLog.create({
    data: {
      schoolId: b.schoolId,
      userId: user.id,
      channel: b.channel,
      outcome: b.outcome || null,
      note: b.note || null,
      nextFollowUpAt: followUp,
      fromStatusName: school.status?.name ?? null,
      toStatusName: nextStatus?.name ?? school.status?.name ?? null,
    },
  })

  // Logging a call is itself evidence of contact, so the school's follow-up
  // date and last-contacted stamp move with it.
  await prisma.school.update({
    where: { id: b.schoolId },
    data: {
      lastContactedAt: new Date(),
      nextFollowUpAt: followUp,
      ...(nextStatus ? { statusId: nextStatus.id } : {}),
    },
  })

  return Response.json({ ok: true, log })
}
