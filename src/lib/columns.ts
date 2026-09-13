import type { ColumnDef, ColumnType } from '@prisma/client'

/**
 * The core columns. These map onto real School fields (indexed, filterable,
 * and what the dashboard aggregates on). Everything else a team adds - or an
 * Excel file brings in - becomes a custom column stored in School.extra.
 *
 * Admins can relabel, reorder and hide these, but not delete them, because the
 * dashboard's district and funnel maths depends on them existing.
 */
export type CoreColumn = {
  key: string
  label: string
  type: ColumnType
  /** Width hint in px for first render. */
  width?: number
}

export const CORE_COLUMNS: CoreColumn[] = [
  { key: 'name', label: 'School / Institution', type: 'TEXT', width: 260 },
  { key: 'primaryPoc', label: 'Primary POC', type: 'TEXT', width: 130 },
  { key: 'entityType', label: 'Type', type: 'SELECT', width: 150 },
  { key: 'financeType', label: 'Finance Type', type: 'TEXT', width: 130 },
  { key: 'schoolType', label: 'Board', type: 'TEXT', width: 110 },
  { key: 'strength8', label: 'Class 8', type: 'NUMBER', width: 90 },
  { key: 'strength9', label: 'Class 9', type: 'NUMBER', width: 90 },
  { key: 'strength10', label: 'Class 10', type: 'NUMBER', width: 90 },
  { key: 'strengthTotal', label: 'Total Strength', type: 'NUMBER', width: 120 },
  { key: 'studentStrength', label: 'Strength (as in sheet)', type: 'TEXT', width: 150 },
  { key: 'regionCategory', label: 'Region', type: 'SELECT', width: 130 },
  { key: 'district', label: 'District', type: 'TEXT', width: 150 },
  { key: 'state', label: 'State', type: 'TEXT', width: 120 },
  { key: 'listType', label: 'List', type: 'SELECT', width: 150 },
  { key: 'connection', label: 'Connection', type: 'TEXT', width: 180 },
  { key: 'pocName', label: 'POC from School', type: 'TEXT', width: 170 },
  { key: 'pocRole', label: 'POC Role', type: 'TEXT', width: 130 },
  { key: 'contact', label: 'Contact', type: 'PHONE', width: 150 },
  { key: 'email', label: 'Mail', type: 'EMAIL', width: 200 },
  { key: 'address', label: 'Address', type: 'LONGTEXT', width: 220 },
  { key: 'website', label: 'Website', type: 'TEXT', width: 180 },
  { key: 'status', label: 'Status', type: 'SELECT', width: 160 },
  { key: 'assignedTo', label: 'Assigned To', type: 'SELECT', width: 150 },
  { key: 'nextFollowUpAt', label: 'Follow Up', type: 'DATE', width: 130 },
  { key: 'registeredStudents', label: 'Registered', type: 'NUMBER', width: 110 },
  { key: 'remarks', label: 'Remarks', type: 'LONGTEXT', width: 260 },
]

export const CORE_KEYS = new Set(CORE_COLUMNS.map((c) => c.key))

export function isCoreKey(key: string): boolean {
  return CORE_KEYS.has(key)
}

/**
 * Custom column keys have to survive being a JSON object key and a form field
 * name, so normalise to snake_case ascii.
 */
export function toColumnKey(label: string): string {
  const base = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const key = base || 'column'
  // Never let a custom column shadow a core field.
  return isCoreKey(key) ? `${key}_custom` : key
}

export type ResolvedColumn = {
  id: string | null
  key: string
  label: string
  type: ColumnType
  isCore: boolean
  isVisible: boolean
  order: number
  width: number | null
  options: string[] | null
}

/**
 * Merge the DB column definitions with per-user visibility prefs into the one
 * list the table renders from. Core columns missing a DB row still show up, so
 * the sheet works before an admin has touched anything.
 */
export function resolveColumns(
  defs: ColumnDef[],
  prefs: { columnDefId: string; isVisible: boolean; order: number | null }[] = []
): ResolvedColumn[] {
  const prefBy = new Map(prefs.map((p) => [p.columnDefId, p]))
  const byKey = new Map(defs.map((d) => [d.key, d]))

  const resolved: ResolvedColumn[] = []

  CORE_COLUMNS.forEach((core, i) => {
    const def = byKey.get(core.key)
    const pref = def ? prefBy.get(def.id) : undefined
    resolved.push({
      id: def?.id ?? null,
      key: core.key,
      label: def?.label ?? core.label,
      type: def?.type ?? core.type,
      isCore: true,
      isVisible: pref?.isVisible ?? def?.isVisible ?? true,
      order: pref?.order ?? def?.order ?? i,
      width: def?.width ?? core.width ?? null,
      options: (def?.options as string[] | null) ?? null,
    })
  })

  defs
    .filter((d) => !d.isCore && !isCoreKey(d.key))
    .forEach((def) => {
      const pref = prefBy.get(def.id)
      resolved.push({
        id: def.id,
        key: def.key,
        label: def.label,
        type: def.type,
        isCore: false,
        isVisible: pref?.isVisible ?? def.isVisible,
        order: pref?.order ?? def.order,
        width: def.width,
        options: (def.options as string[] | null) ?? null,
      })
    })

  return resolved.sort((a, b) => a.order - b.order)
}

/**
 * Shown by default. The rest (address, website, state, board, POC role) stay
 * available but hidden, so a fresh sheet is readable instead of 22 columns wide.
 */
export const DEFAULT_VISIBLE = new Set([
  'name', 'primaryPoc', 'entityType', 'financeType', 'strengthTotal',
  'district', 'listType', 'connection', 'pocName', 'contact', 'email',
  'status', 'assignedTo', 'nextFollowUpAt', 'registeredStudents', 'remarks',
])

/** Columns a duplicate check may match on, in the order the UI offers them. */
export const DEDUPE_COLUMNS = [
  { key: 'name', label: 'School name' },
  { key: 'district', label: 'District' },
  { key: 'contact', label: 'Contact number' },
  { key: 'email', label: 'Mail' },
  { key: 'state', label: 'State' },
] as const

export type DedupeKey = (typeof DEDUPE_COLUMNS)[number]['key']

/** Their rule: same name in a different district is a different school. */
export const DEFAULT_DEDUPE_KEYS: DedupeKey[] = ['name', 'district']

/**
 * Column names nobody may create.
 *
 * Mail and message lists carry their own per-entry comment, and a school
 * column called "comment" would sit beside it meaning something different -
 * one attached to the school forever, one to a single send. Reserving the
 * name keeps the distinction obvious.
 */
export const RESERVED_COLUMN_KEYS = new Set(['comment', 'comments'])

export function isReservedColumnName(label: string): boolean {
  return RESERVED_COLUMN_KEYS.has(toColumnKey(label).replace(/_custom$/, ''))
}
