import { z } from 'zod'
import { toColumnKey } from '../columns'
import type { ImportTabPlan } from './import'
import { NEW_COLUMN } from './map'
import type { ParsedWorkbook } from './parse'

/**
 * The import plan the wizard sends. Shared by the preview and the real import
 * so the two can never disagree about what is going to happen.
 */
export const TabPlanSchema = z.object({
  tabName: z.string(),
  include: z.boolean().default(true),
  sheetName: z.string().min(1),
  sheetId: z.string().nullable().default(null),
  regionCategory: z.enum(['KERALA', 'TAMIL_NADU', 'MIDDLE_EAST', 'OTHER_STATE']),
  district: z.string().nullable().default(null),
  listType: z.enum(['MASS_CALL', 'CONNECTED', 'OFFLINE_OUTREACH']),
  mapping: z.record(z.string(), z.string()),
})

export const DuplicateActionSchema = z.enum([
  'SKIP',
  'MERGE_EXISTING_WINS',
  'MERGE_INCOMING_WINS',
  'IMPORT_ANYWAY',
])

export const DedupeSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['SHEET', 'DATABASE']),
  keys: z.array(z.enum(['name', 'district', 'contact', 'email', 'state'])),
  action: DuplicateActionSchema,
  /** Per-row decisions from the review table, keyed by "tab#rowIndex". */
  overrides: z.record(z.string(), DuplicateActionSchema).optional(),
})

export const ImportPlanSchema = z.object({
  mode: z.enum(['TAB_PER_SHEET', 'MERGE_ALL']),
  plans: z.array(TabPlanSchema),
  dedupe: DedupeSchema,
})

export type TabPlanInput = z.infer<typeof TabPlanSchema>

/**
 * Turn the wizard's plan into the shape the importer wants: only the included
 * tabs, with "new custom column" targets rewritten to their stable key.
 *
 * This performs no writes, so the preview can call it safely.
 */
export function buildPlans(
  workbook: ParsedWorkbook,
  planInput: TabPlanInput[]
): ImportTabPlan[] {
  const tabsByName = new Map(workbook.tabs.map((t) => [t.name, t]))
  const plans: ImportTabPlan[] = []

  for (const p of planInput) {
    if (!p.include) continue
    const tab = tabsByName.get(p.tabName)
    if (!tab) continue

    const mapping: Record<string, string> = {}
    for (const [header, target] of Object.entries(p.mapping)) {
      mapping[header] = target === NEW_COLUMN ? toColumnKey(header) : target
    }

    plans.push({
      tab,
      mapping,
      sheetId: p.sheetId,
      defaults: {
        sheetName: p.sheetName,
        regionCategory: p.regionCategory,
        district: p.district,
        listType: p.listType,
      },
    })
  }

  return plans
}
