'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Table2 } from 'lucide-react'

type Sheet = { id: string; name: string; description: string | null; count: number }

/**
 * Members can start and rename sheets - a new list is additive and destroys
 * nothing. Deleting one is admin-only and lives elsewhere, because it takes
 * every school row in the sheet with it.
 */
export default function SheetsList({
  sheets,
  canImport,
}: {
  sheets: Sheet[]
  canImport: boolean
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameTo, setRenameTo] = useState('')

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not create that sheet')
      return
    }
    setName('')
    setAdding(false)
    router.refresh()
  }

  async function rename(id: string) {
    if (!renameTo.trim()) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/sheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameTo.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not rename that sheet')
      return
    }
    setRenaming(null)
    router.refresh()
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Sheets</h1>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" onClick={() => setAdding((v) => !v)} type="button">
            <Plus size={15} /> New sheet
          </button>
          {canImport && (
            <Link href="/import" className="btn btn-primary">
              Import Excel
            </Link>
          )}
        </div>
      </div>

      {adding && (
        <div className="card mb-3 flex flex-wrap items-end gap-2 p-3">
          <div>
            <label className="label" htmlFor="ns-name">Sheet name</label>
            <input
              id="ns-name"
              className="input w-64"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="e.g. Kozhikode tuition centres"
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={create} disabled={busy} type="button">
            Create
          </button>
          <button className="btn btn-ghost" onClick={() => setAdding(false)} type="button">
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="mb-2 text-sm" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}

      {sheets.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No sheets yet. Create one above, or import an Excel file.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((s) => (
            <div key={s.id} className="card p-4">
              {renaming === s.id ? (
                <div className="flex items-center gap-1">
                  <input
                    className="input py-1"
                    value={renameTo}
                    onChange={(e) => setRenameTo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(s.id)
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    aria-label={`New name for ${s.name}`}
                    autoFocus
                  />
                  <button
                    className="btn btn-ghost py-1 text-xs"
                    onClick={() => rename(s.id)}
                    disabled={busy}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <Table2 size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/sheets/${s.id}`} className="block truncate font-medium hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {s.count.toLocaleString('en-IN')} schools
                    </p>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--muted)' }}>
                        {s.description}
                      </p>
                    )}
                  </div>
                  <button
                    className="p-1"
                    onClick={() => {
                      setRenaming(s.id)
                      setRenameTo(s.name)
                    }}
                    title="Rename"
                    aria-label={`Rename ${s.name}`}
                    type="button"
                  >
                    <Pencil size={13} style={{ color: 'var(--muted)' }} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
