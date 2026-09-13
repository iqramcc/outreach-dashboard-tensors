'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Columns3, Download, Plus, Search, UserPlus, X } from 'lucide-react'
import type { ResolvedColumn } from '@/lib/columns'
import { REGION_LABELS } from '@/lib/regions'
import Legend from '@/components/Legend'
import AddRowDialog from '@/components/AddRowDialog'
import EditableCell from '@/components/EditableCell'

export type Status = { id: string; name: string; hex: string; order: number; isContacted: boolean; isPositive: boolean; isDefault: boolean }
export type UserLite = { id: string; name: string }
export type PersonalTag = { id: string; name: string; hex: string; schoolIds: string[] }

export type Row = {
  id: string
  name: string
  primaryPoc: string | null
  entityType: string
  schoolType: string | null
  financeType: string | null
  studentStrength: string | null
  regionCategory: string
  district: string | null
  state: string | null
  listType: string
  connection: string | null
  pocName: string | null
  pocRole: string | null
  contact: string | null
  email: string | null
  address: string | null
  website: string | null
  registeredStudents: number | null
  remarks: string | null
  nextFollowUpAt: string | null
  status: { id: string; name: string; hex: string } | null
  assignedTo: { id: string; name: string } | null
  contacts: { name: string | null; number: string }[]
  extra: Record<string, string>
  cellColors: Record<string, string>
}

const ENTITY_LABELS: Record<string, string> = {
  SCHOOL: 'School',
  TUITION_CENTRE: 'Tuition centre',
  OTHER: 'Other',
}
/**
 * Pick-or-type vocabularies. The team kept spelling these differently across
 * district sheets; offering the existing wording first keeps them groupable,
 * while still allowing a value nobody thought of.
 */
const SUGGESTIONS: Record<string, readonly string[]> = {
  financeType: [
    'Government',
    'Govt aided',
    'High-class private',
    'Private',
    'Unaided',
    'Other',
  ],
  schoolType: ['CBSE', 'ICSE', 'State', 'Kendriya Vidyalaya', 'International', 'Other'],
  pocRole: ['Principal', 'Vice Principal', 'HM', 'Teacher', 'Office', 'Other'],
}

/**
 * The stored values stay MASS_CALL / CONNECTED; only what the team reads
 * changed, so no migration and no re-import was needed to rename these.
 */
const LIST_LABELS: Record<string, string> = {
  CONNECTED: 'Primary Target sheet',
  MASS_CALL: 'Secondary sheet',
  OFFLINE_OUTREACH: 'Offline outreach',
}

