import ExcelJS from 'exceljs'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveColumns } from '@/lib/columns'
import { buildSchoolWhere, filterFromParams } from '@/lib/schoolFilter'
import { REGION_LABELS } from '@/lib/regions'

const ENTITY_LABELS: Record<string, string> = {
  SCHOOL: 'School',
  TUITION_CENTRE: 'Tuition centre',
  OTHER: 'Other',
}
const LIST_LABELS: Record<string, string> = {
  MASS_CALL: 'Mass call list',
  CONNECTED: 'Connected school',
  OFFLINE_OUTREACH: 'Offline outreach',
}

/**
 * Export the current filtered view back to .xlsx, with the status colour
 * applied as the row fill so the exported file carries the same colour code
 * the team reads on screen.
 */
export async function GET(request: Request) {
  const { error } = await apiUser()
  if (error) return error

  const url = new URL(request.url)
  const sheetId = url.searchParams.get('sheetId')
  const where = buildSchoolWhere(filterFromParams(url.searchParams))

  const [sheet, schools, columnDefs] = await Promise.all([
    sheetId ? prisma.sheet.findUnique({ where: { id: sheetId } }) : null,
    prisma.school.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        status: { select: { name: true, hex: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.columnDef.findMany({
      where: { OR: [{ sheetId: null }, ...(sheetId ? [{ sheetId }] : [])] },
      orderBy: { order: 'asc' },
    }),
  ])

  const columns = resolveColumns(columnDefs)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tensors Olympiad Dashboard'
  const ws = wb.addWorksheet((sheet?.name ?? 'Schools').slice(0, 31))

  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.min(40, Math.max(12, Math.round((c.width ?? 140) / 8))),
  }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  for (const s of schools) {
    const row: Record<string, string | number | null> = {}
    for (const c of columns) {
      switch (c.key) {
        case 'status':
          row[c.key] = s.status?.name ?? ''
          break
        case 'assignedTo':
          row[c.key] = s.assignedTo?.name ?? ''
          break
        case 'entityType':
          row[c.key] = ENTITY_LABELS[s.entityType] ?? s.entityType
          break
        case 'listType':
          row[c.key] = LIST_LABELS[s.listType] ?? s.listType
          break
        case 'regionCategory':
          row[c.key] = REGION_LABELS[s.regionCategory] ?? s.regionCategory
          break
        case 'nextFollowUpAt':
          row[c.key] = s.nextFollowUpAt ? s.nextFollowUpAt.toISOString().slice(0, 10) : ''
          break
        default: {
          if (c.isCore) {
            const v = (s as unknown as Record<string, unknown>)[c.key]
            row[c.key] = v === null || v === undefined ? '' : String(v)
          } else {
            row[c.key] = (s.extra as Record<string, string>)?.[c.key] ?? ''
          }
        }
      }
    }
    const added = ws.addRow(row)
    // Carry the colour code into the file, not just the status word.
    if (s.status?.hex) {
      const argb = 'FF' + s.status.hex.replace('#', '').toUpperCase()
      added.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb },
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const name = `${sheet?.name ?? 'schools'}-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}"`,
    },
  })
}
