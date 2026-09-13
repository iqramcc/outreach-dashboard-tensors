import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import UsersAdmin from './UsersAdmin'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const me = await requireAdmin()

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      _count: { select: { assignedSchools: true, outreachLogs: true } },
    },
  })

  return (
    <UsersAdmin
      meId={me.id}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        assigned: u._count.assignedSchools,
        logs: u._count.outreachLogs,
      }))}
    />
  )
}
