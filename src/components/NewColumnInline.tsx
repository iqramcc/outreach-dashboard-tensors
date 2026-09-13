'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { COLUMN_TYPES } from '@/app/(app)/columns/ColumnsManager'

const NEEDS_OPTIONS = new Set(['SELECT', 'SELECT_FREE'])

export type CreatedColumn = { id: string; key: string; label: string; type: string; options: string[] | null }

/**
 * Add a column from inside the Add-row dialog, for when someone is entering a
 * school and finds there is nowhere to put something.
 *
 * The new column is empty for every school already saved, so this also offers
 * to fill those in rather than leaving thousands of blanks behind.
 */
export default function NewColumnInline({
  sheetId,
  sheetName,
  existingCount,
  onCreated,
  onCancel,
}: {
  sheetId: string
  sheetName: string
  existingCount: number
  onCreated: (col: CreatedColumn, value: string) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState('TEXT')
  const [optionsText, setOptionsText] = useState('')
  const [value, setValue] = useState('')
  const [backfill, setBackfill] = useState<'none' | 'sheet' | 'all'>('none')
  const [backfillValue, setBackfillValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function parseOptions(text: string) {
    return text.split(/[\n,]/).map((o) => o.trim()).filter(Boolean)
  }

  async function create() {
    if (!label.trim()) {
      setError('Give the column a name')
      return
    }
    const options = NEEDS_OPTIONS.has(type) ? parseOptions(optionsText) : null
    if (options && options.length === 0) {
      setError('List at least one option for a dropdown')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), type, options }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not add the column')
        return
      }

      if (backfill !== 'none' && backfillValue.trim()) {
        await fetch(`/api/columns/${data.column.id}/backfill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            value: backfillValue.trim(),
            sheetId: backfill === 'sheet' ? sheetId : null,
          }),
        })
      }

      onCreated(data.column, value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--accent)' }}>
      <div className="mb-2 flex items-start gap-2 text-xs">
        <AlertTriangle size={14} style={{ color: 'var(--accent)' }} className="mt-0.5 shrink-0" />
        <p style={{ color: 'var(--muted)' }}>
          This field isn&apos;t in the current list. Adding it creates a new column for every
          school, not just this one.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nci-label">Field name</label>
          <input
            id="nci-label"
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="label" htmlFor="nci-type">Type</label>
          <select id="nci-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {COLUMN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {NEEDS_OPTIONS.has(type) && (
        <div className="mt-2">
          <label className="label" htmlFor="nci-options">Options, one per line</label>
          <textarea
            id="nci-options"
            className="input"
            rows={3}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
          />
        </div>
      )}

      <div className="mt-2">
        <label className="label" htmlFor="nci-value">Value for this school</label>
        <input
          id="nci-value"
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      {existingCount > 0 && (
        <div className="mt-2">
          <label className="label" htmlFor="nci-backfill">
            The {existingCount.toLocaleString('en-IN')} schools already saved will have this
            blank. Fill them in?
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="nci-backfill"
              className="input w-auto"
              value={backfill}
              onChange={(e) => setBackfill(e.target.value as typeof backfill)}
            >
              <option value="none">Leave them blank</option>
              <option value="sheet">Fill everything in {sheetName}</option>
              <option value="all">Fill every school in the database</option>
            </select>
            {backfill !== 'none' && (
              <input
                className="input w-40"
                placeholder="Value to fill"
                value={backfillValue}
                onChange={(e) => setBackfillValue(e.target.value)}
                aria-label="Value to fill on existing schools"
              />
            )}
          </div>
          {backfill !== 'none' && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              Only rows with nothing in this column are touched.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }} role="alert">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary py-1 text-xs" onClick={create} disabled={busy} type="button">
          {busy ? 'Adding...' : 'Add field'}
        </button>
        <button className="btn btn-ghost py-1 text-xs" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  )
}
