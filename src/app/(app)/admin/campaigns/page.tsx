import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveColumns } from '@/lib/columns'
import { missingFields } from '@/lib/campaign'
import CampaignsAdmin, { type CampaignRow } from './CampaignsAdmin'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  await requireAdmin()

  const [lists, defs] = await Promise.all([
    prisma.campaignList.findMany({
      where: { isArchived: false },
      orderBy: { order: 'asc' },
      include: {
        entries: {
          include: { school: true },
        },
      },
    }),
    prisma.columnDef.findMany({ where: { sheetId: null }, orderBy: { order: 'asc' } }),
  ])

  const columns = resolveColumns(defs).map((c) => ({ key: c.key, label: c.label }))

  // Counting "ready" here rather than in SQL because readiness depends on the
  // override-then-school fallback, which is a rule the app owns, not the
  // database. These lists are hundreds of rows, not the whole school table.
  const rows: CampaignRow[] = lists.map((l) => {
    const required = (l.requiredFields as string[]) ?? []
    let newCount = 0
    let sentCount = 0
    let notReady = 0

    for (const e of l.entries) {
      if (e.status === 'SENT') sentCount++
      else newCount++
      if (missingFields(e.school, (e.data ?? {}) as Record<string, string>, required).length > 0) {
        notReady++
      }
    }

    return {
      id: l.id,
      name: l.name,
      description: l.description,
      requiredFields: required,
      optionalFields: (l.optionalFields as string[]) ?? [],
      total: l.entries.length,
      newCount,
      sentCount,
      notReady,
    }
  })

  return (
    <main className="mx-auto w-full max-w-5xl p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Mail &amp; message lists</h1>
        <nav className="ml-auto flex gap-1">
          <Link href="/admin/progress" className="btn btn-ghost">Progress</Link>
          <Link href="/admin/users" className="btn btn-ghost">Team</Link>
        </nav>
      </div>

      <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
        Members add schools to these as they work. Export the new ones, send them, then
        mark them as sent &mdash; the next export will only contain schools that have
        not had that message yet.
      </p>

      <CampaignsAdmin lists={rows} columns={columns} />
    </main>
  )
}
