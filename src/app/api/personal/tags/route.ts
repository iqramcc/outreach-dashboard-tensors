import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const HEX = /^#[0-9a-fA-F]{6}$/

const Body = z.object({
  name: z.string().min(1, 'Give the mark a meaning'),
  hex: z.string().regex(HEX, 'Pick a colour'),
})

export async function GET() {
  const { user, error } = await apiUser()
  if (error) return error
  const tags = await prisma.personalTag.findMany({
    where: { userId: user.id },
    orderBy: { order: 'asc' },
  })
  return Response.json({ tags })
}

/**
 * A private mark for a case the shared statuses do not cover. Only its owner
 * ever sees it, so it cannot muddle the team's pipeline figures.
 */
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

  const name = parsed.data.name.trim()
  const clash = await prisma.personalTag.findFirst({ where: { userId: user.id, name } })
  if (clash) return Response.json({ error: 'You already have that mark' }, { status: 409 })

  const last = await prisma.personalTag.findFirst({
    where: { userId: user.id },
    orderBy: { order: 'desc' },
  })
  const tag = await prisma.personalTag.create({
    data: { userId: user.id, name, hex: parsed.data.hex, order: (last?.order ?? -1) + 1 },
  })
  return Response.json({ ok: true, tag })
}
