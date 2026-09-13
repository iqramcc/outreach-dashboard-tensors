'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Download, Eye, Plus, Send, Settings2, Trash2 } from 'lucide-react'
import Link from 'next/link'

export type CampaignRow = {
  id: string
  name: string
  description: string | null
  requiredFields: string[]
  optionalFields: string[]
  total: number
  newCount: number
  sentCount: number
  notReady: number
}

type Column = { key: string; label: string }

export default function CampaignsAdmin({
  lists,
  columns,
}: {
  lists: CampaignRow[]
  columns: Column[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const label = (k: string) => columns.find((c) => c.key === k)?.label ?? k

  async function save(id: string, body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not save that list')
      return
    }
    router.refresh()
  }

  async function create() {
    if (!newName.trim()) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        // Sensible floor: a list is no use without knowing who it is about.
        requiredFields: ['name'],
        optionalFields: ['district'],
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not create that list')
      return
    }
    setNewName('')
    setAdding(false)
    router.refresh()
  }

  async function markSent(l: CampaignRow) {
    if (
      !confirm(
        `Mark all ${l.newCount} new school(s) on "${l.name}" as sent?\n\nThey will be left out of the next "new" export.`
      )
    ) {
      return
    }
    setBusy(true)
    const res = await fetch(`/api/campaigns/${l.id}/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'allNew', sent: true }),
    })
    setBusy(false)
    if (!res.ok) {
      setError('Could not mark those as sent')
      return
    }
    router.refresh()
  }

  async function remove(l: CampaignRow) {
    if (!confirm(`Remove the "${l.name}" list? Its ${l.total} entries go with it.`)) return
    setBusy(true)
    const res = await fetch(`/api/campaigns/${l.id}?expectedEntries=${l.total}`, {
      method: 'DELETE',
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not remove that list')
      return
    }
    router.refresh()
  }

  /**
   * Every column is in exactly one of three states for a list, chosen outright
   * rather than cycled through: off it, compulsory, or there but up to the
   * member. Keeping the two lists disjoint is this function's job.
   */
  function setFieldMode(l: CampaignRow, key: string, mode: 'off' | 'required' | 'optional') {
    const required = l.requiredFields.filter((k) => k !== key)
    const optional = l.optionalFields.filter((k) => k !== key)
    if (mode === 'required') required.push(key)
    if (mode === 'optional') optional.push(key)
    save(l.id, { requiredFields: required, optionalFields: optional })
  }

  function modeOf(l: CampaignRow, key: string): 'off' | 'required' | 'optional' {
    if (l.requiredFields.includes(key)) return 'required'
    if (l.optionalFields.includes(key)) return 'optional'
    return 'off'
  }

  return (
    <>
      {error && (
        <p className="mb-2 text-sm" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {lists.map((l) => (
          <div key={l.id} className="card p-4">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <input
                  className="input py-1 font-medium"
                  defaultValue={l.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== l.name) {
                      save(l.id, { name: e.target.value })
                    }
                  }}
                  aria-label={`Name of ${l.name}`}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                  {l.total.toLocaleString('en-IN')} school(s) &middot;{' '}
                  <strong style={{ color: 'var(--accent)' }}>{l.newCount} new</strong> &middot;{' '}
                  {l.sentCount} already sent
                  {l.notReady > 0 && (
                    <span style={{ color: 'var(--danger)' }}>
                      {' '}&middot; {l.notReady} missing something
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Link className="btn btn-ghost py-1 text-xs" href={`/admin/campaigns/${l.id}`}>
                  <Eye size={13} /> View
                </Link>
                <a
                  className="btn btn-ghost py-1 text-xs"
                  href={`/api/campaigns/${l.id}/export?status=NEW`}
                >
                  <Download size={13} /> New ({l.newCount})
                </a>
                <a
                  className="btn btn-ghost py-1 text-xs"
                  href={`/api/campaigns/${l.id}/export?status=SENT`}
                >
                  <Download size={13} /> Sent ({l.sentCount})
                </a>
                <button
                  className="btn btn-ghost py-1 text-xs"
                  onClick={() => markSent(l)}
                  disabled={busy || l.newCount === 0}
                  type="button"
                >
                  <Send size={13} /> Mark new as sent
                </button>
                <button
                  className="btn btn-ghost py-1 text-xs"
                  onClick={() => setEditing(editing === l.id ? null : l.id)}
                  type="button"
                >
                  <Settings2 size={13} /> Fields
                </button>
                <button
                  className="btn btn-ghost py-1 text-xs"
                  onClick={() => remove(l)}
                  disabled={busy}
                  type="button"
                  aria-label={`Remove ${l.name}`}
                >
                  <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
              Compulsory: {l.requiredFields.map(label).join(', ') || 'nothing'}
              {l.optionalFields.length > 0 && (
                <> &middot; Member&apos;s choice: {l.optionalFields.map(label).join(', ')}</>
              )}
            </p>

            {l.notReady > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: 'var(--danger)' }}>
                <AlertTriangle size={12} />
                {l.notReady} school(s) are missing a required field. The export names which
                one, and you can leave them out with the ready-only export.
              </p>
            )}

            {editing === l.id && (
              <div className="mt-3 border-t pt-3">
                <p className="label">What this list needs from each school</p>
                <div className="thin-scroll max-h-72 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead
                      className="sticky top-0"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                    >
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Column</th>
                        <th className="px-2 py-1.5 text-left font-medium">In this list</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((c) => {
                        const mode = modeOf(l, c.key)
                        return (
                          <tr
                            key={c.key}
                            className="border-t"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="px-2 py-1">{c.label}</td>
                            <td className="px-2 py-1">
                              <select
                                className="input py-0.5 text-xs"
                                value={mode}
                                disabled={busy}
                                onChange={(e) =>
                                  setFieldMode(
                                    l,
                                    c.key,
                                    e.target.value as 'off' | 'required' | 'optional'
                                  )
                                }
                                aria-label={`How ${c.label} is used in ${l.name}`}
                              >
                                <option value="off">Not used</option>
                                <option value="required">Compulsory</option>
                                <option value="optional">Up to the member</option>
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <strong>Compulsory</strong> &mdash; a school without it is flagged as not
                  ready, and the ready-only export leaves it out.{' '}
                  <strong>Up to the member</strong> &mdash; exported when it is there, never
                  blocks anything.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="card mt-3 flex flex-wrap items-end gap-2 p-3">
          <div>
            <label className="label" htmlFor="nl-name">List name</label>
            <input
              id="nl-name"
              className="input w-64"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="e.g. Principals WhatsApp group"
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={create} disabled={busy} type="button">
            Create
          </button>
          <button className="btn btn-ghost" onClick={() => setAdding(false)} type="button">
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost mt-3" onClick={() => setAdding(true)} type="button">
          <Plus size={15} /> New list
        </button>
      )}
    </>
  )
}
