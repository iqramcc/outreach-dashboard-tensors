'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, X } from 'lucide-react'
import { districtsFor, REGION_LABELS } from '@/lib/regions'
import type { RegionCategory } from '@prisma/client'
import type { Status } from '@/app/(app)/sheets/[id]/SheetView'
import type { ResolvedColumn } from '@/lib/columns'
import NewColumnInline, { type CreatedColumn } from './NewColumnInline'

/**
 * Add one school by hand, into this sheet or any other.
 *
 * The duplicate check here warns rather than blocks: the same school name in a
 * different district is a different school, so the final call is the user's.
 */
/** A freshly created column, shaped like the ones the grid already knows. */
function toResolved(c: CreatedColumn): ResolvedColumn {
  return {
    id: c.id,
    key: c.key,
    label: c.label,
    type: c.type as ResolvedColumn['type'],
    isCore: false,
    isVisible: true,
    order: 999,
    width: null,
    options: c.options,
  }
}

export default function AddRowDialog({
  sheetId,
  sheetName,
  statuses,
  districts,
  customColumns,
  existingCount,
  onClose,
  onCreated,
}: {
  sheetId: string
  sheetName: string
  statuses: Status[]
  districts: string[]
  /** Columns beyond the built-in ones, so nothing the team added is missing here. */
  customColumns: ResolvedColumn[]
  existingCount: number
  onClose: () => void
  onCreated: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    district: districts[0] ?? '',
    regionCategory: 'KERALA' as RegionCategory,
    listType: 'CONNECTED',
    entityType: 'SCHOOL',
    contact: '',
    email: '',
    pocName: '',
    connection: '',
    remarks: '',
    statusId: statuses.find((s) => s.isDefault)?.id ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dupWarning, setDupWarning] = useState<string | null>(null)

  // Values for custom columns, plus any field invented here and then.
  const [extra, setExtra] = useState<Record<string, string>>({})
  const [added, setAdded] = useState<CreatedColumn[]>([])
  const [addingField, setAddingField] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(force: boolean) {
    if (!form.name.trim()) {
      setError('School name is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, extra, sheetId, force }),
      })
      const data = await res.json()
      if (res.status === 409) {
        setDupWarning(data.message ?? 'This looks like a duplicate.')
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Could not add the row')
        return
      }
      onCreated()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const suggestions = districtsFor(form.regionCategory)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: 'rgb(0 0 0 / 0.45)' }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Add a school to {sheetName}</h2>
          <button type="button" onClick={onClose} className="p-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="thin-scroll max-h-[70vh] space-y-3 overflow-auto p-4">
          <div>
            <label className="label" htmlFor="ar-name">School / institution name *</label>
            <input
              id="ar-name"
              className="input"
              value={form.name}
              onChange={(e) => { set('name', e.target.value); setDupWarning(null) }}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ar-region">Region</label>
              <select
                id="ar-region"
                className="input"
                value={form.regionCategory}
                onChange={(e) => set('regionCategory', e.target.value as RegionCategory)}
              >
                {Object.entries(REGION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ar-district">District</label>
              <input
                id="ar-district"
                className="input"
                list="ar-district-list"
                value={form.district}
                onChange={(e) => { set('district', e.target.value); setDupWarning(null) }}
              />
              <datalist id="ar-district-list">
                {[...new Set([...suggestions, ...districts])].map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ar-type">Type</label>
              <select id="ar-type" className="input" value={form.entityType} onChange={(e) => set('entityType', e.target.value)}>
                <option value="SCHOOL">School</option>
                <option value="TUITION_CENTRE">Tuition centre</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ar-list">List</label>
              <select id="ar-list" className="input" value={form.listType} onChange={(e) => set('listType', e.target.value)}>
                <option value="CONNECTED">Connected school</option>
                <option value="MASS_CALL">Mass call list</option>
                <option value="OFFLINE_OUTREACH">Offline outreach</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ar-contact">Contact</label>
              <input id="ar-contact" className="input" value={form.contact} onChange={(e) => set('contact', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ar-email">Mail</label>
              <input id="ar-email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ar-poc">POC from the school</label>
              <input id="ar-poc" className="input" value={form.pocName} onChange={(e) => set('pocName', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ar-conn">Connection</label>
              <input id="ar-conn" className="input" value={form.connection} onChange={(e) => set('connection', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="ar-status">Status</label>
            <select id="ar-status" className="input" value={form.statusId} onChange={(e) => set('statusId', e.target.value)}>
              <option value="">No status</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ar-remarks">Remarks</label>
            <textarea id="ar-remarks" className="input" rows={2} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} />
          </div>

          {/* Custom columns, including any just invented. */}
          {[...customColumns, ...added.map(toResolved)].length > 0 && (
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              {[...customColumns, ...added.map(toResolved)].map((c) => (
                <div key={c.key}>
                  <label className="label" htmlFor={`ar-x-${c.key}`}>{c.label}</label>
                  {c.type === 'SELECT' && c.options?.length ? (
                    <select
                      id={`ar-x-${c.key}`}
                      className="input"
                      value={extra[c.key] ?? ''}
                      onChange={(e) => setExtra((x) => ({ ...x, [c.key]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {c.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <input
                        id={`ar-x-${c.key}`}
                        className="input"
                        list={c.options?.length ? `ar-opts-${c.key}` : undefined}
                        value={extra[c.key] ?? ''}
                        onChange={(e) => setExtra((x) => ({ ...x, [c.key]: e.target.value }))}
                      />
                      {c.options?.length ? (
                        <datalist id={`ar-opts-${c.key}`}>
                          {c.options.map((o) => (
                            <option key={o} value={o} />
                          ))}
                        </datalist>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Item 12: somewhere to put something the sheet has no column for. */}
          {addingField ? (
            <NewColumnInline
              sheetId={sheetId}
              sheetName={sheetName}
              existingCount={existingCount}
              onCancel={() => setAddingField(false)}
              onCreated={(col, value) => {
                setAdded((a) => [...a, col])
                if (value) setExtra((x) => ({ ...x, [col.key]: value }))
                setAddingField(false)
                router.refresh()
              }}
            />
          ) : (
            <button
              type="button"
              className="btn btn-ghost py-1 text-xs"
              onClick={() => setAddingField(true)}
            >
              <Plus size={13} /> Need another field?
            </button>
          )}

          {dupWarning && (
            <div className="flex gap-2 rounded-md border p-2.5 text-xs" style={{ borderColor: 'var(--danger)' }}>
              <AlertTriangle size={15} style={{ color: 'var(--danger)' }} className="mt-0.5 shrink-0" />
              <div>
                <p style={{ color: 'var(--danger)' }}>{dupWarning}</p>
                <p className="mt-1" style={{ color: 'var(--muted)' }}>
                  If this really is a different school, add it anyway.
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs" style={{ color: 'var(--danger)' }} role="alert">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-2.5">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {dupWarning ? (
            <button type="button" className="btn btn-danger" onClick={() => submit(true)} disabled={busy}>
              Add anyway
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => submit(false)} disabled={busy}>
              {busy ? 'Adding...' : 'Add school'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
