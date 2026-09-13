'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Palette, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { PersonalTag, Status } from '@/app/(app)/sheets/[id]/SheetView'

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
  myColours,
  myTags,
}: {
  statuses: Status[]
  isAdmin: boolean
  activeId: string | null
  onFilter: (id: string) => void
  /** This viewer's own colour per status, overriding the shared one. */
  myColours: Record<string, string>
  myTags: PersonalTag[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Record<string, { name: string; hex: string }>>({})
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#10803f')

  // The personal overlay. The shared key above is the team's agreed meaning
  // and only an admin changes it; everything here is this viewer's alone.
  const [mine, setMine] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagHex, setTagHex] = useState('#8b5cf6')

  const colourOf = (s: Status) => myColours[s.id] ?? s.hex

  async function setMyColour(statusId: string, hex: string | null) {
    setBusy(true)
    await fetch('/api/personal/colours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusId, hex }),
    })
    setBusy(false)
    router.refresh()
  }

  async function addTag() {
    if (!tagName.trim()) return
    setBusy(true)
    const res = await fetch('/api/personal/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tagName.trim(), hex: tagHex }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Could not add that mark')
      return
    }
    setTagName('')
    router.refresh()
  }

  async function updateTag(id: string, body: Record<string, unknown>) {
    setBusy(true)
    await fetch(`/api/personal/tags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    router.refresh()
  }

  async function removeTag(id: string, name: string) {
    if (!confirm(`Remove your "${name}" mark? The schools themselves are untouched.`)) return
    setBusy(true)
    await fetch(`/api/personal/tags/${id}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

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
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colourOf(s) }} />
              {s.name}
            </button>
          )
        )}

        <div className={isAdmin ? 'flex items-center gap-1.5' : 'ml-auto flex items-center gap-1.5'}>
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            style={mine ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : {}}
            onClick={() => setMine((v) => !v)}
            title="Colours and marks only you can see"
          >
            <Palette size={13} /> My colours
          </button>
        </div>

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

      {mine && (
        <div className="mt-2 border-t pt-2">
          <p className="mb-1.5 text-xs" style={{ color: 'var(--muted)' }}>
            Only you see these. The key above stays as the team agreed it.
          </p>

          <p className="label">Recolour a status for yourself</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {statuses.map((s) => {
              const overridden = myColours[s.id] !== undefined
              return (
                <span key={s.id} className="flex items-center gap-1 text-xs">
                  <input
                    type="color"
                    value={colourOf(s)}
                    onChange={(e) => setMyColour(s.id, e.target.value)}
                    disabled={busy}
                    className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label={`My colour for ${s.name}`}
                  />
                  {s.name}
                  {overridden && (
                    <button
                      type="button"
                      onClick={() => setMyColour(s.id, null)}
                      title="Back to the team's colour"
                      className="p-0.5"
                    >
                      <RotateCcw size={11} style={{ color: 'var(--muted)' }} />
                    </button>
                  )}
                </span>
              )
            })}
          </div>

          <p className="label mt-3">Your own marks</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {myTags.map((t) => (
              <span key={t.id} className="flex items-center gap-1 text-xs">
                <input
                  type="color"
                  value={t.hex}
                  onChange={(e) => updateTag(t.id, { hex: e.target.value })}
                  disabled={busy}
                  className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={`Colour for ${t.name}`}
                />
                {t.name}
                <span style={{ color: 'var(--muted)' }}>({t.schoolIds.length})</span>
                <button
                  type="button"
                  onClick={() => removeTag(t.id, t.name)}
                  className="p-0.5"
                  aria-label={`Remove ${t.name}`}
                >
                  <Trash2 size={11} style={{ color: 'var(--danger)' }} />
                </button>
              </span>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={tagHex}
              onChange={(e) => setTagHex(e.target.value)}
              className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="Colour for the new mark"
            />
            <input
              className="input w-56"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              placeholder="e.g. call after exams"
              aria-label="Name of the new mark"
            />
            <button
              type="button"
              className="btn btn-ghost py-1 text-xs"
              onClick={addTag}
              disabled={busy}
            >
              <Plus size={13} /> Add mark
            </button>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Then tick rows and use &ldquo;My marks&rdquo; to apply it.
            </span>
          </div>
        </div>
      )}

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
