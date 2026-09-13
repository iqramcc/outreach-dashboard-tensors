import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import SheetsList from './SheetsList'

export const dynamic = 'force-dynamic'

export default async function SheetsPage() {
  const user = await requireUser()

  const sheets = await prisma.sheet.findMany({
    where: { isArchived: false },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { schools: true } } },
  })

  return (
    <main className="mx-auto w-full max-w-7xl p-3 sm:p-5">
      <SheetsList
        canImport={user.role === 'ADMIN'}
        sheets={sheets.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          count: s._count.schools,
        }))}
      />
    </main>
  )
}
