import { z } from 'zod'
import { apiAdmin } from '@/lib/auth'
import { parseWorkbook } from '@/lib/excel/parse'
import { runImport, type ImportTabPlan } from '@/lib/excel/import'
import { prisma } from '@/lib/db'
import { toColumnKey, isCoreKey } from '@/lib/columns'
import { NEW_COLUMN, IGNORE } from '@/lib/excel/map'

const TabPlan = z.object({
  tabName: z.string(),
  include: z.boolean().default(true),
  sheetName: z.string().min(1),
  sheetId: z.string().nullable().default(null),
  regionCategory: z.enum(['KERALA', 'TAMIL_NADU', 'MIDDLE_EAST', 'OTHER_STATE']),
  district: z.string().nullable().default(null),
  listType: z.enum(['MASS_CALL', 'CONNECTED', 'OFFLINE_OUTREACH']),
  mapping: z.record(z.string(), z.string()),
})

const Body = z.object({
  mode: z.enum(['TAB_PER_SHEET', 'MERGE_ALL']),
  plans: z.array(TabPlan),
  dedupe: z.object({
    enabled: z.boolean(),
    scope: z.enum(['SHEET', 'DATABASE']),
    keys: z.array(z.enum(['name', 'district', 'contact', 'email', 'state'])),
    action: z.enum(['SKIP', 'UPDATE', 'IMPORT_ANYWAY']),
  }),
})

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

  const parsed = Body.safeParse(JSON.parse(rawPlan))
  if (!parsed.success) {
    return Response.json({ error: 'Invalid import plan' }, { status: 400 })
  }
  const { mode, plans: planInput, dedupe } = parsed.data

  const workbook = await parseWorkbook(await file.arrayBuffer(), file.name)
  const tabsByName = new Map(workbook.tabs.map((t) => [t.name, t]))

  // Any header the user marked as a new custom column has to exist as a
  // ColumnDef, or the value would be saved into `extra` with nothing in the UI
  // to render it.
  const customKeys = new Set<string>()
  for (const plan of planInput) {
    if (!plan.include) continue
    for (const [header, target] of Object.entries(plan.mapping)) {
      if (target === NEW_COLUMN) customKeys.add(toColumnKey(header))
      else if (target !== IGNORE && !isCoreKey(target)) customKeys.add(target)
    }
  }

  if (customKeys.size > 0) {
    const existing = await prisma.columnDef.findMany({
      where: { sheetId: null, key: { in: [...customKeys] } },
      select: { key: true },
    })
    const have = new Set(existing.map((c) => c.key))
    const last = await prisma.columnDef.findFirst({ orderBy: { order: 'desc' } })
    let order = (last?.order ?? 0) + 1

    for (const plan of planInput) {
      if (!plan.include) continue
      for (const [header, target] of Object.entries(plan.mapping)) {
        if (target !== NEW_COLUMN) continue
        const key = toColumnKey(header)
        if (have.has(key)) continue
        have.add(key)
        await prisma.columnDef.create({
          data: { key, label: header, type: 'TEXT', isCore: false, order: order++ },
        })
      }
    }
  }

  const plans: ImportTabPlan[] = []
  for (const p of planInput) {
    if (!p.include) continue
    const tab = tabsByName.get(p.tabName)
    if (!tab) continue

    // Rewrite NEW_COLUMN targets to their stable custom-column key.
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

  if (plans.length === 0) {
    return Response.json({ error: 'No tabs selected' }, { status: 400 })
  }

  const result = await runImport(plans, dedupe, file.name, mode, user.id)
  return Response.json({ ok: true, ...result })
}
