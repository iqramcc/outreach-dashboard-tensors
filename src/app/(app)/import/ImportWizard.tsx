'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Undo2, Upload } from 'lucide-react'
import { CORE_COLUMNS, DEDUPE_COLUMNS, type DedupeKey } from '@/lib/columns'
import { districtsFor, REGION_LABELS } from '@/lib/regions'

/** One template drives both the label row and every tab row, so they align. */
const TAB_GRID =
  'minmax(10rem,1.3fr) minmax(9rem,1.1fr) minmax(8rem,0.9fr) minmax(9rem,1.1fr) auto'

const LIST_TYPES: [string, string][] = [
  ['MASS_CALL', 'Mass call list'],
  ['CONNECTED', 'Connected school'],
  ['OFFLINE_OUTREACH', 'Offline outreach'],
]

const IGNORE = '__ignore__'
const NEW_COLUMN = '__new__'

type Suggestion = { header: string; target: string; confident: boolean }

type Tab = {
  name: string
  headerRow: number
  headers: string[]
  rowCount: number
  skippedEmpty: number
  sample: Record<string, string>[]
  guess: { district: string | null; regionCategory: string }
  mapping: Suggestion[]
}

type Analysis = {
  filename: string
  tabs: Tab[]
  existingSheets: { id: string; name: string }[]
  totalRows: number
}

type PlanRow = {
  tabName: string
  include: boolean
  sheetName: string
  sheetId: string | null
  regionCategory: string
  district: string | null
  listType: string
  mapping: Record<string, string>
}

type Batch = {
  id: string
  filename: string
  mode: string
  rowsCreated: number
  rowsUpdated: number
  rowsSkipped: number
  isUndone: boolean
  by: string
  at: string
}

