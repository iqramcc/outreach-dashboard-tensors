import { apiAdmin } from '@/lib/auth'
import { parseWorkbook } from '@/lib/excel/parse'
import { runImport } from '@/lib/excel/import'
import { buildPlans, ImportPlanSchema } from '@/lib/excel/plan'
import { prisma } from '@/lib/db'
import { toColumnKey, isCoreKey } from '@/lib/columns'
import { NEW_COLUMN, IGNORE } from '@/lib/excel/map'

/**
 * Step 2: actually import. The file is uploaded again alongside the plan
 * rather than being cached server-side between the two requests - it keeps the
 * server stateless, and re-parsing a 3,000-row workbook costs well under a
 * second.
 */
export async function POST(request: Request) {
  const { user, error } = await apiAdmin()
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
  const { mode, plans: planInput, dedupe } = parsed.data

  const workbook = await parseWorkbook(await file.arrayBuffer(), file.name)

  // Any header the user marked as a new custom column has to exist as a
  // ColumnDef, or the value would be saved into `extra` with nothing in the UI
  // to render it.
  const wanted = new Map<string, string>()
  for (const plan of planInput) {
    if (!plan.include) continue
    for (const [header, target] of Object.entries(plan.mapping)) {
      if (target === NEW_COLUMN) wanted.set(toColumnKey(header), header)
      else if (target !== IGNORE && !isCoreKey(target)) wanted.set(target, header)
    }
  }

  if (wanted.size > 0) {
    const existing = await prisma.columnDef.findMany({
      where: { sheetId: null, key: { in: [...wanted.keys()] } },
      select: { key: true },
    })
    const have = new Set(existing.map((c) => c.key))
    const last = await prisma.columnDef.findFirst({ orderBy: { order: 'desc' } })
    let order = (last?.order ?? 0) + 1

    for (const [key, label] of wanted) {
      if (have.has(key)) continue
      have.add(key)
      await prisma.columnDef.create({
        data: { key, label, type: 'TEXT', isCore: false, order: order++ },
      })
    }
  }

  const plans = buildPlans(workbook, planInput)
  if (plans.length === 0) {
    return Response.json({ error: 'No tabs selected' }, { status: 400 })
  }

  const result = await runImport(plans, dedupe, file.name, mode, user.id)
  return Response.json({ ok: true, ...result })
}
