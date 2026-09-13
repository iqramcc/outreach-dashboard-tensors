import { z } from 'zod'
import { prisma } from '@/lib/db'
import { setSessionCookie, signToken, verifyPassword } from '@/lib/auth'

const Body = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })

  // Same message either way - don't reveal which accounts exist.
  const invalid = Response.json({ error: 'Wrong email or password' }, { status: 401 })
  if (!user) return invalid
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid
  if (!user.isActive) {
    return Response.json({ error: 'This account has been deactivated' }, { status: 403 })
  }

  const session = { id: user.id, name: user.name, email: user.email, role: user.role }
  await setSessionCookie(signToken(session))
  return Response.json({ ok: true, user: session })
}