export default function SheetView({
  sheet,
  rows: initialRows,
  columns: initialColumns,
  statuses,
  users,
  districts,
  myColours,
  myTags,
  total,
  page,
  pageSize,
  isAdmin,
}: {
  sheet: { id: string; name: string; description: string | null }
  rows: Row[]
  columns: ResolvedColumn[]
  statuses: Status[]
  users: UserLite[]
  districts: string[]
  /** This viewer's own colour for a status, overriding the shared one. */
  myColours: Record<string, string>
  myTags: PersonalTag[]
  total: number
  page: number
  pageSize: number
  isAdmin: boolean
}) {
  const router = useRouter()
  const params = useSearchParams()

  const [rows, setRows] = useState(initialRows)
  const [columns, setColumns] = useState(initialColumns)

  // useState only reads its argument on the first render. Filtering and paging
  // navigate, so the server sends fresh rows as new props - without this the
  // grid kept showing the first page it ever loaded and searching looked dead.
  // Synced during render rather than in an effect, which avoids a second pass.
  const [syncedRows, setSyncedRows] = useState(initialRows)
  if (syncedRows !== initialRows) {
    setSyncedRows(initialRows)
    setRows(initialRows)
  }

  // Columns resync only when the set of columns actually changes, so a column
  // hidden by hand stays hidden while paging through the sheet.
  const columnSig = initialColumns.map((c) => c.key).join('|')
  const [syncedColumnSig, setSyncedColumnSig] = useState(columnSig)
  if (syncedColumnSig !== columnSig) {
    setSyncedColumnSig(columnSig)
    setColumns(initialColumns)
  }
  const [showCols, setShowCols] = useState(false)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [toast, setToast] = useState<string | null>(null)

  // Row selection, for handing a stretch of the call list to one volunteer.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)

  // Reordering. The serial number shown is just the row's place in the sheet,
  // so moving a row never has to renumber the ones below it.
  const [dragIds, setDragIds] = useState<string[] | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [snDraft, setSnDraft] = useState<{ id: string; value: string } | null>(null)
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const visible = useMemo(() => columns.filter((c) => c.isVisible), [columns])

  /** The shared colour unless this viewer has chosen their own. */
  const colourOf = useCallback(
    (statusId: string | undefined, shared: string | undefined) =>
      (statusId ? myColours[statusId] : undefined) ?? shared,
    [myColours]
  )

  /** Which of the viewer's private marks are on a given row. */
  const tagsOf = useCallback(
    (schoolId: string) => myTags.filter((t) => t.schoolIds.includes(schoolId)),
    [myTags]
  )
  const pages = Math.max(1, Math.ceil(total / pageSize))

  /** Push a filter into the URL so every view is shareable and bookmarkable. */
  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      router.push(`/sheets/${sheet.id}?${next.toString()}`)
    },
    [params, router, sheet.id]
  )

  const activeFilters = ['q', 'district', 'region', 'list', 'status', 'assigned', 'due'].filter(
    (k) => params.get(k)
  )

  async function saveCell(rowId: string, key: string, value: string | number | null) {
    const before = rows
    // Optimistic: the grid should feel like a spreadsheet, not a form.
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== rowId) return r
        if (key === 'status') {
          const s = statuses.find((x) => x.id === value)
          return { ...r, status: s ? { id: s.id, name: s.name, hex: s.hex } : null }
        }
        if (key === 'assignedTo') {
          const u = users.find((x) => x.id === value)
          return { ...r, assignedTo: u ? { id: u.id, name: u.name } : null }
        }
        if (key in r) return { ...r, [key]: value } as Row
        return { ...r, extra: { ...r.extra, [key]: String(value ?? '') } }
      })
    )

    const res = await fetch(`/api/schools/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setRows(before)
      setToast(data.error ?? 'Could not save that change')
      setTimeout(() => setToast(null), 4000)
    }
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllOnPage() {
    setSelected((s) => {
      const next = new Set(s)
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id))
      else rows.forEach((r) => next.add(r.id))
      return next
    })
  }

  /**
   * Assign either the ticked rows or everything matching the current filters.
   * "filter" scope is what makes "give all 277 of Thiruvananthapuram to Amal"
   * one action instead of three pages of ticking.
   */
  async function assignTo(userId: string, scope: 'ids' | 'filter') {
    setAssigning(true)
    const body =
      scope === 'ids'
        ? { scope, ids: [...selected], assignedToId: userId || null }
        : {
            scope,
            assignedToId: userId || null,
            filter: {
              sheetId: sheet.id,
              q: params.get('q'),
              district: params.get('district'),
              region: params.get('region'),
              list: params.get('list'),
              status: params.get('status'),
              assigned: params.get('assigned'),
              due: params.get('due'),
            },
          }
    const res = await fetch('/api/schools/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setAssigning(false)
    if (!res.ok) {
      setToast(data.error ?? 'Could not assign those rows')
      setTimeout(() => setToast(null), 4000)
      return
    }
    const who = userId ? (users.find((u) => u.id === userId)?.name ?? 'someone') : 'nobody'
    setToast(`${data.count} row(s) assigned to ${who}`)
    setTimeout(() => setToast(null), 4000)
    setSelected(new Set())
    router.refresh()
  }

  /**
   * Move rows to a 1-based position in the sheet. One request, one write per
   * moved row - the rows below are not touched.
   */
  async function moveRows(ids: string[], targetPosition: number) {
    const res = await fetch('/api/schools/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId: sheet.id, ids, targetPosition }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setToast(data.error ?? 'Could not move those rows')
      setTimeout(() => setToast(null), 4000)
      return
    }
    router.refresh()
  }

  /** Rows travel as a block when several are ticked and one of them is dragged. */
  function dragPayload(rowId: string): string[] {
    return selected.has(rowId) && selected.size > 1 ? [...selected] : [rowId]
  }

  /** Put one of the viewer's own marks on, or take it off, the ticked rows. */
  async function applyTag(tagId: string, on: boolean) {
    const res = await fetch(`/api/personal/tags/${tagId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolIds: [...selected], on }),
    })
    if (!res.ok) {
      setToast('Could not update your marks')
      setTimeout(() => setToast(null), 4000)
      return
    }
    router.refresh()
  }

  function toggleColumn(key: string) {
    setColumns((cs) => cs.map((c) => (c.key === key ? { ...c, isVisible: !c.isVisible } : c)))
  }

  function cellValue(row: Row, col: ResolvedColumn): string {
    switch (col.key) {
      case 'status':
        return row.status?.name ?? ''
      case 'assignedTo':
        return row.assignedTo?.name ?? ''
      case 'entityType':
        return ENTITY_LABELS[row.entityType] ?? row.entityType
      case 'listType':
        return LIST_LABELS[row.listType] ?? row.listType
      case 'regionCategory':
        return REGION_LABELS[row.regionCategory as keyof typeof REGION_LABELS] ?? row.regionCategory
      case 'contact': {
        // The cell edits the main number; say when there are others.
        const extraCount = row.contacts?.length ?? 0
        if (!row.contact) return extraCount ? `+${extraCount} more` : ''
        return extraCount ? `${row.contact}  +${extraCount}` : row.contact
      }
      case 'nextFollowUpAt':
        return row.nextFollowUpAt ? row.nextFollowUpAt.slice(0, 10) : ''
      default: {
        if (col.isCore) {
          const v = (row as unknown as Record<string, unknown>)[col.key]
          return v === null || v === undefined ? '' : String(v)
        }
        return row.extra?.[col.key] ?? ''
      }
    }
  }

  /**
   * What the editor binds to. Dropdowns must receive the value that is stored
   * ("TUITION_CENTRE"), not the label shown in the cell ("Tuition centre") -
   * otherwise the <select> matches no option, shows the first one, and the
   * Type / List / Region columns look like they refuse to change.
   */
  function rawCellValue(row: Row, col: ResolvedColumn): string {
    switch (col.key) {
      case 'status':
        return row.status?.id ?? ''
      case 'assignedTo':
        return row.assignedTo?.id ?? ''
      case 'entityType':
        return row.entityType
      case 'listType':
        return row.listType
      case 'regionCategory':
        return row.regionCategory
      case 'contact':
        return row.contact ?? ''
      default:
        return cellValue(row, col)
    }
  }

  function optionsFor(col: ResolvedColumn) {
    switch (col.key) {
      case 'status':
        return [
          { value: '', label: '—' },
          ...statuses.map((s) => ({
            value: s.id,
            label: s.name,
            hex: colourOf(s.id, s.hex),
          })),
        ]
      case 'assignedTo':
        return [{ value: '', label: 'Unassigned' }, ...users.map((u) => ({ value: u.id, label: u.name }))]
      case 'entityType':
        return Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }))
      case 'listType':
        return Object.entries(LIST_LABELS).map(([value, label]) => ({ value, label }))
      case 'regionCategory':
        return Object.entries(REGION_LABELS).map(([value, label]) => ({ value, label }))
      default:
        // SELECT_FREE is deliberately not a <select>: it renders as a text box
        // with the options as suggestions, so the team can add a value nobody
        // anticipated without an admin.
        if (col.type === 'SELECT_FREE') return null
        return col.options ? col.options.map((o) => ({ value: o, label: o })) : null
    }
  }

  const exportHref = `/api/export?sheetId=${sheet.id}&${params.toString()}`

  return (
    <main className="mx-auto w-full max-w-[100rem] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{sheet.name}</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {total.toLocaleString('en-IN')} schools
            {activeFilters.length > 0 && ' (filtered)'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a href={exportHref} className="btn btn-ghost">
            <Download size={15} /> <span className="hidden sm:inline">Export</span>
          </a>
          <button className="btn btn-ghost" onClick={() => setShowCols((v) => !v)} type="button">
            <Columns3 size={15} /> <span className="hidden sm:inline">Columns</span>
          </button>
          <button className="btn btn-primary" onClick={() => setAdding(true)} type="button">
            <Plus size={15} /> Add row
          </button>
        </div>
      </div>

      {/* Bulk bar, only while something is ticked. */}
      {selected.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
          style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}
        >
          <UserPlus size={15} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select
            className="input w-auto"
            defaultValue=""
            disabled={assigning}
            onChange={(e) => {
              if (e.target.value === '') return
              const v = e.target.value === 'none' ? '' : e.target.value
              assignTo(v, 'ids')
              e.target.value = ''
            }}
            aria-label="Assign selected rows to"
          >
            <option value="">Assign selected to...</option>
            <option value="none">Nobody (unassign)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            className="input w-auto"
            defaultValue=""
            disabled={assigning}
            onChange={(e) => {
              if (e.target.value === '') return
              const v = e.target.value === 'none' ? '' : e.target.value
              const label = v ? (users.find((u) => u.id === v)?.name ?? 'them') : 'nobody'
              if (
                confirm(
                  `Assign all ${total.toLocaleString('en-IN')} rows matching the current filters to ${label}?`
                )
              ) {
                assignTo(v, 'filter')
              }
              e.target.value = ''
            }}
            aria-label="Assign the whole filtered list to"
          >
            <option value="">Assign all {total.toLocaleString('en-IN')} matching to...</option>
            <option value="none">Nobody (unassign)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {myTags.length > 0 && (
            <select
              className="input w-auto"
              defaultValue=""
              onChange={(e) => {
                const [tagId, mode] = e.target.value.split(':')
                if (!tagId) return
                applyTag(tagId, mode === 'on')
                e.target.value = ''
              }}
              aria-label="Mark selected rows"
            >
              <option value="">My marks...</option>
              {myTags.map((t) => (
                <option key={t.id} value={`${t.id}:on`}>Mark as {t.name}</option>
              ))}
              {myTags.map((t) => (
                <option key={`off-${t.id}`} value={`${t.id}:off`}>
                  Remove {t.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="btn btn-ghost py-1 text-xs"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {selected.size === 0 && (
        <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
          Drag a row by its number to reorder it, or type a number to send it there.
          Tick several rows to move them together.
        </p>
      )}

      <Legend
        statuses={statuses}
        isAdmin={isAdmin}
        activeId={params.get('status')}
        onFilter={(id) => setParam('status', id)}
        myColours={myColours}
        myTags={myTags}
      />

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            setParam('q', search)
          }}
          role="search"
        >
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--muted)' }}
              aria-hidden
            />
            <input
              className="input w-56 pl-8"
              placeholder={`Search in ${sheet.name}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={`Search within ${sheet.name}`}
              type="search"
            />
            {search && (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5"
                onClick={() => {
                  setSearch('')
                  setParam('q', '')
                }}
                aria-label="Clear search"
              >
                <X size={13} style={{ color: 'var(--muted)' }} />
              </button>
            )}
          </div>
          <button type="submit" className="btn btn-ghost px-2" aria-label="Search">
            <Search size={15} />
          </button>
        </form>

        <select className="input w-auto" value={params.get('district') ?? ''} onChange={(e) => setParam('district', e.target.value)}>
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select className="input w-auto" value={params.get('list') ?? ''} onChange={(e) => setParam('list', e.target.value)}>
          <option value="">All lists</option>
          {Object.entries(LIST_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select className="input w-auto" value={params.get('assigned') ?? ''} onChange={(e) => setParam('assigned', e.target.value)}>
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-ghost"
          style={params.get('due') === '1' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : {}}
          onClick={() => setParam('due', params.get('due') === '1' ? '' : '1')}
        >
          Follow-ups due
        </button>

        {activeFilters.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { setSearch(''); router.push(`/sheets/${sheet.id}`) }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {showCols && (
        <div className="card mb-3 p-3">
          <p className="label">Show columns</p>
          <div className="flex flex-wrap gap-2">
            {columns.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleColumn(c.key)}
                className="rounded-md border px-2 py-1 text-xs"
                style={
                  c.isVisible
                    ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' }
                    : { color: 'var(--muted)' }
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The grid */}
      <div className="card thin-scroll overflow-auto" style={{ maxHeight: 'calc(100vh - 19rem)' }}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: 'var(--surface-2)' }}>
              <th
                className="sticky left-0 z-20 w-16 border-b border-r px-2 py-2 text-xs font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
              >
                <span className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select every row on this page"
                  />
                  #
                </span>
              </th>
              {visible.map((c) => (
                <th
                  key={c.key}
                  className="border-b border-r px-2 py-2 text-left text-xs font-medium whitespace-nowrap"
                  style={{ color: 'var(--muted)', minWidth: c.width ?? 140 }}
                >
                  {c.label}
                </th>
              ))}
              <th className="border-b px-2 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                Open
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className="group"
                draggable
                onDragStart={(e) => {
                  const ids = dragPayload(row.id)
                  setDragIds(ids)
                  e.dataTransfer.effectAllowed = 'move'
                  // Firefox needs something in the payload to start a drag.
                  e.dataTransfer.setData('text/plain', ids.join(','))
                }}
                onDragOver={(e) => {
                  if (!dragIds) return
                  e.preventDefault()
                  setDropIndex(i)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (!dragIds) return
                  // Target counts within the whole sheet, not just this page.
                  moveRows(dragIds, (page - 1) * pageSize + i + 1)
                  setDragIds(null)
                  setDropIndex(null)
                }}
                onDragEnd={() => {
                  setDragIds(null)
                  setDropIndex(null)
                }}
                style={{
                  background: 'transparent',
                  boxShadow:
                    dropIndex === i && dragIds
                      ? 'inset 0 2px 0 var(--accent)'
                      : undefined,
                  opacity: dragIds?.includes(row.id) ? 0.4 : 1,
                }}
              >
                <td
                  className="sticky left-0 z-10 border-b border-r px-2 py-1 text-xs tabular-nums"
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--muted)',
                    // The row's status colour reads as a spine down the left edge.
                    boxShadow: row.status
                      ? `inset 3px 0 0 ${colourOf(row.status.id, row.status.hex)}`
                      : undefined,
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`Select ${row.name}`}
                    />
                    {/* Type a number to send the row there; everything below
                        shifts down on its own, since these are not stored. */}
                    <input
                      className="w-10 rounded border-0 bg-transparent px-0.5 py-0 text-right text-xs tabular-nums"
                      style={{ color: 'var(--muted)' }}
                      value={
                        snDraft?.id === row.id
                          ? snDraft.value
                          : String((page - 1) * pageSize + i + 1)
                      }
                      onChange={(e) => setSnDraft({ id: row.id, value: e.target.value })}
                      onBlur={() => {
                        if (snDraft?.id !== row.id) return
                        const n = Number(snDraft.value)
                        setSnDraft(null)
                        if (Number.isInteger(n) && n >= 1 && n !== (page - 1) * pageSize + i + 1) {
                          moveRows([row.id], n)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setSnDraft(null)
                      }}
                      aria-label={`Position of ${row.name}`}
                    />
                    {/* This viewer's private marks, invisible to everyone else. */}
                    {tagsOf(row.id).map((t) => (
                      <span
                        key={t.id}
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: t.hex }}
                        title={t.name}
                      />
                    ))}
                  </span>
                </td>
                {visible.map((c) => (
                  <EditableCell
                    key={c.key}
                    rowId={row.id}
                    column={c}
                    display={cellValue(row, c)}
                    rawValue={rawCellValue(row, c)}
                    suggestions={SUGGESTIONS[c.key] ?? c.options ?? null}
                    color={
                      c.key === 'status'
                        ? (colourOf(row.status?.id, row.status?.hex) ?? null)
                        : (row.cellColors?.[c.key] ?? null)
                    }
                    options={optionsFor(c)}
                    onSave={(v) => saveCell(row.id, c.key, v)}
                  />
                ))}
                <td className="border-b px-2 py-1 text-center">
                  <Link href={`/schools/${row.id}`} className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visible.length + 2} className="px-4 py-10 text-center" style={{ color: 'var(--muted)' }}>
                  No rows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} type="button">
            Previous
          </button>
          <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
            Page {page} of {pages}
          </span>
          <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))} type="button">
            Next
          </button>
        </div>
      )}

      {adding && (
        <AddRowDialog
          sheetId={sheet.id}
          sheetName={sheet.name}
          statuses={statuses}
          districts={districts}
          customColumns={columns.filter((c) => !c.isCore)}
          existingCount={total}
          onClose={() => setAdding(false)}
          onCreated={() => router.refresh()}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-3 py-2 text-sm shadow-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--danger)', color: 'var(--danger)' }}
          role="alert"
        >
          {toast}
        </div>
      )}
    </main>
  )
}
