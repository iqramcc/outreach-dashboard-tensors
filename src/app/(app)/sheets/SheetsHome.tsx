'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Layers, MapPin, Pencil, Plus, Table2, Users } from 'lucide-react'

type Sheet = {
  id: string
  name: string
  description: string | null
  count: number
  /** How many rows of each list type this sheet holds. */
  lists: Record<string, number>
}
type Member = { id: string; name: string; lists: Record<string, number> }

const PRIMARY = 'CONNECTED'
const SECONDARY = 'MASS_CALL'

function n(x: number) {
  return x.toLocaleString('en-IN')
}

/** A row in one of the two trees. Everything but a stored sheet is a view. */
function Entry({
  href,
  label,
  count,
  hint,
  depth = 0,
  virtual = false,
  onRename,
}: {
  href: string
  label: string
  count: number
  hint?: string
  depth?: number
  virtual?: boolean
  onRename?: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 border-t px-3 py-2 text-sm"
      style={{ borderColor: 'var(--border)', paddingLeft: `${0.75 + depth * 1.25}rem` }}
    >
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
        {virtual ? (
          <Layers size={14} style={{ color: 'var(--muted)' }} />
        ) : (
          <Table2 size={14} style={{ color: 'var(--accent)' }} />
        )}
        <span className="truncate">{label}</span>
        {hint && (
          <span className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
            {hint}
          </span>
        )}
      </Link>
      <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
        {n(count)}
      </span>
      {onRename && (
        <button type="button" onClick={onRename} className="p-0.5" aria-label={`Rename ${label}`}>
          <Pencil size={12} style={{ color: 'var(--muted)' }} />
        </button>
      )}
    </div>
  )
}

