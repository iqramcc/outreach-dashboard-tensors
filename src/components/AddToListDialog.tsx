'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'

type Field = { key: string; label: string; required: boolean; fillable: boolean }

type SchoolPreview = {
  id: string
  name: string
  values: Record<string, string>
  missingRequired: string[]
  alreadyOnList: boolean
  /** A note already saved for this school on this list. */
  note: string
}

type Preview = {
  list: { id: string; name: string }
  fields: Field[]
  schools: SchoolPreview[]
}

/**
 * Shown before anything is added to a mail or message list.
 *
 * Every selected school is listed with every field the list takes, filled in
 * from the sheet and editable - so the member can see exactly what the admin
 * will receive, and correct it, rather than only being shown the gaps.
 *
 * Compulsory gaps have to be closed here: the alternative is an export the
 * admin cannot send.
 */
export default function AddToListDialog({
  listId,
  schoolIds,
  onClose,
  onDone,
}: {
  listId: string
  schoolIds: string[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Only what the member actually changed: { schoolId: { field: value } } */
  const [typed, setTyped] = useState<Record<string, Record<string, string>>>({})
  const [onlyGaps, setOnlyGaps] = useState(false)
  /** Optional note per school, for whoever sends the batch. */
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/campaigns/${listId}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolIds }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) setError(data.error ?? 'Could not read that list')
        else setPreview(data)
      } catch {
        if (!cancelled) setError('Could not read that list')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [listId, schoolIds])

  const valueOf = useCallback(
    (s: SchoolPreview, key: string) => typed[s.id]?.[key] ?? s.values[key] ?? '',
    [typed]
  )

  function setValue(schoolId: string, key: string, value: string) {
    setTyped((t) => ({ ...t, [schoolId]: { ...(t[schoolId] ?? {}), [key]: value } }))
  }

  const noteOf = (s: SchoolPreview) => notes[s.id] ?? s.note ?? ''

  const fields = preview?.fields ?? []
  const required = fields.filter((f) => f.required)

  const isIncomplete = useCallback(
    (s: SchoolPreview) => required.some((f) => valueOf(s, f.key).trim() === ''),
    [required, valueOf]
  )

  // Recomputed as they type, so the button unlocks the moment the last gap closes.
  const stillMissing = preview?.schools.filter(isIncomplete) ?? []
  const shown = onlyGaps ? stillMissing : (preview?.schools ?? [])
  const editedCount = Object.values(typed).filter((v) => Object.keys(v).length > 0).length

  async function submit() {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${listId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolIds,
          on: true,
          overrides: typed,
          notes,
          requireComplete: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not add those schools')
        return
      }
      const bits = [`${data.added} added to ${preview.list.name}`]
      if (data.alreadyThere) bits.push(`${data.alreadyThere} already there`)
      if (data.updatedSchools) bits.push(`${data.updatedSchools} school(s) updated`)
      onDone(bits.join(' · '))
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: 'rgb(0 0 0 / 0.45)' }}
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            Add {schoolIds.length} school{schoolIds.length === 1 ? '' : 's'} to{' '}
            {preview?.list.name ?? 'the list'}
          </h2>
          <button type="button" onClick={onClose} className="p-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="thin-scroll flex-1 overflow-auto p-4">
          {loading && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Checking what this list needs...
            </p>
          )}

          {preview && fields.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              This list does not ask for any fields yet. An admin sets those under
              Lists &rarr; Fields.
            </p>
          )}

          {preview && fields.length > 0 && (
            <>
              <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
                This is exactly what the admin receives for each school. Everything is
                filled in from the sheet and can be edited &mdash; a change is saved on the
                school too, not just on this list. <strong>*</strong> is compulsory.
                The comment is optional and stays with this list only.
              </p>

              <div className="mb-2 flex flex-wrap items-center gap-2">
                {stillMissing.length > 0 ? (
                  <span
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--danger)' }}
                  >
                    <AlertTriangle size={14} />
                    {stillMissing.length} school
                    {stillMissing.length === 1 ? '' : 's'} missing something compulsory
                  </span>
                ) : (
                  <span
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Check size={14} /> Nothing missing
                  </span>
                )}

                {stillMissing.length > 0 && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={onlyGaps}
                      onChange={(e) => setOnlyGaps(e.target.checked)}
                    />
                    Show only the ones needing attention
                  </label>
                )}

                {editedCount > 0 && (
                  <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
                    {editedCount} school{editedCount === 1 ? '' : 's'} edited
                  </span>
                )}
              </div>

              <div className="thin-scroll overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead
                    className="sticky top-0 z-10"
                    style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                  >
                    <tr>
                      <th
                        className="sticky left-0 z-20 px-2 py-1.5 text-left font-medium"
                        style={{ background: 'var(--surface-2)', minWidth: '12rem' }}
                      >
                        School
                      </th>
                      {fields.map((f) => (
                        <th
                          key={f.key}
                          className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                          style={{ minWidth: '10rem' }}
                        >
                          {f.label}
                          {f.required && <span style={{ color: 'var(--danger)' }}> *</span>}
                        </th>
                      ))}
                      <th
                        className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                        style={{ minWidth: '14rem' }}
                      >
                        Comment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((s) => (
                      <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td
                          className="sticky left-0 z-10 px-2 py-1 align-middle"
                          style={{ background: 'var(--surface)' }}
                        >
                          <span className="block truncate" title={s.name}>
                            {s.name}
                          </span>
                          {s.alreadyOnList && (
                            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                              already on this list
                            </span>
                          )}
                        </td>
                        {fields.map((f) => {
                          const v = valueOf(s, f.key)
                          const blank = v.trim() === ''
                          const bad = blank && f.required
                          return (
                            <td key={f.key} className="px-2 py-1">
                              {f.fillable ? (
                                <input
                                  className="input py-0.5 text-xs"
                                  value={v}
                                  onChange={(e) => setValue(s.id, f.key, e.target.value)}
                                  placeholder={bad ? `${f.label} needed` : '—'}
                                  style={bad ? { borderColor: 'var(--danger)' } : undefined}
                                  aria-label={`${f.label} for ${s.name}`}
                                />
                              ) : (
                                // Numbers, enums and relations are not sensible to
                                // type here; they are set on the school itself.
                                <span
                                  title="Set this on the school"
                                  style={{ color: bad ? 'var(--danger)' : 'var(--muted)' }}
                                >
                                  {v || 'set on the school'}
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-2 py-1">
                          <input
                            className="input py-0.5 text-xs"
                            value={noteOf(s)}
                            onChange={(e) =>
                              setNotes((n) => ({ ...n, [s.id]: e.target.value }))
                            }
                            placeholder="Anything the sender should know"
                            aria-label={`Comment for ${s.name}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error && (
            <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }} role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-2.5">
          {stillMissing.length > 0 && (
            <span className="mr-auto text-xs" style={{ color: 'var(--muted)' }}>
              {stillMissing.length} still to fill
            </span>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || loading || !preview || stillMissing.length > 0}
          >
            {busy ? 'Adding...' : `Add ${schoolIds.length}`}
          </button>
        </div>
      </div>
    </div>
  )
}
