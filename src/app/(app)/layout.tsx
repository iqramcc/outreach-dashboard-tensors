import NavBar from '@/components/NavBar'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()
  const sheets = await prisma.sheet.findMany({
    where: { isArchived: false },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })

  return (
    <div className="min-h-screen">
      <NavBar user={user} sheets={sheets} />
      {children}
    </div>
  )
}
