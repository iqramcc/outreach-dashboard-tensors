import { z } from 'zod'
import { apiAdmin, apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const HEX = /^#[0-9a-fA-F]{6}$/

const Body = z.object({
  name: z.string().min(1, 'Give the colour a meaning'),
  hex: z.string().regex(HEX, 'Pick a colour'),
  isContacted: z.boolean().default(false),
  isPositive: z.boolean().default(false),
})

export async function GET() {
  const { error } = await apiUser()
  if (error) return error
  const statuses = await prisma.outreachStatus.findMany({ orderBy: { order: 'asc' } })
  return Response.json({ statuses })
}

export async function POST(request: Request) {
  const { error } = await apiAdmin()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad request' },
      { status: 400 }
    )
  }

  const existing = await prisma.outreachStatus.findUnique({
    where: { name: parsed.data.name },
  })
  if (existing) {
    return Response.json({ error: 'That label already exists' }, { status: 409 })
  }

  const last = await prisma.outreachStatus.findFirst({ orderBy: { order: 'desc' } })
  const status = await prisma.outreachStatus.create({
    data: { ...parsed.data, order: (last?.order ?? -1) + 1 },
  })
  return Response.json({ ok: true, status })
}
