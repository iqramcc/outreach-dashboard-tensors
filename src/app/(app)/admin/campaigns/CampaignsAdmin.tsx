'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Download, Plus, Send, Settings2, Trash2 } from 'lucide-react'

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

  /** Toggle a column in or out of a list's required / optional set. */
  function toggleField(l: CampaignRow, key: string, which: 'requiredFields' | 'optionalFields') {
    const current = l[which]
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key]
    // A field is one or the other, never both.
    const other = which === 'requiredFields' ? 'optionalFields' : 'requiredFields'
    save(l.id, { [which]: next, [other]: l[other].filter((k) => k !== key) })
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
              Needs: {l.requiredFields.map(label).join(', ') || 'nothing'}
              {l.optionalFields.length > 0 && <> &middot; also exports: {l.optionalFields.map(label).join(', ')}</>}
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
                <p className="label">
                  Click a column to cycle it: not included &rarr; required &rarr; also exported
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {columns.map((c) => {
                    const isRequired = l.requiredFields.includes(c.key)
                    const isOptional = l.optionalFields.includes(c.key)
                    return (
                      <button
                        key={c.key}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          toggleField(l, c.key, isRequired ? 'optionalFields' : 'requiredFields')
                        }
                        className="rounded-md border px-2 py-1 text-xs"
                        style={
                          isRequired
                            ? { background: 'var(--accent)', color: 'var(--accent-text)', borderColor: 'transparent' }
                            : isOptional
                              ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' }
                              : { color: 'var(--muted)' }
                        }
                        title={isRequired ? 'Required' : isOptional ? 'Also exported' : 'Not included'}
                      >
                        {isRequired && <Check size={11} className="mr-1 inline" />}
                        {c.label}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                  Solid = required, a school without it is flagged. Faded = exported when
                  present but never blocks.
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
