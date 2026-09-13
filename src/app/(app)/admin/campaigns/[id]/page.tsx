import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveColumns } from '@/lib/columns'
import { fieldValue, missingFields } from '@/lib/campaign'
import CampaignEntries, { type EntryRow } from './CampaignEntries'

export const dynamic = 'force-dynamic'

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

/**
 * What is actually on a list, so it can be checked before anything is sent -
 * rather than the admin having to open an export to find out.
 */
export default async function CampaignViewPage(props: PageProps<'/admin/campaigns/[id]'>) {
  await requireAdmin()
  const { id } = await props.params
  const sp = await props.searchParams
  const show = one(sp.show) || 'ALL' // ALL | NEW | SENT

  const [list, defs] = await Promise.all([
    prisma.campaignList.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: { createdAt: 'desc' },
          include: {
            school: true,
            addedBy: { select: { name: true } },
          },
        },
      },
    }),
    prisma.columnDef.findMany({ where: { sheetId: null }, orderBy: { order: 'asc' } }),
  ])

  if (!list) notFound()

  const required = (list.requiredFields as string[]) ?? []
  const optional = (list.optionalFields as string[]) ?? []
  const fields = [...required, ...optional.filter((f) => !required.includes(f))]
  const labels = new Map(resolveColumns(defs).map((c) => [c.key, c.label]))

  const all: EntryRow[] = list.entries.map((e) => {
    const overrides = (e.data ?? {}) as Record<string, string>
    const values: Record<string, string> = {}
    for (const f of fields) values[f] = fieldValue(e.school, overrides, f)
    return {
      id: e.id,
      schoolId: e.school.id,
      schoolName: e.school.name,
      status: e.status,
      sentAt: e.sentAt ? e.sentAt.toISOString() : null,
      addedBy: e.addedBy?.name ?? null,
      values,
      missing: missingFields(e.school, overrides, required).map((f) => labels.get(f) ?? f),
    }
  })

  const rows = show === 'ALL' ? all : all.filter((e) => e.status === show)
  const newCount = all.filter((e) => e.status === 'NEW').length
  const sentCount = all.length - newCount

  return (
    <main className="mx-auto w-full max-w-6xl p-3 sm:p-5">
      <Link
        href="/admin/campaigns"
        className="mb-3 inline-flex items-center gap-1 text-xs hover:underline"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={13} /> All lists
      </Link>

      <h1 className="text-lg font-semibold">{list.name}</h1>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        {all.length.toLocaleString('en-IN')} school(s) &middot; {newCount} not sent yet &middot;{' '}
        {sentCount} already sent
      </p>

      <CampaignEntries
        listId={list.id}
        listName={list.name}
        rows={rows}
        show={show}
        counts={{ all: all.length, NEW: newCount, SENT: sentCount }}
        fields={fields.map((f) => ({ key: f, label: labels.get(f) ?? f, required: required.includes(f) }))}
      />
    </main>
  )
}
