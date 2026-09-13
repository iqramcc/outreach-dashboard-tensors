import { Fragment } from 'react'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { REGION_LABELS } from '@/lib/regions'
import type { RegionCategory } from '@prisma/client'

export const dynamic = 'force-dynamic'

function Tile({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="card p-3.5">
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default async function DashboardPage() {
  await requireUser()

  const [total, statuses, byRegion, byDistrict, dueRows, recent, studentAgg] =
    await Promise.all([
      prisma.school.count(),
      prisma.outreachStatus.findMany({ orderBy: { order: 'asc' } }),
      prisma.school.groupBy({ by: ['regionCategory'], _count: true }),
      prisma.school.groupBy({
        by: ['regionCategory', 'district', 'statusId'],
        _count: true,
      }),
      prisma.school.findMany({
        where: { nextFollowUpAt: { lte: new Date() } },
        orderBy: { nextFollowUpAt: 'asc' },
        take: 8,
        select: {
          id: true,
          name: true,
          district: true,
          nextFollowUpAt: true,
          contact: true,
        },
      }),
      prisma.outreachLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          channel: true,
          note: true,
          createdAt: true,
          toStatusName: true,
          school: { select: { id: true, name: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.school.aggregate({ _sum: { registeredStudents: true } }),
    ])

  const contactedIds = new Set(statuses.filter((s) => s.isContacted).map((s) => s.id))
  const positiveIds = new Set(statuses.filter((s) => s.isPositive).map((s) => s.id))

  // Roll the grouped counts up per district and per status, in one pass.
  const districtRows = new Map<
    string,
    { region: RegionCategory; district: string; total: number; contacted: number; positive: number }
  >()
  const statusTotals = new Map<string, number>()
  let contactedTotal = 0
  let positiveTotal = 0

  for (const row of byDistrict) {
    const district = row.district ?? 'Unspecified'
    const key = `${row.regionCategory}|${district}`
    const entry =
      districtRows.get(key) ??
      { region: row.regionCategory, district, total: 0, contacted: 0, positive: 0 }

    entry.total += row._count
    if (row.statusId && contactedIds.has(row.statusId)) {
      entry.contacted += row._count
      contactedTotal += row._count
    }
    if (row.statusId && positiveIds.has(row.statusId)) {
      entry.positive += row._count
      positiveTotal += row._count
    }
    districtRows.set(key, entry)

    const sKey = row.statusId ?? '__none__'
    statusTotals.set(sKey, (statusTotals.get(sKey) ?? 0) + row._count)
  }

  const regionOrder: RegionCategory[] = [
    'KERALA',
    'TAMIL_NADU',
    'MIDDLE_EAST',
    'OTHER_STATE',
  ]
  const regionCounts = new Map(byRegion.map((r) => [r.regionCategory, r._count]))
  const maxDistrict = Math.max(1, ...[...districtRows.values()].map((d) => d.total))
  const notContacted = total - contactedTotal

  return (
    <main className="mx-auto w-full max-w-7xl p-3 sm:p-5">
      <h1 className="mb-4 text-lg font-semibold">Outreach Overview</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Schools" value={total.toLocaleString('en-IN')} />
        <Tile
          label="Contacted"
          value={contactedTotal.toLocaleString('en-IN')}
          sub={total ? `${Math.round((contactedTotal / total) * 100)}% of all schools` : undefined}
        />
        <Tile label="Not contacted" value={notContacted.toLocaleString('en-IN')} />
        <Tile label="Confirmed / registered" value={positiveTotal.toLocaleString('en-IN')} />
        <Tile
          label="Students registered"
          value={(studentAgg._sum.registeredStudents ?? 0).toLocaleString('en-IN')}
        />
      </section>

      {/* Funnel. Plain flex bars rather than a charting library - it is one
          stacked bar, and this keeps the dependency list short. */}
      <section className="card mt-5 p-4">
        <h2 className="mb-3 text-sm font-semibold">Pipeline</h2>
        {total === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No schools yet. Import an Excel file to get started.
          </p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
              {statuses.map((s) => {
                const n = statusTotals.get(s.id) ?? 0
                if (!n) return null
                return (
                  <div
                    key={s.id}
                    style={{ width: `${(n / total) * 100}%`, background: s.hex }}
                    title={`${s.name}: ${n}`}
                  />
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {[
                ...statuses.map((s) => ({
                  id: s.id,
                  name: s.name,
                  hex: s.hex,
                  n: statusTotals.get(s.id) ?? 0,
                })),
                {
                  id: '__none__',
                  name: 'No status set',
                  hex: 'var(--border)',
                  n: statusTotals.get('__none__') ?? 0,
                },
              ]
                .filter((s) => s.n > 0)
                .map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: s.hex }}
                    />
                    {s.name}
                    <span className="tabular-nums" style={{ color: 'var(--muted)' }}>
                      {s.n.toLocaleString('en-IN')}
                    </span>
                  </span>
                ))}
            </div>
          </>
        )}
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <h2 className="border-b px-4 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>
            By district
          </h2>
          <div className="thin-scroll max-h-[26rem] overflow-auto">
            <table className="w-full text-sm">
              <thead
                className="sticky top-0 text-left text-xs"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
              >
                <tr>
                  <th className="px-4 py-2 font-medium">District</th>
                  <th className="px-2 py-2 text-right font-medium">Schools</th>
                  <th className="px-2 py-2 text-right font-medium">Contacted</th>
                  <th className="px-4 py-2 text-right font-medium">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {regionOrder.map((region) => {
                  const rows = [...districtRows.values()]
                    .filter((d) => d.region === region)
                    .sort((a, b) => b.total - a.total)
                  if (rows.length === 0) return null
                  return (
                    <Fragment key={region}>
                      <tr>
                        <th
                          colSpan={4}
                          className="px-4 py-1.5 text-left text-xs font-semibold"
                          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                        >
                          {REGION_LABELS[region]}
                          <span className="ml-2 font-normal">
                            {(regionCounts.get(region) ?? 0).toLocaleString('en-IN')} schools
                          </span>
                        </th>
                      </tr>
                      {rows.map((d) => (
                        <tr
                          key={`${region}-${d.district}`}
                          className="border-t"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <td className="px-4 py-1.5">
                            <Link
                              href={`/sheets?district=${encodeURIComponent(d.district)}`}
                              className="hover:underline"
                            >
                              {d.district}
                            </Link>
                            <span
                              className="ml-2 inline-block h-1 rounded-full align-middle"
                              style={{
                                width: `${Math.max(4, (d.total / maxDistrict) * 90)}px`,
                                background: 'var(--accent)',
                                opacity: 0.35,
                              }}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{d.total}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {d.contacted}
                            <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>
                              {d.total ? `${Math.round((d.contacted / d.total) * 100)}%` : ''}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums">{d.positive}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
                {districtRows.size === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center" style={{ color: 'var(--muted)' }}>
                      No data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="card overflow-hidden">
            <h2 className="border-b px-4 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>
              Follow-ups due
            </h2>
            {dueRows.length === 0 ? (
              <p className="px-4 py-5 text-sm" style={{ color: 'var(--muted)' }}>
                Nothing due. Set a follow-up date when you log a call.
              </p>
            ) : (
              <ul>
                {dueRows.map((s) => (
                  <li key={s.id} className="border-t px-4 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
                    <Link href={`/schools/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {s.district ?? '-'} &middot; due{' '}
                      {s.nextFollowUpAt?.toLocaleDateString('en-IN')}
                      {s.contact ? ` · ${s.contact}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b px-4 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>
              Recent activity
            </h2>
            {recent.length === 0 ? (
              <p className="px-4 py-5 text-sm" style={{ color: 'var(--muted)' }}>
                No calls logged yet.
              </p>
            ) : (
              <ul>
                {recent.map((l) => (
                  <li key={l.id} className="border-t px-4 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
                    <Link href={`/schools/${l.school.id}`} className="font-medium hover:underline">
                      {l.school.name}
                    </Link>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {l.user?.name ?? 'Someone'} &middot; {l.channel.toLowerCase()}
                      {l.toStatusName ? ` → ${l.toStatusName}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
