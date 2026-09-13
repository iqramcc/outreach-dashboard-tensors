import { z } from 'zod'
import { apiAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const Single = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, 'Use at least 6 characters'),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
})

/**
 * Bulk add. The team is one admin plus ~35 members, so adding them one form at
 * a time would be miserable - paste a list instead, one per line:
 *   Name, email@example.com
 * or just an email. A password is generated for anyone who has none, and
 * returned once so the admin can pass it on.
 */
const Bulk = z.object({
  bulk: z.string().min(1),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
})

function randomPassword(): string {
  // Readable, no ambiguous characters - these get typed by hand off a message.
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export async function GET() {
  const { error } = await apiAdmin()
  if (error) return error

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { assignedSchools: true, outreachLogs: true } },
    },
  })
  return Response.json({ users })
}

export async function POST(request: Request) {
  const { error } = await apiAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)

  // --- bulk paste ---------------------------------------------------------
  const bulk = Bulk.safeParse(body)
  if (bulk.success) {
    const lines = bulk.data.bulk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const created: { name: string; email: string; password: string }[] = []
    const skipped: { line: string; reason: string }[] = []

    for (const line of lines) {
      const parts = line.split(/[,\t;]/).map((p) => p.trim()).filter(Boolean)
      const email = parts.find((p) => p.includes('@'))?.toLowerCase()
      if (!email) {
        skipped.push({ line, reason: 'no email address' })
        continue
      }
      const name = parts.find((p) => !p.includes('@')) ?? email.split('@')[0]

      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) {
        skipped.push({ line, reason: 'already exists' })
        continue
      }

      const password = randomPassword()
      await prisma.user.create({
        data: {
          name,
          email,
          role: bulk.data.role,
          passwordHash: await hashPassword(password),
        },
      })
      created.push({ name, email, password })
    }

    return Response.json({ ok: true, created, skipped })
  }

  // --- single user --------------------------------------------------------
  const single = Single.safeParse(body)
  if (!single.success) {
    return Response.json(
      { error: single.error.issues[0]?.message ?? 'Bad request' },
      { status: 400 }
    )
  }

  const email = single.data.email.toLowerCase()
  if (await prisma.user.findUnique({ where: { email } })) {
    return Response.json({ error: 'That email is already registered' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      name: single.data.name,
      email,
      role: single.data.role,
      passwordHash: await hashPassword(single.data.password),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  return Response.json({ ok: true, user })
}
