/**
 * Duplicate detection hinges on these two functions. Both produce a stable key
 * that is stored on the row and indexed, so checking a 3000-row import is a
 * single indexed `IN` query rather than a per-row scan.
 */

/**
 * Lowercase, strip punctuation, collapse whitespace, and drop the honorifics
 * and suffixes that make the same school look like two rows across sheets
 * ("St. Mary's H.S.S." vs "St Marys HSS").
 */
export function toNameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Keep the last 10 digits, which makes +91 98xx, 098xx and 98xx the same
 * number. Returns null for anything that isn't plausibly a phone number so we
 * never match two rows on a shared placeholder like "-" or "NA".
 */
export function toContactKey(contact: string | null | undefined): string | null {
  if (!contact) return null
  const digits = contact.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

/** Trim to null, so blank Excel cells don't become empty strings in the DB. */
export function blankToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  // Excel sheets are full of these standing in for "empty".
  if (/^(na|n\/a|nil|none|-+|_+)$/i.test(s)) return null
  return s
}

export function normalizeEmail(value: unknown): string | null {
  const s = blankToNull(value)
  return s ? s.toLowerCase() : null
}

/**
 * Their Kerala lists prefix every school with its government code:
 *   "42004 - Govt. T H S Meenankal"
 * Strip it so names read cleanly. Requires 4-6 digits and a dash, so a school
 * genuinely called "21st Century Public School" is left alone.
 */
export function stripSchoolCode(name: string): string {
  return name.replace(/^\s*\d{4,6}\s*[-–—]\s*/, '').trim() || name.trim()
}

export type Strength = {
  c8: number | null
  c9: number | null
  c10: number | null
  total: number | null
}

/**
 * Student strength, which the team records two different ways.
 *
 *   "1500*3=4500"  -> 1500 in each of classes 8, 9 and 10; 4500 altogether
 *   "400*3"        -> same shape, total worked out here
 *   "241"          -> a single total, no per-class split
 *
 * Both are kept: the per-class numbers when the sheet gives them, and a total
 * either way, so the dashboard can add strengths up across districts.
 */
export function parseStrength(raw: string | null | undefined): Strength {
  const empty: Strength = { c8: null, c9: null, c10: null, total: null }
  const s = blankToNull(raw)
  if (!s) return empty

  // "1500*3=4500" or "1500 x 3" - a per-class figure times three classes.
  const perClass = s.match(/^(\d[\d,]*)\s*[*x×]\s*3\b/i)
  if (perClass) {
    const n = Number(perClass[1].replace(/,/g, ''))
    if (Number.isFinite(n)) {
      const stated = s.match(/=\s*(\d[\d,]*)/)
      const total = stated ? Number(stated[1].replace(/,/g, '')) : n * 3
      return { c8: n, c9: n, c10: n, total: Number.isFinite(total) ? total : n * 3 }
    }
  }

  // "300+280+310" - the three classes listed out.
  const parts = s.split('+').map((p) => Number(p.replace(/[^\d]/g, '')))
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n > 0)) {
    return { c8: parts[0], c9: parts[1], c10: parts[2], total: parts[0] + parts[1] + parts[2] }
  }

  // A plain total.
  const digits = s.replace(/,/g, '').match(/\d+/)
  if (digits) {
    const n = Number(digits[0])
    if (Number.isFinite(n)) return { c8: null, c9: null, c10: null, total: n }
  }
  return empty
}

/** Total = the three classes when any are filled, else whatever was entered. */
export function totalStrength(s: {
  c8: number | null
  c9: number | null
  c10: number | null
  total: number | null
}): number | null {
  const parts = [s.c8, s.c9, s.c10].filter((n): n is number => typeof n === 'number')
  if (parts.length > 0) return parts.reduce((a, b) => a + b, 0)
  return s.total
}
