'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

export type MemberProgress = {
  id: string
  name: string
  assigned: number
  callPending: number
  followUpPending: number
  pendingTotal: number
  confirmed: number
  registeredSchools: number
  students: number
}

type Key = keyof Omit<MemberProgress, 'id' | 'name'>

const COLUMNS: { key: Key; label: string; hint: string }[] = [
  { key: 'assigned', label: 'Assigned', hint: 'Schools handed to this person' },
  { key: 'callPending', label: 'Call pending', hint: 'Not contacted yet' },
  { key: 'followUpPending', label: 'Follow-up pending', hint: 'Follow-up due or overdue' },
  { key: 'pendingTotal', label: 'Total pending', hint: 'Calls + follow-ups still to do' },
  { key: 'confirmed', label: 'Confirmed', hint: 'Statuses the team counts as a win' },
  { key: 'registeredSchools', label: 'Schools registered', hint: 'Schools with at least one student registered' },
  { key: 'students', label: 'Students registered', hint: 'Total students, not school strength' },
]

/** Defined outside the table so it is not rebuilt on every render. */
function Arrow({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown size={11} style={{ opacity: 0.35 }} />
  return dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
}

/** Each number links to the rows behind it, so a total can always be checked. */
function hrefFor(memberId: string, key: Key): string {
  const base = `/sheets/view?assigned=${memberId}`
  switch (key) {
    case 'followUpPending':
    case 'pendingTotal':
      return `${base}&due=1`
    default:
      return base
  }
}

export default function ProgressTable({ members }: { members: MemberProgress[] }) {
  const [sortKey, setSortKey] = useState<Key | 'name'>('assigned')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    const list = [...members]
    list.sort((a, b) => {
      if (sortKey === 'name') {
        return dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      }
      const d = a[sortKey] - b[sortKey]
      // Ties fall back to name, so the order never jitters between renders.
      return (dir === 'asc' ? d : -d) || a.name.localeCompare(b.name)
    })
    return list
  }, [members, sortKey, dir])

  function sortBy(key: Key | 'name') {
    if (sortKey === key) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Counts are most useful highest-first; names read better A-Z.
      setDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const totals = members.reduce(
    (t, m) => ({
      assigned: t.assigned + m.assigned,
      callPending: t.callPending + m.callPending,
      followUpPending: t.followUpPending + m.followUpPending,
      pendingTotal: t.pendingTotal + m.pendingTotal,
      confirmed: t.confirmed + m.confirmed,
      registeredSchools: t.registeredSchools + m.registeredSchools,
      students: t.students + m.students,
    }),
    {
      assigned: 0,
      callPending: 0,
      followUpPending: 0,
      pendingTotal: 0,
      confirmed: 0,
      registeredSchools: 0,
      students: 0,
    }
  )

  const n = (x: number) => x.toLocaleString('en-IN')

  return (
    <div className="card thin-scroll overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0" style={{ background: 'var(--surface-2)' }}>
          <tr>
            <th className="px-3 py-2 text-left">
              <button
                type="button"
                onClick={() => sortBy('name')}
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--muted)' }}
              >
                Member <Arrow active={sortKey === 'name'} dir={dir} />
              </button>
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-2 text-right" title={c.hint}>
                <button
                  type="button"
                  onClick={() => sortBy(c.key)}
                  className="ml-auto flex items-center gap-1 text-xs font-medium"
                  style={{
                    color: sortKey === c.key ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {c.label} <Arrow active={sortKey === c.key} dir={dir} />
                </button>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((m) => (
            <tr key={m.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
              <td className="px-3 py-1.5 font-medium">
                <Link href={`/sheets/view?assigned=${m.id}`} className="hover:underline">
                  {m.name}
                </Link>
              </td>
              {COLUMNS.map((c) => {
                const value = m[c.key]
                return (
                  <td key={c.key} className="px-3 py-1.5 text-right tabular-nums">
                    {value === 0 ? (
                      <span style={{ color: 'var(--muted)' }}>0</span>
                    ) : (
                      <Link href={hrefFor(m.id, c.key)} className="hover:underline">
                        {n(value)}
                      </Link>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}

          {members.length === 0 && (
            <tr>
              <td
                colSpan={COLUMNS.length + 1}
                className="px-3 py-6 text-center"
                style={{ color: 'var(--muted)' }}
              >
                No active members yet.
              </td>
            </tr>
          )}
        </tbody>

        {members.length > 0 && (
          <tfoot>
            <tr className="border-t font-medium" style={{ background: 'var(--surface-2)' }}>
              <td className="px-3 py-2">Everyone</td>
              {COLUMNS.map((c) => (
                <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                  {n(totals[c.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
