'use client'

import { useCallback, useState } from 'react'
import type { ResolvedColumn } from '@/lib/columns'

type Option = { value: string; label: string; hex?: string }

/**
 * One cell of the grid. Click to edit, Enter or blur to save, Escape to cancel
 * - the spreadsheet behaviour the team already has muscle memory for.
 *
 * SELECT columns commit on change (one click, no second confirm), which is
 * what makes working a call list down the Status column fast.
 */
export default function EditableCell({
  column,
  display,
  rawValue,
  color,
  options,
  suggestions,
  onSave,
}: {
  rowId: string
  column: ResolvedColumn
  display: string
  rawValue: string
  color: string | null
  options: Option[] | null
  /** Pick-or-type values. Keeps spelling consistent without blocking new ones. */
  suggestions?: readonly string[] | null
  onSave: (value: string | number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rawValue)
  // When the row is saved elsewhere the incoming value changes; adjust the
  // draft during render rather than in an effect, which avoids a second pass.
  const [syncedFrom, setSyncedFrom] = useState(rawValue)
  if (syncedFrom !== rawValue) {
    setSyncedFrom(rawValue)
    setDraft(rawValue)
  }

  const inputRef = useCallback((node: HTMLInputElement | HTMLTextAreaElement | null) => {
    node?.focus()
  }, [])

  function commit() {
    setEditing(false)
    if (draft === rawValue) return
    onSave(draft === '' ? null : draft)
  }

  function cancel() {
    setDraft(rawValue)
    setEditing(false)
  }

  const isStatus = column.key === 'status'

  // Status renders as a filled pill in its own colour; it is the one column
  // people scan down, so it gets the strongest visual treatment.
  if (isStatus) {
    return (
      <td className="border-b border-r px-1.5 py-1" style={{ minWidth: column.width ?? 140 }}>
        <select
          value={rawValue}
          onChange={(e) => onSave(e.target.value === '' ? null : e.target.value)}
          className="w-full cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-medium"
          style={
            color
              ? { background: color, color: pickText(color) }
              : { background: 'var(--surface-2)', color: 'var(--muted)' }
          }
        >
          {(options ?? []).map((o) => (
            <option key={o.value} value={o.value} style={{ background: 'var(--surface)', color: 'var(--text)' }}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
    )
  }

  if (options) {
    return (
      <td className="border-b border-r px-1.5 py-1" style={{ minWidth: column.width ?? 140 }}>
        <select
          value={rawValue}
          onChange={(e) => onSave(e.target.value === '' ? null : e.target.value)}
          className="w-full cursor-pointer rounded border-0 bg-transparent px-1 py-0.5 text-sm"
          style={{ color: 'var(--text)' }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ background: 'var(--surface)', color: 'var(--text)' }}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
    )
  }

  const listId = `sugg-${column.key}`
  const inputType =
    column.type === 'DATE'
      ? 'date'
      : column.type === 'NUMBER'
        ? 'number'
        : column.type === 'EMAIL'
          ? 'email'
          : 'text'

  return (
    <td
      className="cursor-text border-b border-r px-2 py-1 align-top"
      style={{
        minWidth: column.width ?? 140,
        background: color ?? undefined,
        color: color ? pickText(color) : undefined,
      }}
      onClick={() => !editing && setEditing(true)}
      title={display}
    >
      {editing ? (
        column.type === 'LONGTEXT' ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
              // Enter saves; Shift+Enter makes a new line.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commit()
              }
            }}
            rows={3}
            className="w-full resize-y rounded border px-1 py-0.5 text-sm"
            style={{ background: 'var(--surface)', color: 'var(--text)' }}
          />
        ) : (
          <input
            ref={inputRef}
            type={inputType}
            list={suggestions && suggestions.length > 0 ? listId : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
              if (e.key === 'Enter') commit()
            }}
            className="w-full rounded border px-1 py-0.5 text-sm"
            style={{ background: 'var(--surface)', color: 'var(--text)' }}
          />
        )
      ) : (
        <span className="block max-w-[22rem] truncate">
          {display || <span style={{ color: 'var(--muted)' }}>&mdash;</span>}
        </span>
      )}
      {editing && suggestions && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </td>
  )
}

/**
 * Black or white text over an arbitrary status colour. Uses the sRGB relative
 * luminance formula so a team-chosen yellow stays readable.
 */
function pickText(hex: string): string {
  const m = hex.replace('#', '')
  if (m.length !== 6) return '#000'
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.45 ? '#10231a' : '#ffffff'
}
