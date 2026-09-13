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
}

type Preview = {
  list: { id: string; name: string }
  fields: Field[]
  schools: SchoolPreview[]
}

/**
 * Shown before anything is added to a mail or message list.
 *
 * It answers the two questions a member actually has: what of mine ends up on
 * the admin's sheet, and is anything missing? Compulsory gaps have to be filled
 * here - the alternative is an export the admin cannot send.
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
  /** { schoolId: { field: value } } */
  const [typed, setTyped] = useState<Record<string, Record<string, string>>>({})

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

  const requiredFields = preview?.fields.filter((f) => f.required) ?? []
  const optionalFields = preview?.fields.filter((f) => !f.required) ?? []

  // Recomputed as they type, so the button unlocks the moment the last gap closes.
  const stillMissing =
    preview?.schools.filter((s) =>
      requiredFields.some((f) => valueOf(s, f.key).trim() === '')
    ) ?? []

  const unfixable = stillMissing.filter((s) =>
    requiredFields.some((f) => !f.fillable && valueOf(s, f.key).trim() === '')
  )

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
        className="card w-full max-w-3xl overflow-hidden"
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

        <div className="thin-scroll max-h-[70vh] overflow-auto p-4">
          {loading && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Checking what this list needs...
            </p>
          )}

          {preview && (
            <>
              <p className="label">What goes to the admin from each school</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {requiredFields.map((f) => (
                  <span
                    key={f.key}
                    className="rounded-md px-2 py-1 text-xs font-medium"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    {f.label} *
                  </span>
                ))}
                {optionalFields.map((f) => (
                  <span
                    key={f.key}
                    className="rounded-md px-2 py-1 text-xs"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {f.label}
                  </span>
                ))}
                {preview.fields.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    This list asks for nothing yet.
                  </span>
                )}
              </div>
              <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
                <strong>*</strong> is compulsory. Everything else is exported when it is
                there. Values are filled in from the sheet automatically.
              </p>

              {stillMissing.length === 0 ? (
                <p
                  className="flex items-center gap-1.5 rounded-md border p-2.5 text-sm"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  <Check size={15} />
                  Nothing missing &mdash; every school has what this list needs.
                </p>
              ) : (
                <>
                  <p
                    className="mb-2 flex items-start gap-1.5 text-sm"
                    style={{ color: 'var(--danger)' }}
                  >
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    {stillMissing.length} school
                    {stillMissing.length === 1 ? ' is' : 's are'} missing something compulsory.
                    Fill it in below &mdash; it is saved on the school too, so you will not be
                    asked again.
                  </p>

                  <div className="thin-scroll max-h-80 overflow-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead
                        className="sticky top-0"
                        style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                      >
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">School</th>
                          {requiredFields.map((f) => (
                            <th key={f.key} className="px-2 py-1.5 text-left font-medium">
                              {f.label} *
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stillMissing.map((s) => (
                          <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                            <td className="px-2 py-1 align-top">
                              {s.name}
                              {s.alreadyOnList && (
                                <span className="ml-1" style={{ color: 'var(--muted)' }}>
                                  (already on the list)
                                </span>
                              )}
                            </td>
                            {requiredFields.map((f) => {
                              const v = valueOf(s, f.key)
                              const blank = v.trim() === ''
                              return (
                                <td key={f.key} className="px-2 py-1">
                                  {f.fillable ? (
                                    <input
                                      className="input py-0.5 text-xs"
                                      value={v}
                                      onChange={(e) => setValue(s.id, f.key, e.target.value)}
                                      placeholder={blank ? `${f.label} needed` : ''}
                                      style={
                                        blank ? { borderColor: 'var(--danger)' } : undefined
                                      }
                                      aria-label={`${f.label} for ${s.name}`}
                                    />
                                  ) : (
                                    <span style={{ color: blank ? 'var(--danger)' : undefined }}>
                                      {blank ? 'set this on the school' : v}
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {unfixable.length > 0 && (
                <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
                  {unfixable.length} school(s) need a field that cannot be typed here. Open the
                  school and set it, then try again.
                </p>
              )}
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
