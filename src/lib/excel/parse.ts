import ExcelJS from 'exceljs'

/**
 * Parsing the team's real workbooks, not idealised ones. Their
 * "School List - Oly 2026" has 16 tabs where:
 *   - every tab has a different column layout
 *   - the header is sometimes on row 1, sometimes row 2, sometimes duplicated
 *     across both
 *   - leading columns are blank or hold a serial number
 *   - cells are rich-text / hyperlink objects, not strings
 *   - a tab reports 4 columns but has stray formatting out to column 26
 *   - one tab ("Total List (DONT TOUCH)") is empty
 * Everything in this file exists to absorb one of those.
 */

export type ParsedTab = {
  name: string
  headers: string[]
  rows: Record<string, string>[]
  /** 1-based row the headers were found on, so the UI can show/override it. */
  headerRow: number
  totalRows: number
  skippedEmpty: number
}

export type ParsedWorkbook = {
  filename: string
  tabs: ParsedTab[]
}

/**
 * ExcelJS hands back strings, numbers, dates, formula results, hyperlink
 * objects and rich-text fragment arrays. Flatten all of them to a trimmed
 * string - this is what stops school names importing as "[object Object]".
 */
export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)

  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>
    // Rich text: { richText: [{ text }, ...] }
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[])
        .map((f) => f.text ?? '')
        .join('')
        .trim()
    }
    // Hyperlink: { text, hyperlink }. In the Kerala school lists `text` is
    // itself a rich-text object holding the school name, while the hyperlink
    // points at sametham.kite.kerala.gov.in - so recurse into the label first
    // and only fall back to the URL when there is no label at all.
    if ('text' in v || typeof v.hyperlink === 'string') {
      const label = cellToString(v.text as ExcelJS.CellValue)
      if (label) return label
      const link = typeof v.hyperlink === 'string' ? v.hyperlink : ''
      return link.replace(/^mailto:/i, '').trim()
    }
    // Formula: { formula, result }. Their sheets hold "1500*3=4500" as text,
    // but genuine formulas should import as their computed value.
    if ('result' in v) return cellToString(v.result as ExcelJS.CellValue)
    if ('error' in v) return ''
  }
  return String(value).trim()
}

/**
 * Cells that betray a data row masquerading as a header - an email, a URL, a
 * long address, a phone number. Without this the EKM tab, whose first data row
 * has exactly as many text cells as its header, wins the tie and turns
 * "St.Philomena's Public School" into a column name.
 */
function looksLikeData(s: string): boolean {
  if (!s) return false
  if (s.length > 60) return true
  if (s.includes('@')) return true
  if (/^https?:\/\//i.test(s)) return true
  if (/^[+(]?\d[\d\s\-(),;+]{7,}$/.test(s)) return true
  return false
}

/** A header cell that is really a header: non-empty and not just a number. */
function looksLikeHeader(s: string): boolean {
  if (!s) return false
  if (/^\d+(\.\d+)?$/.test(s)) return false
  return /[A-Za-z]/.test(s)
}

/**
 * Find the header row by scanning the first few rows and taking the one with
 * the most header-ish cells. Their KLM/PAT/TVM tabs repeat the header on rows
 * 1 and 2; ties resolve to the LAST such row, because the lower one is the one
 * immediately above the data.
 */
function detectHeaderRow(ws: ExcelJS.Worksheet, maxScan = 8): number {
  let bestRow = 1
  let bestScore = -1

  const limit = Math.min(maxScan, ws.rowCount)
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r)
    let score = 0
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = cellToString(cell.value)
      if (looksLikeData(text)) score -= 2
      else if (looksLikeHeader(text)) score++
    })
    // Strict > keeps the EARLIER of two equally good rows, which is what EKM
    // needs. Tabs that genuinely repeat their header across rows 1 and 2 still
    // resolve to row 2, because that row carries an extra column ("HS").
    if (score > bestScore && score > 0) {
      bestScore = score
      bestRow = r
    }
  }
  return bestRow
}

/**
 * Trim phantom trailing columns. ExcelJS reports a column count that includes
 * cells touched only by stray formatting, which would otherwise create a dozen
 * empty "Column 12" custom fields on import.
 */
function effectiveWidth(ws: ExcelJS.Worksheet, headerRow: number): number {
  const header = ws.getRow(headerRow)
  let last = 0
  header.eachCell({ includeEmpty: true }, (cell, col) => {
    if (cellToString(cell.value)) last = col
  })
  return last
}

/** Make headers unique and non-empty so they can key a row object. */
function normalizeHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((h, i) => {
    let label = h.trim().replace(/\s+/g, ' ')
    if (!label) label = `Column ${i + 1}`
    const n = seen.get(label.toLowerCase()) ?? 0
    seen.set(label.toLowerCase(), n + 1)
    return n === 0 ? label : `${label} (${n + 1})`
  })
}

export async function parseWorkbook(
  buffer: ArrayBuffer | Buffer,
  filename: string
): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook()
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

  if (/\.csv$/i.test(filename)) {
    const { Readable } = await import('node:stream')
    await wb.csv.read(Readable.from(buf.toString('utf8')))
  } else {
    // exceljs bundles its own @types/node, so its Buffer is nominally a
    // different type from ours. Borrow the parameter type rather than casting
    // through `any`.
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0])
  }

  const tabs: ParsedTab[] = []

  for (const ws of wb.worksheets) {
    if (ws.rowCount === 0) continue // e.g. "Total List (DONT TOUCH)"

    const headerRow = detectHeaderRow(ws)
    const width = effectiveWidth(ws, headerRow)
    if (width === 0) continue

    const rawHeaders: string[] = []
    const hr = ws.getRow(headerRow)
    for (let c = 1; c <= width; c++) rawHeaders.push(cellToString(hr.getCell(c).value))
    const headers = normalizeHeaders(rawHeaders)

    const rows: Record<string, string>[] = []
    let skippedEmpty = 0

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const record: Record<string, string> = {}
      let filled = 0

      for (let c = 1; c <= width; c++) {
        const value = cellToString(row.getCell(c).value)
        record[headers[c - 1]] = value
        if (value) filled++
      }

      if (filled === 0) {
        skippedEmpty++
        continue
      }
      // A row repeating the header (their duplicated header rows) is not data.
      const isRepeatHeader = headers.every(
        (h, i) => !record[headers[i]] || record[headers[i]].toLowerCase() === h.toLowerCase()
      )
      if (isRepeatHeader) {
        skippedEmpty++
        continue
      }
      rows.push(record)
    }

    tabs.push({
      name: ws.name,
      headers,
      rows,
      headerRow,
      totalRows: rows.length,
      skippedEmpty,
    })
  }

  return { filename, tabs }
}
