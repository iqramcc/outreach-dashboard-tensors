import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ColumnsAdmin from './ColumnsAdmin'

export const dynamic = 'force-dynamic'

export default async function ColumnsPage() {
  await requireAdmin()

  const columns = await prisma.columnDef.findMany({
    where: { sheetId: null },
    orderBy: { order: 'asc' },
  })

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Columns</h1>
        <nav className="ml-auto flex gap-1">
          <Link href="/admin/users" className="btn btn-ghost">Users</Link>
          <Link
            href="/admin/columns"
            className="btn btn-ghost"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            Columns
          </Link>
        </nav>
      </div>

      <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
        Rename any column, reorder it, or add your own. Built-in columns can be hidden but not
        deleted, because the dashboard&apos;s district and pipeline figures are calculated from them.
      </p>

      <ColumnsAdmin
        columns={columns.map((c) => ({
          id: c.id,
          key: c.key,
          label: c.label,
          type: c.type,
          isCore: c.isCore,
          isVisible: c.isVisible,
          order: c.order,
        }))}
      />
    </main>
  )
}
