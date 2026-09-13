import { z } from 'zod'
import { apiAdmin, apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  name: z.string().min(1, 'Give the list a name'),
  description: z.string().nullish(),
  requiredFields: z.array(z.string()).default([]),
  optionalFields: z.array(z.string()).default([]),
})

/**
 * Everyone can see the lists - members need them to add schools. Only admins
 * create or reshape them, since what a list requires decides what the export
 * is allowed to contain.
 */
export async function GET() {
  const { error } = await apiUser()
  if (error) return error

  const lists = await prisma.campaignList.findMany({
    where: { isArchived: false },
    orderBy: { order: 'asc' },
    include: { _count: { select: { entries: true } } },
  })
  return Response.json({ lists })
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

  const name = parsed.data.name.trim()
  if (await prisma.campaignList.findUnique({ where: { name } })) {
    return Response.json({ error: 'A list with that name already exists' }, { status: 409 })
  }

  const last = await prisma.campaignList.findFirst({ orderBy: { order: 'desc' } })
  const list = await prisma.campaignList.create({
    data: {
      name,
      description: parsed.data.description || null,
      requiredFields: parsed.data.requiredFields,
      optionalFields: parsed.data.optionalFields,
      order: (last?.order ?? -1) + 1,
    },
  })
  return Response.json({ ok: true, list })
}
