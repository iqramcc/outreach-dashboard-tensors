import { apiAdmin } from '@/lib/auth'
import { parseWorkbook } from '@/lib/excel/parse'
import { suggestMapping } from '@/lib/excel/map'
import { matchDistrict } from '@/lib/regions'
import { prisma } from '@/lib/db'

/**
 * Step 1 of the import: parse the uploaded workbook and hand back everything
 * the wizard needs to show a preview - per-tab headers, a suggested column
 * mapping, and the district guessed from each tab name.
 *
 * Nothing is written to the database here. The file is analysed and the result
 * is returned; the actual import is a second, explicit request.
 */
export async function POST(request: Request) {
  const { error } = await apiAdmin()
  if (error) return error

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return Response.json({ error: 'Upload an .xlsx, .xls or .csv file' }, { status: 400 })
  }

  let workbook
  try {
    workbook = await parseWorkbook(await file.arrayBuffer(), file.name)
  } catch {
    return Response.json(
      { error: 'Could not read that file. Is it a valid Excel workbook?' },
      { status: 400 }
    )
  }

  const existingSheets = await prisma.sheet.findMany({
    where: { isArchived: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  const tabs = workbook.tabs.map((tab) => {
    const hit = matchDistrict(tab.name)
    return {
      name: tab.name,
      headerRow: tab.headerRow,
      headers: tab.headers,
      rowCount: tab.totalRows,
      skippedEmpty: tab.skippedEmpty,
      // Sample rows let the user sanity-check the mapping before committing.
      sample: tab.rows.slice(0, 3),
      guess: hit
        ? { district: hit.district, regionCategory: hit.region }
        : { district: null, regionCategory: 'KERALA' as const },
      mapping: suggestMapping(tab.headers),
    }
  })

  return Response.json({
    filename: file.name,
    tabs,
    existingSheets,
    totalRows: tabs.reduce((n, t) => n + t.rowCount, 0),
  })
}
