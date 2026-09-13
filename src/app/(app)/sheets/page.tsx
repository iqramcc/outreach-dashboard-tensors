import Link from 'next/link'
import { Table2 } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Sheets</h1>
        {user.role === 'ADMIN' && (
          <Link href="/import" className="btn btn-primary">
            Import Excel
          </Link>
        )}
      </div>

      {sheets.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No sheets yet.
            {user.role === 'ADMIN'
              ? ' Import an Excel file to create one.'
              : ' Ask an admin to import your school list.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((s) => (
            <Link key={s.id} href={`/sheets/${s.id}`} className="card p-4 transition-colors hover:border-[var(--accent)]">
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <Table2 size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {s._count.schools.toLocaleString('en-IN')} schools
                  </p>
                  {s.description && (
                    <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--muted)' }}>
                      {s.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