export default function SheetsHome({
  sheets,
  members,
  unassigned,
  canImport,
}: {
  sheets: Sheet[]
  members: Member[]
  unassigned: number
  canImport: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'place' | 'person'>('place')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Sheet | null>(null)
  const [renameTo, setRenameTo] = useState('')
  const [openMember, setOpenMember] = useState<string | null>(null)

  const primaryTotal = sheets.reduce((t, s) => t + (s.lists[PRIMARY] ?? 0), 0)
  const secondaryTotal = sheets.reduce((t, s) => t + (s.lists[SECONDARY] ?? 0), 0)

  const primarySheets = sheets.filter((s) => (s.lists[PRIMARY] ?? 0) > 0)
  const secondarySheets = sheets.filter((s) => (s.lists[SECONDARY] ?? 0) > 0)
  const emptySheets = sheets.filter((s) => s.count === 0)

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

  async function rename() {
    if (!renaming || !renameTo.trim()) return
    setBusy(true)
    const res = await fetch(`/api/sheets/${renaming.id}`, {
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

      <div className="mb-3 flex gap-1">
        <button
          type="button"
          className="btn btn-ghost"
          style={tab === 'place' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : {}}
          onClick={() => setTab('place')}
        >
          <MapPin size={15} /> By district &amp; region
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={tab === 'person' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : {}}
          onClick={() => setTab('person')}
        >
          <Users size={15} /> By assigned person
        </button>
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

      {renaming && (
        <div className="card mb-3 flex flex-wrap items-end gap-2 p-3">
          <div>
            <label className="label" htmlFor="rn-name">Rename &ldquo;{renaming.name}&rdquo;</label>
            <input
              id="rn-name"
              className="input w-64"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') rename()
                if (e.key === 'Escape') setRenaming(null)
              }}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={rename} disabled={busy} type="button">
            Save
          </button>
          <button className="btn btn-ghost" onClick={() => setRenaming(null)} type="button">
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="mb-2 text-sm" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}

      <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
        <Layers size={11} className="inline" /> is a view built from the sheets below it &mdash;
        nothing is copied, so it is always current. <Table2 size={11} className="inline" /> is a
        stored sheet you can add rows to and reorder.
      </p>

      {/* ---------------------------------------------- by district & region */}
      {tab === 'place' && (
        <div className="card overflow-hidden">
          <div className="px-3 py-2 text-sm font-semibold" style={{ background: 'var(--surface-2)' }}>
            Primary Target sheet
          </div>
          <Entry
            href={`/sheets/view?list=${PRIMARY}`}
            label="All primary targets"
            hint="every district together"
            count={primaryTotal}
            depth={1}
            virtual
          />
          {primarySheets.map((s) => (
            <Entry
              key={`p-${s.id}`}
              href={`/sheets/${s.id}?list=${PRIMARY}`}
              label={s.name}
              count={s.lists[PRIMARY] ?? 0}
              depth={2}
              onRename={() => {
                setRenaming(s)
                setRenameTo(s.name)
              }}
            />
          ))}
          {primarySheets.length === 0 && (
            <p className="border-t px-6 py-2 text-xs" style={{ color: 'var(--muted)' }}>
              No primary targets yet.
            </p>
          )}

          <div
            className="border-t px-3 py-2 text-sm font-semibold"
            style={{ background: 'var(--surface-2)' }}
          >
            Secondary sheet
          </div>
          <Entry
            href={`/sheets/view?list=${SECONDARY}`}
            label="All secondary schools"
            hint="every district together"
            count={secondaryTotal}
            depth={1}
            virtual
          />
          {secondarySheets.map((s) => (
            <Entry
              key={`s-${s.id}`}
              href={`/sheets/${s.id}?list=${SECONDARY}`}
              label={s.name}
              count={s.lists[SECONDARY] ?? 0}
              depth={2}
              onRename={() => {
                setRenaming(s)
                setRenameTo(s.name)
              }}
            />
          ))}

          {emptySheets.length > 0 && (
            <>
              <div
                className="border-t px-3 py-2 text-sm font-semibold"
                style={{ background: 'var(--surface-2)' }}
              >
                Empty sheets
              </div>
              {emptySheets.map((s) => (
                <Entry
                  key={`e-${s.id}`}
                  href={`/sheets/${s.id}`}
                  label={s.name}
                  count={0}
                  depth={1}
                  onRename={() => {
                    setRenaming(s)
                    setRenameTo(s.name)
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* -------------------------------------------------- by assigned person */}
      {tab === 'person' && (
        <div className="card overflow-hidden">
          {members.map((m) => {
            const primary = m.lists[PRIMARY] ?? 0
            const secondary = m.lists[SECONDARY] ?? 0
            const all = Object.values(m.lists).reduce((t, x) => t + x, 0)
            const open = openMember === m.id
            return (
              <div key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpenMember(open ? null : m.id)}
                  className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronRight
                    size={14}
                    style={{
                      color: 'var(--muted)',
                      transform: open ? 'rotate(90deg)' : undefined,
                      transition: 'transform .12s',
                    }}
                  />
                  <span className="flex-1 font-medium">{m.name}</span>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                    {n(all)}
                  </span>
                </button>

                {open && (
                  <>
                    <Entry
                      href={`/sheets/view?assigned=${m.id}`}
                      label="Combined sheet"
                      hint="everything assigned to them"
                      count={all}
                      depth={2}
                      virtual
                    />
                    <Entry
                      href={`/sheets/view?assigned=${m.id}&list=${PRIMARY}`}
                      label="Primary Target sheet"
                      count={primary}
                      depth={2}
                      virtual
                    />
                    <Entry
                      href={`/sheets/view?assigned=${m.id}&list=${SECONDARY}`}
                      label="Secondary sheet"
                      hint="all districts together"
                      count={secondary}
                      depth={2}
                      virtual
                    />
                    {secondarySheets
                      .filter((s) => (s.lists[SECONDARY] ?? 0) > 0)
                      .map((s) => (
                        <Entry
                          key={`${m.id}-${s.id}`}
                          href={`/sheets/view?assigned=${m.id}&list=${SECONDARY}&district=${encodeURIComponent(s.name)}`}
                          label={s.name}
                          count={0}
                          depth={3}
                          virtual
                        />
                      ))}
                  </>
                )}
              </div>
            )
          })}

          {unassigned > 0 && (
            <Entry
              href="/sheets/view?assigned=none"
              label="Not assigned to anyone"
              count={unassigned}
              depth={0}
              virtual
            />
          )}
        </div>
      )}
    </>
  )
}
