import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ColumnsManager from './ColumnsManager'

export const dynamic = 'force-dynamic'

export default async function ColumnsPage() {
  // Members can manage columns too - adding and relabelling a field is
  // ordinary work. Only deleting one is held back, and that is enforced in the
  // API, not just by hiding the button.
  const user = await requireUser()

  const columns = await prisma.columnDef.findMany({
    where: { sheetId: null },
    orderBy: { order: 'asc' },
  })

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Columns</h1>
        {user.role === 'ADMIN' && (
          <nav className="ml-auto flex gap-1">
            <Link href="/admin/users" className="btn btn-ghost">Team</Link>
          </nav>
        )}
      </div>

      <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
        Add a column of your own, rename one, reorder it, or hide it from the grid.
        Built-in columns can be renamed and hidden but not deleted or retyped, because
        the dashboard&apos;s district and pipeline figures are calculated from them.
      </p>

      <ColumnsManager
        isAdmin={user.role === 'ADMIN'}
        columns={columns.map((c) => ({
          id: c.id,
          key: c.key,
          label: c.label,
          type: c.type,
          isCore: c.isCore,
          isVisible: c.isVisible,
          order: c.order,
          options: (c.options as string[] | null) ?? null,
        }))}
      />
    </main>
  )
}
