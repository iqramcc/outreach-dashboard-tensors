'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'

export type Col = {
  id: string
  key: string
  label: string
  type: string
  isCore: boolean
  isVisible: boolean
  order: number
  options: string[] | null
}

/** The field types a column can have, in the team's words. */
export const COLUMN_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'TEXT', label: 'Text', hint: 'Anything typed in.' },
  { value: 'LONGTEXT', label: 'Long text', hint: 'A paragraph, like remarks.' },
  { value: 'NUMBER', label: 'Number', hint: 'Digits only.' },
  { value: 'PHONE', label: 'Phone', hint: 'A contact number.' },
  { value: 'EMAIL', label: 'Email', hint: 'An address.' },
  { value: 'DATE', label: 'Date', hint: 'A date picker.' },
  {
    value: 'SELECT',
    label: 'Dropdown (fixed)',
    hint: 'Only the options you list can be chosen.',
  },
  {
    value: 'SELECT_FREE',
    label: 'Dropdown + free text',
    hint: 'Your options are suggested, but anything else can still be typed.',
  },
]

const NEEDS_OPTIONS = new Set(['SELECT', 'SELECT_FREE'])

export default function ColumnsManager({
  columns,
  isAdmin,
}: {
  columns: Col[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState('TEXT')
  const [optionsText, setOptionsText] = useState('')
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [editOptions, setEditOptions] = useState<string | null>(null)
  const [optionsDraft, setOptionsDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function parseOptions(text: string): string[] {
    return text
      .split(/[\n,]/)
      .map((o) => o.trim())
      .filter(Boolean)
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/columns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not update that column')
      return false
    }
    router.refresh()
    return true
  }

  async function move(col: Col, dir: -1 | 1) {
    const sorted = [...columns].sort((a, b) => a.order - b.order)
    const i = sorted.findIndex((c) => c.id === col.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    setBusy(true)
    await Promise.all([
      fetch(`/api/columns/${sorted[i].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: sorted[j].order }),
      }),
      fetch(`/api/columns/${sorted[j].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: sorted[i].order }),
      }),
    ])
    setBusy(false)
    router.refresh()
  }

  async function remove(col: Col) {
    if (
      !confirm(
        `Delete the "${col.label}" column? Any values stored in it are lost for every school.`
      )
    ) {
      return
    }
    setBusy(true)
    const res = await fetch(`/api/columns/${col.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not delete that column')
      return
    }
    router.refresh()
  }

  async function create() {
    if (!label.trim()) return
    const options = NEEDS_OPTIONS.has(type) ? parseOptions(optionsText) : null
    if (NEEDS_OPTIONS.has(type) && options!.length === 0) {
      setError('List at least one option for a dropdown')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim(), type, options }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not add the column')
      return
    }
    setLabel('')
    setOptionsText('')
    setType('TEXT')
    setAdding(false)
    router.refresh()
  }

  const sorted = [...columns].sort((a, b) => a.order - b.order)
  const typeLabel = (t: string) => COLUMN_TYPES.find((x) => x.value === t)?.label ?? t

  return (
    <>
      {error && (
        <p className="mb-2 text-sm" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium">Label</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Source</th>
              <th className="px-3 py-2 text-right text-xs font-medium">Order</th>
              <th className="px-3 py-2 text-right text-xs font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} className="border-t align-top" style={{ borderColor: 'var(--border)' }}>
                <td className="px-3 py-1.5">
                  <input
                    className="input py-1"
                    value={editing[c.id] ?? c.label}
                    onChange={(e) => setEditing((s) => ({ ...s, [c.id]: e.target.value }))}
                    onBlur={() => {
                      const v = editing[c.id]
                      if (v && v !== c.label) patch(c.id, { label: v })
                    }}
                    aria-label={`Label for ${c.label}`}
                  />
                  {NEEDS_OPTIONS.has(c.type) && (
                    <div className="mt-1">
                      {editOptions === c.id ? (
                        <div className="flex items-start gap-1">
                          <textarea
                            className="input py-1 text-xs"
                            rows={3}
                            value={optionsDraft}
                            onChange={(e) => setOptionsDraft(e.target.value)}
                            placeholder="One option per line"
                          />
                          <button
                            type="button"
                            className="btn btn-ghost py-1 text-xs"
                            disabled={busy}
                            onClick={async () => {
                              const ok = await patch(c.id, {
                                options: parseOptions(optionsDraft),
                              })
                              if (ok) setEditOptions(null)
                            }}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-xs underline"
                          style={{ color: 'var(--muted)' }}
                          onClick={() => {
                            setEditOptions(c.id)
                            setOptionsDraft((c.options ?? []).join('\n'))
                          }}
                        >
                          {c.options?.length ? c.options.join(', ') : 'set options'}
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                  {c.isCore ? (
                    typeLabel(c.type)
                  ) : (
                    <select
                      className="input py-1 text-xs"
                      value={c.type}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.value
                        patch(c.id, {
                          type: next,
                          // A dropdown with no options would be unusable.
                          ...(NEEDS_OPTIONS.has(next) && !c.options?.length
                            ? { options: ['Yes', 'No'] }
                            : {}),
                        })
                      }}
                      aria-label={`Type for ${c.label}`}
                    >
                      {COLUMN_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                  {c.isCore ? 'Built-in' : 'Custom'}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  <button className="p-1" onClick={() => move(c, -1)} disabled={busy} title="Move up" type="button">
                    <ChevronUp size={14} />
                  </button>
                  <button className="p-1" onClick={() => move(c, 1)} disabled={busy} title="Move down" type="button">
                    <ChevronDown size={14} />
                  </button>
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  <button
                    className="p-1"
                    onClick={() => patch(c.id, { isVisible: !c.isVisible })}
                    disabled={busy}
                    title={c.isVisible ? 'Hide by default' : 'Show by default'}
                    type="button"
                  >
                    {c.isVisible ? <Eye size={14} /> : <EyeOff size={14} style={{ color: 'var(--muted)' }} />}
                  </button>
                  {!c.isCore && isAdmin && (
                    <button className="p-1" onClick={() => remove(c)} disabled={busy} title="Delete" type="button">
                      <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="card mt-3 space-y-3 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="nc-label">Column name</label>
              <input
                id="nc-label"
                className="input w-56"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="nc-type">Type</label>
              <select
                id="nc-type"
                className="input w-48"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {COLUMN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {COLUMN_TYPES.find((t) => t.value === type)?.hint}
          </p>

          {NEEDS_OPTIONS.has(type) && (
            <div>
              <label className="label" htmlFor="nc-options">Options, one per line</label>
              <textarea
                id="nc-options"
                className="input max-w-sm"
                rows={4}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={'Yes\nNo\nMaybe'}
              />
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={create} disabled={busy} type="button">
              Add column
            </button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost mt-3" onClick={() => setAdding(true)} type="button">
          <Plus size={15} /> Add a column
        </button>
      )}
    </>
  )
}
