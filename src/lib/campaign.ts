import type { School } from '@prisma/client'
import { isCoreKey } from './columns'

/**
 * What a campaign row holds for one field.
 *
 * Order matters: a value typed in when the row was added wins, then whatever
 * the school itself says. That way a list is never a stale snapshot - correct
 * a school's email and every list it is on exports the new one - while still
 * allowing a one-off value for a school that has no such field.
 */
export function fieldValue(
  school: School,
  overrides: Record<string, string>,
  key: string
): string {
  const typed = overrides?.[key]
  if (typed !== undefined && typed !== null && String(typed).trim() !== '') {
    return String(typed).trim()
  }

  if (isCoreKey(key)) {
    const v = (school as unknown as Record<string, unknown>)[key]
    return v === null || v === undefined ? '' : String(v)
  }

  const extra = (school.extra ?? {}) as Record<string, string>
  return extra[key] ?? ''
}

/**
 * Which required fields this row still has nothing for.
 *
 * A list exists to be sent, so a row with no email address in a mail list is
 * not ready - saying which field is missing is more use than a bare count.
 */
export function missingFields(
  school: School,
  overrides: Record<string, string>,
  required: string[]
): string[] {
  return required.filter((f) => fieldValue(school, overrides, f) === '')
}

export function isReady(
  school: School,
  overrides: Record<string, string>,
  required: string[]
): boolean {
  return missingFields(school, overrides, required).length === 0
}

/**
 * Fields a member may fill in from the add-to-list dialog, written back onto
 * the school itself.
 *
 * If someone finally tracks down a school's email address, it belongs on the
 * school - not buried in one mail list, where the next list would ask for it
 * again. Numbers, enums and relations are deliberately absent: those are not
 * things to be typed into a mail-merge dialog.
 */
export const WRITABLE_CORE = new Set([
  'name',
  'primaryPoc',
  'schoolType',
  'financeType',
  'studentStrength',
  'district',
  'state',
  'connection',
  'pocName',
  'pocRole',
  'contact',
  'email',
  'address',
  'website',
  'remarks',
])
