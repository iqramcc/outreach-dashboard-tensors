'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'

type Col = {
  id: string
  key: string
  label: string
  type: string
  isCore: boolean
  isVisible: boolean
  order: number
}

const TYPES = ['TEXT', 'LONGTEXT', 'NUMBER', 'PHONE', 'EMAIL', 'DATE', 'CHECKBOX'] as const

export default function ColumnsAdmin({ columns }: { columns: Col[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<string>('TEXT')
  const [editing, setEditing] = useState<Record<string, string>>({})

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true)
    await fetch(`/api/columns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    router.refresh()
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
    if (!confirm(`Delete the "${col.label}" column? Any values stored in it are lost.`)) return
    setBusy(true)
    const res = await fetch(`/api/columns/${col.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Could not delete')
      return
    }
    router.refresh()
  }

  async function create() {
    if (!label.trim()) return
    setBusy(true)
    const res = await fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim(), type }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Could not add the column')
      return
    }
    setLabel('')
    setAdding(false)
    router.refresh()
  }

  const sorted = [...columns].sort((a, b) => a.order - b.order)

  return (
    <>
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
              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-3 py-1.5">
                  <input
                    className="input py-1"
                    value={editing[c.id] ?? c.label}
                    onChange={(e) => setEditing((s) => ({ ...s, [c.id]: e.target.value }))}
                    onBlur={() => {
                      const v = editing[c.id]
                      if (v && v !== c.label) patch(c.id, { label: v })
                    }}
                  />
                </td>
                <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                  {c.type.toLowerCase()}
                </td>
                <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                  {c.isCore ? 'Built-in' : 'Custom'}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button className="p-1" onClick={() => move(c, -1)} disabled={busy} title="Move up" type="button">
                    <ChevronUp size={14} />
                  </button>
                  <button className="p-1" onClick={() => move(c, 1)} disabled={busy} title="Move down" type="button">
                    <ChevronDown size={14} />
                  </button>
                </td>
                <td className="px-3 py-1.5 text-right">
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
        <div className="card mt-3 flex flex-wrap items-end gap-2 p-3">
          <div>
            <label className="label" htmlFor="nc-label">Column name</label>
            <input
              id="nc-label"
              className="input w-56"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="nc-type">Type</label>
            <select id="nc-type" className="input w-36" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t.toLowerCase()}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={create} disabled={busy} type="button">Add</button>
          <button className="btn btn-ghost" onClick={() => setAdding(false)} type="button">Cancel</button>
        </div>
      ) : (
        <button className="btn btn-ghost mt-3" onClick={() => setAdding(true)} type="button">
          <Plus size={15} /> Add a column
        </button>
      )}
    </>
  )
}
