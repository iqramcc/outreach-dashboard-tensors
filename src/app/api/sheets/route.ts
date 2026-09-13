import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  name: z.string().min(1, 'Give the sheet a name'),
  description: z.string().nullish(),
})

/**
 * Members may create sheets. Starting a new list ("Kozhikode tuition centres")
 * is ordinary work and destroys nothing; only deleting one is restricted.
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
  const clash = await prisma.sheet.findFirst({ where: { name, isArchived: false } })
  if (clash) {
    return Response.json({ error: 'A sheet with that name already exists' }, { status: 409 })
  }

  const last = await prisma.sheet.findFirst({ orderBy: { order: 'desc' } })
  const sheet = await prisma.sheet.create({
    data: {
      name,
      description: parsed.data.description || null,
      order: (last?.order ?? 0) + 1,
      createdById: user.id,
    },
  })
  return Response.json({ ok: true, sheet })
}
