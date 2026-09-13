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

export default function ColumnsManager({ columns }: { columns: Col[] }) {
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

  // Optionally fill the new column from the ones already there, rather than
  // leaving it blank for every school.
  const [fill, setFill] = useState<'blank' | 'copy' | 'merge'>('blank')
  const [fillFrom, setFillFrom] = useState('')
  const [fillFrom2, setFillFrom2] = useState('')
  const [separator, setSeparator] = useState(' ')

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

  /**
   * Two steps on purpose. The first call asks how many schools actually hold a
   * value, so the warning names a real number instead of being vague; the
   * delete is only accepted when that same number is sent back, which means it
   * can never happen on a mis-click or against a stale page.
   */
  async function remove(col: Col) {
    setBusy(true)
    setError(null)
    const probe = await fetch(`/api/columns/${col.id}`)
    const info = await probe.json().catch(() => ({}))
    setBusy(false)
    if (!probe.ok) {
      setError(info.error ?? 'Could not read that column')
      return
    }

    const filled: number = info.filledRows ?? 0
    const warning =
      filled > 0
        ? `Delete "${col.label}"?\n\n${filled.toLocaleString('en-IN')} school(s) have a value in it. That data is deleted with the column and cannot be recovered.`
        : `Delete "${col.label}"?\n\nNo school has a value in it yet.`
    if (!confirm(warning)) return

    setBusy(true)
    const res = await fetch(`/api/columns/${col.id}?expectedRows=${filled}`, {
      method: 'DELETE',
    })
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
    // Populate it from existing columns if asked, now that it exists.
    if (fill !== 'blank' && fillFrom) {
      const created = await res.json().catch(() => null)
      if (created?.column?.id) {
        const derive = await fetch(`/api/columns/${created.column.id}/derive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: fill,
            from: fillFrom,
            from2: fill === 'merge' ? fillFrom2 : undefined,
            separator,
          }),
        })
        if (!derive.ok) {
          const d = await derive.json().catch(() => ({}))
          setError(d.error ?? 'Column added, but could not fill it in')
        }
      }
    }

    setLabel('')
    setOptionsText('')
    setType('TEXT')
    setFill('blank')
    setFillFrom('')
    setFillFrom2('')
    setSeparator(' ')
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
                  {!c.isCore && (
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

          {/* Item 6: start the new column from what is already there. */}
          <div className="border-t pt-3">
            <label className="label" htmlFor="nc-fill">Start it from</label>
            <div className="flex flex-wrap items-end gap-2">
              <select
                id="nc-fill"
                className="input w-56"
                value={fill}
                onChange={(e) => setFill(e.target.value as typeof fill)}
              >
                <option value="blank">Leave it blank</option>
                <option value="copy">A copy of another column</option>
                <option value="merge">Two columns merged together</option>
              </select>

              {fill !== 'blank' && (
                <select
                  className="input w-48"
                  value={fillFrom}
                  onChange={(e) => setFillFrom(e.target.value)}
                  aria-label="Column to read from"
                >
                  <option value="">Choose a column...</option>
                  {columns.map((c) => (
                    <option key={c.id} value={c.key}>{c.label}</option>
                  ))}
                </select>
              )}

              {fill === 'merge' && (
                <>
                  <div>
                    <label className="label" htmlFor="nc-sep">Separator</label>
                    <input
                      id="nc-sep"
                      className="input w-24"
                      value={separator}
                      onChange={(e) => setSeparator(e.target.value)}
                      placeholder="space"
                    />
                  </div>
                  <select
                    className="input w-48"
                    value={fillFrom2}
                    onChange={(e) => setFillFrom2(e.target.value)}
                    aria-label="Second column to merge"
                  >
                    <option value="">and...</option>
                    {columns.map((c) => (
                      <option key={c.id} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            {fill === 'merge' && (
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                A row with only one of the two values gets just that value, with no
                separator left dangling.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={create}
              disabled={busy || (fill !== 'blank' && !fillFrom) || (fill === 'merge' && !fillFrom2)}
              type="button"
            >
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
