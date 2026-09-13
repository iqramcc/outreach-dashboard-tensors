import { CORE_COLUMNS } from '../columns'

/**
 * Guesses which core field each spreadsheet column is. Every pattern below was
 * taken from a header that actually appears in the team's workbooks - "Adress"
 * and "Phone no." are their spellings, not typos to fix.
 *
 * The guess is only ever a default: the import wizard shows it and the user
 * can change any of it before anything is written.
 */

export const IGNORE = '__ignore__'
export const NEW_COLUMN = '__new__'

type Rule = { field: string; patterns: RegExp[] }

const RULES: Rule[] = [
  {
    field: 'name',
    patterns: [
      /^school\s*name$/i,
      /^institute\s*name$/i,
      /^name$/i,
      /^school$/i,
      /^institution/i,
      /school.*name/i,
    ],
  },
  {
    field: 'financeType',
    patterns: [/^financ(e|ial)\s*type$/i, /finance/i, /^management$/i],
  },
  {
    field: 'studentStrength',
    patterns: [
      /^hs$/i,
      /^hs\s*strength$/i,
      /student.*strength/i,
      /strength.*hs/i,
      /no\.?\s*of\s*students/i,
      /^students?\s*strength$/i,
      /students?\s*in\s*8/i,
      /^strength$/i,
    ],
  },
  {
    field: 'contact',
    patterns: [
      /^school\s*phone$/i,
      /^phone\s*(number|no\.?)?$/i,
      /^mobile\s*(number|no\.?)?$/i,
      /^contact\s*(number|no\.?)?$/i,
      /phone/i,
      /mobile/i,
      /^contact$/i,
    ],
  },
  {
    field: 'email',
    patterns: [/^e-?mail(\s*id)?$/i, /^mail$/i, /mail/i],
  },
  {
    field: 'address',
    patterns: [/^ad+ress$/i, /^location$/i, /address/i, /location\s*map/i],
  },
  { field: 'website', patterns: [/^web\s*site$/i, /website/i, /^url$/i] },
  { field: 'district', patterns: [/^district$/i, /district/i] },
  { field: 'state', patterns: [/^state$/i] },
  {
    field: 'primaryPoc',
    patterns: [/^primary\s*poc/i, /person\s*who\s*is\s*filling/i, /owner/i],
  },
  {
    field: 'entityType',
    patterns: [/school\s*\/\s*tuition/i, /tuition\s*cent/i, /^type$/i],
  },
  { field: 'schoolType', patterns: [/^board$/i, /syllabus/i] },
  { field: 'connection', patterns: [/^connection$/i, /connection/i] },
  {
    field: 'pocName',
    patterns: [/poc\s*from\s*the\s*school/i, /poc\s*from/i, /contact\s*person/i, /principal/i],
  },
  { field: 'pocRole', patterns: [/poc\s*role/i, /designation/i] },
  { field: 'remarks', patterns: [/^remarks?$/i, /^notes?$/i, /^comment/i, /remark/i] },
  { field: 'registeredStudents', patterns: [/registered/i, /^registrations?$/i] },
]

/** Serial numbers, blank placeholder columns - nothing worth importing. */
const IGNORE_PATTERNS: RegExp[] = [
  /^sl\s*\.?\s*no\.?$/i,
  /^s\s*\.?\s*no\.?$/i,
  /^#$/,
  /^sr\.?\s*no\.?$/i,
  /^serial/i,
  /^column\s*\d+$/i,
  /^unnamed/i,
]

export type Suggestion = {
  header: string
  /** A core field key, IGNORE, or NEW_COLUMN. */
  target: string
  /** True when we matched a rule rather than falling back. */
  confident: boolean
}

const CORE_KEYS = new Set(CORE_COLUMNS.map((c) => c.key))

/**
 * Suggest a target for every header in one tab.
 *
 * Mapping is per tab, not per file, because every tab in their workbook has a
 * different layout - TVM is 4 columns, TCH is 7, KTM has a serial number and a
 * location map.
 *
 * A core field is claimed at most once per tab; a second column matching the
 * same field becomes a custom column rather than silently overwriting the
 * first (their TCH tab has both Email and Website holding email addresses).
 */
export function suggestMapping(headers: string[]): Suggestion[] {
  const taken = new Set<string>()
  const out: Suggestion[] = []

  for (const header of headers) {
    const h = header.trim()

    if (!h || IGNORE_PATTERNS.some((p) => p.test(h))) {
      out.push({ header, target: IGNORE, confident: true })
      continue
    }

    let matched: string | null = null
    for (const rule of RULES) {
      if (taken.has(rule.field)) continue
      if (rule.patterns.some((p) => p.test(h))) {
        matched = rule.field
        break
      }
    }

    if (matched && CORE_KEYS.has(matched)) {
      taken.add(matched)
      out.push({ header, target: matched, confident: true })
    } else {
      // Unrecognised but real - keep it as a custom column so no data is lost.
      out.push({ header, target: NEW_COLUMN, confident: false })
    }
  }

  return out
}
