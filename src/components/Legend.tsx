'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Status } from '@/app/(app)/sheets/[id]/SheetView'

/**
 * The colour legend, pinned above every sheet.
 *
 * This is the same list as the outreach pipeline by design: the team asked for
 * colour codes with their meanings labelled at the top, and that legend IS the
 * status list. One source means the row colours, this legend and the dashboard
 * funnel can never disagree.
 *
 * Clicking a swatch filters the sheet to that status.
 */
export default function Legend({
  statuses,
  isAdmin,
  activeId,
  onFilter,
}: {
  statuses: Status[]
  isAdmin: boolean
  activeId: string | null
  onFilter: (id: string) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Record<string, { name: string; hex: string }>>({})
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#10803f')

  function startEdit() {
    const d: Record<string, { name: string; hex: string }> = {}
    for (const s of statuses) d[s.id] = { name: s.name, hex: s.hex }
    setDraft(d)
    setEditing(true)
  }

  async function save(id: string) {
    const d = draft[id]
    if (!d) return
    setBusy(true)
    await fetch(`/api/statuses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.name, hex: d.hex }),
    })
    setBusy(false)
    router.refresh()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete the "${name}" label? Schools using it keep their data and simply lose this label.`)) {
      return
    }
    setBusy(true)
    await fetch(`/api/statuses/${id}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

  async function create() {
    if (!newName.trim()) return
    setBusy(true)
    const res = await fetch('/api/statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), hex: newHex }),
    })
    setBusy(false)
    if (res.ok) {
      setNewName('')
      setAdding(false)
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Could not add that label')
    }
  }

  return (
    <div className="card mb-3 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
          Colour key
        </span>

        {statuses.map((s) =>
          editing ? (
            <span key={s.id} className="flex items-center gap-1 rounded-md border px-1.5 py-1">
              <input
                type="color"
                value={draft[s.id]?.hex ?? s.hex}
                onChange={(e) => setDraft((d) => ({ ...d, [s.id]: { ...d[s.id], hex: e.target.value } }))}
                className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label={`Colour for ${s.name}`}
              />
              <input
                value={draft[s.id]?.name ?? s.name}
                onChange={(e) => setDraft((d) => ({ ...d, [s.id]: { ...d[s.id], name: e.target.value } }))}
                className="w-28 rounded border px-1 py-0.5 text-xs"
                style={{ background: 'var(--surface)', color: 'var(--text)' }}
                aria-label={`Label for ${s.name}`}
              />
              <button type="button" onClick={() => save(s.id)} disabled={busy} title="Save" className="p-0.5">
                <Check size={13} style={{ color: 'var(--accent)' }} />
              </button>
              <button type="button" onClick={() => remove(s.id, s.name)} disabled={busy} title="Delete" className="p-0.5">
                <Trash2 size={13} style={{ color: 'var(--danger)' }} />
              </button>
            </span>
          ) : (
            <button
              key={s.id}
              type="button"
              onClick={() => onFilter(activeId === s.id ? '' : s.id)}
              className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs transition-opacity hover:opacity-80"
              style={
                activeId === s.id
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }
                  : {}
              }
              title={`Show only "${s.name}"`}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.hex }} />
              {s.name}
            </button>
          )
        )}

        {isAdmin && (
          <div className="ml-auto flex items-center gap-1.5">
            {editing && !adding && (
              <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setAdding(true)}>
                <Plus size={13} /> Add
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => (editing ? setEditing(false) : startEdit())}
            >
              {editing ? <><X size={13} /> Done</> : <><Pencil size={13} /> Edit key</>}
            </button>
          </div>
        )}
      </div>

      {adding && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
          <input type="color" value={newHex} onChange={(e) => setNewHex(e.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="New colour" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="What does this colour mean?"
            className="input w-60"
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button type="button" className="btn btn-primary py-1 text-xs" onClick={create} disabled={busy}>
            Add label
          </button>
          <button type="button" className="btn btn-ghost py-1 text-xs" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
