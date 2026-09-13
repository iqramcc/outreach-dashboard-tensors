import { apiAdmin } from '@/lib/auth'
import { parseWorkbook } from '@/lib/excel/parse'
import { previewDuplicates } from '@/lib/excel/import'
import { buildPlans, ImportPlanSchema } from '@/lib/excel/plan'

/**
 * Dry run: report which incoming rows clash with what, so the wizard can show
 * a count and let the user review them before anything is written.
 *
 * Writes nothing.
 */
export async function POST(request: Request) {
  const { error } = await apiAdmin()
  if (error) return error

  const form = await request.formData()
  const file = form.get('file')
  const rawPlan = form.get('plan')

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (typeof rawPlan !== 'string') {
    return Response.json({ error: 'Missing import plan' }, { status: 400 })
  }

  const parsed = ImportPlanSchema.safeParse(JSON.parse(rawPlan))
  if (!parsed.success) {
    return Response.json({ error: 'Invalid import plan' }, { status: 400 })
  }

  const workbook = await parseWorkbook(await file.arrayBuffer(), file.name)
  const plans = buildPlans(workbook, parsed.data.plans)
  if (plans.length === 0) {
    return Response.json({ error: 'No tabs selected' }, { status: 400 })
  }

  const { conflicts, totalRows } = await previewDuplicates(plans, parsed.data.dedupe)

  // A big workbook can clash in the thousands; send enough to review and let
  // the count speak for the rest.
  const LIMIT = 300
  return Response.json({
    totalRows,
    duplicateCount: conflicts.length,
    withinFileCount: conflicts.filter((c) => c.withinFile).length,
    conflicts: conflicts.slice(0, LIMIT),
    truncated: conflicts.length > LIMIT,
  })
}
