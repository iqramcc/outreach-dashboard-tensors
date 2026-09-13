import { z } from 'zod'
import { apiAdmin, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
})

export async function PATCH(request: Request, ctx: RouteContext<'/api/users/[id]'>) {
  const { user, error } = await apiAdmin()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  // Don't let the last admin lock everyone out of admin.
  if ((parsed.data.role === 'MEMBER' || parsed.data.isActive === false) && id === user.id) {
    return Response.json(
      { error: 'You cannot remove your own admin access' },
      { status: 400 }
    )
  }
  if (parsed.data.role === 'MEMBER' || parsed.data.isActive === false) {
    const admins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } })
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (admins <= 1 && target?.role === 'ADMIN') {
      return Response.json({ error: 'There must be at least one active admin' }, { status: 400 })
    }
  }

  const { password, ...rest } = parsed.data
  const updated = await prisma.user.update({
    where: { id },
    data: { ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  return Response.json({ ok: true, user: updated })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/users/[id]'>) {
  const { user, error } = await apiAdmin()
  if (error) return error
  const { id } = await ctx.params

  if (id === user.id) {
    return Response.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  // Deactivate rather than delete, so their call history stays attributed.
  await prisma.user.update({ where: { id }, data: { isActive: false } })
  return Response.json({ ok: true })
}