export default function ImportWizard({ recent }: { recent: Batch[] }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [mode, setMode] = useState<'TAB_PER_SHEET' | 'MERGE_ALL'>('TAB_PER_SHEET')
  const [mergeSheetName, setMergeSheetName] = useState('All Kerala')
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [openTab, setOpenTab] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; batchId: string } | null>(null)

  const [dedupeOn, setDedupeOn] = useState(true)
  const [scope, setScope] = useState<'SHEET' | 'DATABASE'>('DATABASE')
  const [keys, setKeys] = useState<DedupeKey[]>(['name', 'district'])
  const [action, setAction] = useState<'SKIP' | 'UPDATE' | 'IMPORT_ANYWAY'>('SKIP')

  async function analyze(f: File) {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/import/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not read that file')
        return
      }
      setAnalysis(data)
      setPlans(
        data.tabs.map((t: Tab) => ({
          tabName: t.name,
          include: t.rowCount > 0,
          sheetName: t.guess.district ?? t.name,
          sheetId: null,
          regionCategory: t.guess.regionCategory,
          district: t.guess.district,
          listType: 'MASS_CALL',
          mapping: Object.fromEntries(t.mapping.map((m) => [m.header, m.target])),
        }))
      )
    } catch {
      setError('Upload failed')
    } finally {
      setBusy(false)
    }
  }

  function updatePlan(tabName: string, patch: Partial<PlanRow>) {
    setPlans((ps) =>
      ps.map((p) => {
        if (p.tabName !== tabName) return p
        const next = { ...p, ...patch }
        // The sheet takes its name from the district, which is why the district
        // is only asked for once. Falls back to the tab's own name.
        if ('district' in patch) next.sheetName = next.district || p.tabName
        return next
      })
    )
  }

  async function runImport() {
    if (!file || !analysis) return
    setBusy(true)
    setError(null)
    try {
      const finalPlans = plans.map((p) => ({
        ...p,
        sheetName: mode === 'MERGE_ALL' ? mergeSheetName : p.sheetName,
      }))
      const fd = new FormData()
      fd.append('file', file)
      fd.append(
        'plan',
        JSON.stringify({
          mode,
          plans: finalPlans,
          dedupe: { enabled: dedupeOn, scope, keys, action },
        })
      )
      const res = await fetch('/api/import/run', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Import failed')
        return
      }
      setResult(data)
      setAnalysis(null)
      setFile(null)
      router.refresh()
    } catch {
      setError('Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function undo(batchId: string) {
    if (!confirm('Delete every row this import created? This cannot be undone.')) return
    setBusy(true)
    await fetch(`/api/import/${batchId}/undo`, { method: 'POST' })
    setBusy(false)
    router.refresh()
  }

  const selected = plans.filter((p) => p.include)
  const totalSelected = analysis
    ? analysis.tabs.filter((t) => selected.some((p) => p.tabName === t.name)).reduce((n, t) => n + t.rowCount, 0)
    : 0

  return (
    <main className="mx-auto w-full max-w-5xl p-3 sm:p-5">
      <h1 className="mb-1 text-lg font-semibold">Import from Excel</h1>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        Upload a workbook with one tab per district, or a single sheet. Nothing is saved until you confirm.
      </p>

      {result && (
        <div className="card mb-4 flex items-start gap-3 p-4" style={{ borderColor: 'var(--accent)' }}>
          <CheckCircle2 size={18} style={{ color: 'var(--accent)' }} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Import finished</p>
            <p style={{ color: 'var(--muted)' }}>
              {result.created.toLocaleString('en-IN')} added
              {result.updated > 0 && `, ${result.updated} updated`}
              {result.skipped > 0 && `, ${result.skipped.toLocaleString('en-IN')} skipped as duplicates`}.
            </p>
            <button className="btn btn-ghost mt-2 py-1 text-xs" onClick={() => undo(result.batchId)} type="button">
              <Undo2 size={13} /> Undo this import
            </button>
          </div>
        </div>
      )}

      {/* Step 1 - file */}
      {!analysis && (
        <div className="card p-5">
          <label
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center"
            style={{ borderColor: 'var(--border)' }}
          >
            <Upload size={22} style={{ color: 'var(--muted)' }} />
            <span className="text-sm font-medium">
              {busy ? 'Reading workbook...' : 'Choose an .xlsx, .xls or .csv file'}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Every tab is detected separately, with its own columns
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setFile(f)
                  analyze(f)
                }
              }}
            />
          </label>
        </div>
      )}

      {error && (
        <div className="card mt-3 flex items-start gap-2 p-3 text-sm" style={{ borderColor: 'var(--danger)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--danger)' }} className="mt-0.5 shrink-0" />
          <span style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}

      {/* Steps 2-4 */}
      {analysis && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileSpreadsheet size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium">{analysis.filename}</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {analysis.tabs.length} tabs, {analysis.totalRows.toLocaleString('en-IN')} rows
              </span>
              <button
                className="btn btn-ghost ml-auto py-1 text-xs"
                onClick={() => { setAnalysis(null); setFile(null) }}
                type="button"
              >
                Change file
              </button>
            </div>

            <p className="label">How should the tabs be organised?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('TAB_PER_SHEET')}
                className="rounded-lg border p-3 text-left text-sm"
                style={mode === 'TAB_PER_SHEET' ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : {}}
              >
                <span className="font-medium">One sheet per tab</span>
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--muted)' }}>
                  Each tab becomes its own sheet, with its district filled in from the tab name.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode('MERGE_ALL')}
                className="rounded-lg border p-3 text-left text-sm"
                style={mode === 'MERGE_ALL' ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : {}}
              >
                <span className="font-medium">Merge all tabs into one sheet</span>
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--muted)' }}>
                  One combined list with a District column - for when you want all of Kerala together.
                </span>
              </button>
            </div>

            {mode === 'MERGE_ALL' && (
              <div className="mt-3">
                <label className="label" htmlFor="merge-name">Name of the combined sheet</label>
                <input id="merge-name" className="input max-w-xs" value={mergeSheetName} onChange={(e) => setMergeSheetName(e.target.value)} />
              </div>
            )}
          </div>

          {/* Duplicate checking */}
          <div className="card p-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={dedupeOn} onChange={(e) => setDedupeOn(e.target.checked)} />
              <span className="text-sm font-medium">Check for duplicates</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>(optional)</span>
            </label>

            {dedupeOn && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div>
                  <p className="label">Treat rows as the same school when ALL of these match</p>
                  <div className="flex flex-wrap gap-2">
                    {DEDUPE_COLUMNS.map((c) => {
                      const on = keys.includes(c.key)
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() =>
                            setKeys((ks) => (on ? ks.filter((k) => k !== c.key) : [...ks, c.key]))
                          }
                          className="rounded-md border px-2.5 py-1 text-xs"
                          style={on ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' } : { color: 'var(--muted)' }}
                        >
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                    Name + District is the safe default: the same school name in a different district is a different school.
                  </p>
                  {keys.length === 0 && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
                      Pick at least one column, or turn duplicate checking off.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="dd-scope">Where to look</label>
                    <select id="dd-scope" className="input" value={scope} onChange={(e) => setScope(e.target.value as 'SHEET' | 'DATABASE')}>
                      <option value="DATABASE">Across the whole database</option>
                      <option value="SHEET">Only within the target sheet</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="dd-action">When a duplicate is found</label>
                    <select id="dd-action" className="input" value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
                      <option value="SKIP">Skip the incoming row</option>
                      <option value="UPDATE">Fill in blanks on the existing row</option>
                      <option value="IMPORT_ANYWAY">Import it anyway</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Per-tab plan */}
          <div className="card overflow-hidden">
            <div className="border-b px-4 py-2.5">
              <p className="text-sm font-medium">Tabs to import</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Each tab has its own columns, so check the mapping where it matters.
                In this mode each tab becomes its own sheet, named after its district.
              </p>
            </div>

            <div
              className="hidden border-b px-4 py-1.5 text-xs sm:grid sm:gap-2"
              style={{
                gridTemplateColumns: TAB_GRID,
                color: 'var(--muted)',
                borderColor: 'var(--border)',
                background: 'var(--surface-2)',
              }}
            >
              <span>Tab</span>
              <span>District</span>
              <span>Region</span>
              <span>List type</span>
              <span>Columns</span>
            </div>

            {analysis.tabs.map((tab) => {
              const plan = plans.find((p) => p.tabName === tab.name)
              if (!plan) return null
              const isOpen = openTab === tab.name
              const unmapped = Object.values(plan.mapping).filter((t) => t === NEW_COLUMN).length

              return (
                <div key={tab.name} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <div
                    className="px-4 py-2 sm:grid sm:items-center sm:gap-2"
                    style={{ gridTemplateColumns: TAB_GRID }}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={plan.include}
                        disabled={tab.rowCount === 0}
                        onChange={(e) => updatePlan(tab.name, { include: e.target.checked })}
                        aria-label={`Import the ${tab.name} tab`}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{tab.name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {tab.rowCount.toLocaleString('en-IN')} rows
                          {tab.rowCount === 0 && ' — empty'}
                          {tab.headerRow > 1 && ` · header row ${tab.headerRow}`}
                        </p>
                      </div>
                    </div>

                    {tab.rowCount > 0 ? (
                      <>
                        <div className="mt-2 sm:mt-0">
                          <span className="label sm:hidden">District</span>
                          {/* Type a district or pick one - the list is only a
                              suggestion, so an unexpected place name still works. */}
                          <input
                            className="input"
                            list={`districts-${tab.name}`}
                            placeholder="District"
                            value={plan.district ?? ''}
                            onChange={(e) =>
                              updatePlan(tab.name, { district: e.target.value || null })
                            }
                            aria-label={`District for ${tab.name}`}
                          />
                          <datalist id={`districts-${tab.name}`}>
                            {districtsFor(
                              plan.regionCategory as Parameters<typeof districtsFor>[0]
                            ).map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </div>

                        <div className="mt-2 sm:mt-0">
                          <span className="label sm:hidden">Region</span>
                          <select
                            className="input"
                            value={plan.regionCategory}
                            onChange={(e) =>
                              updatePlan(tab.name, { regionCategory: e.target.value })
                            }
                            aria-label={`Region for ${tab.name}`}
                          >
                            {Object.entries(REGION_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-2 sm:mt-0">
                          <span className="label sm:hidden">List type</span>
                          <select
                            className="input"
                            value={plan.listType}
                            onChange={(e) => updatePlan(tab.name, { listType: e.target.value })}
                            aria-label={`List type for ${tab.name}`}
                          >
                            {LIST_TYPES.map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-2 flex items-center gap-2 sm:mt-0">
                          <button
                            type="button"
                            className="btn btn-ghost py-1 text-xs"
                            onClick={() => setOpenTab(isOpen ? null : tab.name)}
                          >
                            {isOpen ? 'Hide' : 'Columns'}
                            {unmapped > 0 && ` (${unmapped} new)`}
                          </button>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs sm:col-span-4" style={{ color: 'var(--muted)' }}>
                        Nothing to import from this tab.
                      </span>
                    )}
                  </div>
                  {mode === 'TAB_PER_SHEET' && plan.include && tab.rowCount > 0 && (
                    <p className="px-4 pb-2 text-xs" style={{ color: 'var(--muted)' }}>
                      Creates the sheet <strong>{plan.sheetName}</strong>
                    </p>
                  )}

                  {isOpen && (
                    <div className="px-4 pb-3" style={{ background: 'var(--surface-2)' }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ color: 'var(--muted)' }}>
                            <th className="py-1.5 text-left font-medium">Column in the file</th>
                            <th className="py-1.5 text-left font-medium">Import as</th>
                            <th className="py-1.5 text-left font-medium">First value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tab.headers.map((h) => (
                            <tr key={h}>
                              <td className="py-1 pr-3">{h}</td>
                              <td className="py-1 pr-3">
                                <select
                                  className="input py-1 text-xs"
                                  value={plan.mapping[h] ?? IGNORE}
                                  onChange={(e) =>
                                    updatePlan(tab.name, {
                                      mapping: { ...plan.mapping, [h]: e.target.value },
                                    })
                                  }
                                >
                                  <option value={IGNORE}>— Don&apos;t import —</option>
                                  <option value={NEW_COLUMN}>+ New custom column</option>
                                  {CORE_COLUMNS.map((c) => (
                                    <option key={c.key} value={c.key}>{c.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1 truncate" style={{ color: 'var(--muted)', maxWidth: '18rem' }}>
                                {tab.sample[0]?.[h] ?? ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="btn btn-primary"
              onClick={runImport}
              disabled={busy || selected.length === 0 || (dedupeOn && keys.length === 0)}
              type="button"
            >
              {busy ? 'Importing...' : `Import ${totalSelected.toLocaleString('en-IN')} rows`}
            </button>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {selected.length} of {analysis.tabs.length} tabs selected
            </span>
          </div>
        </div>
      )}

      {/* History */}
      {recent.length > 0 && !analysis && (
        <section className="card mt-5 overflow-hidden">
          <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Recent imports</h2>
          {recent.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm last:border-0" style={{ borderColor: 'var(--border)' }}>
              <div className="min-w-0">
                <p className="truncate font-medium">{b.filename}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {b.by} · {new Date(b.at).toLocaleString('en-IN')} ·{' '}
                  {b.rowsCreated.toLocaleString('en-IN')} added, {b.rowsSkipped.toLocaleString('en-IN')} skipped
                </p>
              </div>
              {b.isUndone ? (
                <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>Undone</span>
              ) : (
                <button className="btn btn-ghost ml-auto py-1 text-xs" onClick={() => undo(b.id)} disabled={busy} type="button">
                  <Undo2 size={13} /> Undo
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
