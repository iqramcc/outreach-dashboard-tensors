import ExcelJS from 'exceljs'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveColumns } from '@/lib/columns'
import { fieldValue, missingFields } from '@/lib/campaign'

/**
 * Export one list to Excel, choosing new or already-sent.
 *
 * Exporting "new" separately is the whole point: it is what stops the team
 * mailing the same school twice when they send a second batch.
 *
 * Only the fields the list declares are exported, in the order the admin set
 * them, so the file can be handed straight to a mail-merge instead of being
 * cut down by hand.
 */
export async function GET(request: Request, ctx: RouteContext<'/api/campaigns/[id]/export'>) {
  const { error } = await apiUser()
  if (error) return error

  const { id } = await ctx.params
  const url = new URL(request.url)
  const which = url.searchParams.get('status') // NEW | SENT | ALL
  const readyOnly = url.searchParams.get('ready') === '1'

  const list = await prisma.campaignList.findUnique({ where: { id } })
  if (!list) return Response.json({ error: 'List not found' }, { status: 404 })

  const entries = await prisma.campaignEntry.findMany({
    where: {
      listId: id,
      ...(which === 'NEW' || which === 'SENT' ? { status: which } : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: {
      school: true,
      addedBy: { select: { name: true } },
    },
  })

  const required = (list.requiredFields as string[]) ?? []
  const optional = (list.optionalFields as string[]) ?? []
  const fields = [...required, ...optional.filter((f) => !required.includes(f))]

  // Label the columns the way the team labels them everywhere else.
  const defs = await prisma.columnDef.findMany({ where: { sheetId: null } })
  const labels = new Map(resolveColumns(defs).map((c) => [c.key, c.label]))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tensors Olympiad Dashboard'
  const ws = wb.addWorksheet(
    `${list.name} ${which === 'SENT' ? 'sent' : which === 'NEW' ? 'new' : 'all'}`.slice(0, 31)
  )

  ws.columns = [
    ...fields.map((f) => ({ header: labels.get(f) ?? f, key: f, width: 24 })),
    { header: 'Comment', key: '__note', width: 30 },
    { header: 'Status', key: '__status', width: 10 },
    { header: 'Added by', key: '__by', width: 16 },
    { header: 'Missing', key: '__missing', width: 20 },
  ]
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  let skipped = 0
  for (const e of entries) {
    const overrides = (e.data ?? {}) as Record<string, string>
    const missing = missingFields(e.school, overrides, required)
    if (readyOnly && missing.length > 0) {
      skipped++
      continue
    }

    const row: Record<string, string> = {}
    for (const f of fields) row[f] = fieldValue(e.school, overrides, f)
    row.__note = e.note ?? ''
    row.__status = e.status
    row.__by = e.addedBy?.name ?? ''
    // Named rather than flagged, so it is obvious what to go and fill in.
    row.__missing = missing.map((f) => labels.get(f) ?? f).join(', ')
    ws.addRow(row)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const name = `${list.name}-${which?.toLowerCase() ?? 'all'}-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}"`,
      'X-Skipped-Not-Ready': String(skipped),
    },
  })
}
