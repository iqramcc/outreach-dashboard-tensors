'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Download, RotateCcw, Send, Trash2 } from 'lucide-react'

export type EntryRow = {
  id: string
  schoolId: string
  schoolName: string
  status: string
  sentAt: string | null
  addedBy: string | null
  values: Record<string, string>
  missing: string[]
}

type Field = { key: string; label: string; required: boolean }

export default function CampaignEntries({
  listId,
  listName,
  rows,
  show,
  counts,
  fields,
}: {
  listId: string
  listName: string
  rows: EntryRow[]
  show: string
  counts: { all: number; NEW: number; SENT: number }
  fields: Field[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id))

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function setSent(sent: boolean) {
    if (picked.size === 0) return
    setBusy(true)
    await fetch(`/api/campaigns/${listId}/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'ids', entryIds: [...picked], sent }),
    })
    setBusy(false)
    setPicked(new Set())
    router.refresh()
  }

  async function removePicked() {
    if (picked.size === 0) return
    if (!confirm(`Take ${picked.size} school(s) off "${listName}"?`)) return
    const schoolIds = rows.filter((r) => picked.has(r.id)).map((r) => r.schoolId)
    setBusy(true)
    await fetch(`/api/campaigns/${listId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolIds, on: false }),
    })
    setBusy(false)
    setPicked(new Set())
    router.refresh()
  }

  const TABS: { key: string; label: string; n: number }[] = [
    { key: 'ALL', label: 'All', n: counts.all },
    { key: 'NEW', label: 'Not sent yet', n: counts.NEW },
    { key: 'SENT', label: 'Already sent', n: counts.SENT },
  ]

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/campaigns/${listId}?show=${t.key}`}
            className="btn btn-ghost"
            style={show === t.key ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : {}}
          >
            {t.label} ({t.n.toLocaleString('en-IN')})
          </Link>
        ))}

        <div className="ml-auto flex gap-1.5">
          <a
            className="btn btn-ghost py-1 text-xs"
            href={`/api/campaigns/${listId}/export?status=${show === 'ALL' ? 'ALL' : show}`}
          >
            <Download size={13} /> Export this view
          </a>
          <a
            className="btn btn-ghost py-1 text-xs"
            href={`/api/campaigns/${listId}/export?status=NEW&ready=1`}
          >
            <Download size={13} /> Not sent, ready only
          </a>
        </div>
      </div>

      {picked.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
          style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}
        >
          <span className="text-sm font-medium">{picked.size} selected</span>
          <button className="btn btn-ghost py-1 text-xs" onClick={() => setSent(true)} disabled={busy} type="button">
            <Send size={13} /> Mark as sent
          </button>
          <button className="btn btn-ghost py-1 text-xs" onClick={() => setSent(false)} disabled={busy} type="button">
            <RotateCcw size={13} /> Put back to not sent
          </button>
          <button className="btn btn-ghost py-1 text-xs" onClick={removePicked} disabled={busy} type="button">
            <Trash2 size={13} style={{ color: 'var(--danger)' }} /> Remove from list
          </button>
          <button className="btn btn-ghost py-1 text-xs" onClick={() => setPicked(new Set())} type="button">
            Clear
          </button>
        </div>
      )}

      <div className="card thin-scroll overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
            <tr>
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={() =>
                    setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)))
                  }
                  aria-label="Select every row shown"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">Status</th>
              {fields.map((f) => (
                <th key={f.key} className="px-3 py-2 text-left text-xs font-medium">
                  {f.label}
                  {f.required && <span style={{ color: 'var(--danger)' }}> *</span>}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-medium">Added by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Select ${r.schoolName}`}
                  />
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={
                      r.status === 'SENT'
                        ? { background: 'var(--surface-2)', color: 'var(--muted)' }
                        : { background: 'var(--accent)', color: 'var(--accent-text)' }
                    }
                  >
                    {r.status === 'SENT' ? 'Sent' : 'Not sent'}
                  </span>
                  {r.missing.length > 0 && (
                    <span
                      className="ml-1.5 inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--danger)' }}
                      title={`Missing: ${r.missing.join(', ')}`}
                    >
                      <AlertTriangle size={11} />
                      {r.missing.join(', ')}
                    </span>
                  )}
                </td>
                {fields.map((f) => (
                  <td key={f.key} className="px-3 py-1.5">
                    {f.key === 'name' ? (
                      <Link href={`/schools/${r.schoolId}`} className="hover:underline">
                        {r.values[f.key] || r.schoolName}
                      </Link>
                    ) : (
                      r.values[f.key] || <span style={{ color: 'var(--muted)' }}>&mdash;</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                  {r.addedBy ?? '—'}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={fields.length + 3}
                  className="px-3 py-8 text-center"
                  style={{ color: 'var(--muted)' }}
                >
                  Nothing here yet. Members add schools from a sheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
