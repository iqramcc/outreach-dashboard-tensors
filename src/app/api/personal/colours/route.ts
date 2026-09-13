import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const HEX = /^#[0-9a-fA-F]{6}$/

const Body = z.object({
  statusId: z.string().min(1),
  /** null clears the override and goes back to the team's colour. */
  hex: z.string().regex(HEX).nullable(),
})

/**
 * Recolour a shared status for yourself only.
 *
 * The team's colour key is admin-owned and unchanged by this - everyone else
 * keeps seeing the agreed colours. Two statuses can be given the same colour
 * here when, for one person's purposes, they amount to the same thing.
 */
export async function POST(request: Request) {
  const { user, error } = await apiUser()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Pick a colour' }, { status: 400 })
  const { statusId, hex } = parsed.data

  if (hex === null) {
    await prisma.userStatusColor.deleteMany({ where: { userId: user.id, statusId } })
    return Response.json({ ok: true, cleared: true })
  }

  const status = await prisma.outreachStatus.findUnique({ where: { id: statusId } })
  if (!status) return Response.json({ error: 'Unknown status' }, { status: 400 })

  const saved = await prisma.userStatusColor.upsert({
    where: { userId_statusId: { userId: user.id, statusId } },
    update: { hex },
    create: { userId: user.id, statusId, hex },
  })
  return Response.json({ ok: true, colour: saved })
}
