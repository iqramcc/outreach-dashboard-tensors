import type { Prisma } from '@prisma/client'

/**
 * The one place that turns the sheet's URL filters into a Prisma query.
 *
 * The grid, the Excel export and bulk assignment all have to agree on what
 * "the current list" means - if they drifted, "assign everyone I'm looking at"
 * would assign a different set from the one on screen.
 */
export type SchoolFilter = {
  sheetId?: string | null
  q?: string | null
  district?: string | null
  region?: string | null
  list?: string | null
  status?: string | null
  assigned?: string | null
  due?: string | null
}

export function buildSchoolWhere(f: SchoolFilter): Prisma.SchoolWhereInput {
  const where: Prisma.SchoolWhereInput = {}

  if (f.sheetId) where.sheetId = f.sheetId

  const q = f.q?.trim()
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { contact: { contains: q } },
      { email: { contains: q, mode: 'insensitive' } },
      { pocName: { contains: q, mode: 'insensitive' } },
      { connection: { contains: q, mode: 'insensitive' } },
      { remarks: { contains: q, mode: 'insensitive' } },
      { district: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (f.district) where.district = f.district
  if (f.region) where.regionCategory = f.region as Prisma.SchoolWhereInput['regionCategory']
  if (f.list) where.listType = f.list as Prisma.SchoolWhereInput['listType']
  // "none" is a real choice - rows with nothing set yet.
  if (f.status) where.statusId = f.status === 'none' ? null : f.status
  if (f.assigned) where.assignedToId = f.assigned === 'none' ? null : f.assigned
  if (f.due === '1') where.nextFollowUpAt = { lte: new Date() }

  return where
}

/** Read the filter straight off a request URL. */
export function filterFromParams(params: URLSearchParams): SchoolFilter {
  return {
    sheetId: params.get('sheetId'),
    q: params.get('q'),
    district: params.get('district'),
    region: params.get('region'),
    list: params.get('list'),
    status: params.get('status'),
    assigned: params.get('assigned'),
    due: params.get('due'),
  }
}
