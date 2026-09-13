import { notFound } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveColumns, DEFAULT_VISIBLE } from '@/lib/columns'
import SheetView from './SheetView'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 100

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

export default async function SheetPage(props: PageProps<'/sheets/[id]'>) {
  const user = await requireUser()
  const { id } = await props.params
  const sp = await props.searchParams

  const sheet = await prisma.sheet.findUnique({ where: { id } })
  if (!sheet) notFound()

  const page = Math.max(1, Number(one(sp.page)) || 1)
  const q = one(sp.q).trim()
  const district = one(sp.district)
  const region = one(sp.region)
  const listType = one(sp.list)
  const statusId = one(sp.status)
  const assigned = one(sp.assigned)
  const due = one(sp.due)

  const where: Prisma.SchoolWhereInput = { sheetId: id }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { contact: { contains: q } },
      { email: { contains: q, mode: 'insensitive' } },
      { pocName: { contains: q, mode: 'insensitive' } },
      { connection: { contains: q, mode: 'insensitive' } },
      { remarks: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (district) where.district = district
  if (region) where.regionCategory = region as Prisma.SchoolWhereInput['regionCategory']
  if (listType) where.listType = listType as Prisma.SchoolWhereInput['listType']
  if (statusId) where.statusId = statusId === 'none' ? null : statusId
  if (assigned) where.assignedToId = assigned === 'none' ? null : assigned
  if (due === '1') where.nextFollowUpAt = { lte: new Date() }

  const [total, schools, statuses, columnDefs, prefs, users, districts] = await Promise.all([
    prisma.school.count({ where }),
    prisma.school.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        status: { select: { id: true, name: true, hex: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.outreachStatus.findMany({ orderBy: { order: 'asc' } }),
    prisma.columnDef.findMany({
      where: { OR: [{ sheetId: null }, { sheetId: id }] },
      orderBy: { order: 'asc' },
    }),
    prisma.columnPref.findMany({
      where: { userId: user.id },
      select: { columnDefId: true, isVisible: true, order: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.school.findMany({
      where: { sheetId: id },
      distinct: ['district'],
      select: { district: true },
      orderBy: { district: 'asc' },
    }),
  ])

  let columns = resolveColumns(columnDefs, prefs)
  // Respect an explicit per-user preference; otherwise fall back to the
  // default visible set so a fresh sheet isn't 22 columns wide.
  const prefIds = new Set(prefs.map((p) => p.columnDefId))
  columns = columns.map((c) =>
    c.id && prefIds.has(c.id) ? c : { ...c, isVisible: DEFAULT_VISIBLE.has(c.key) }
  )

  return (
    <SheetView
      sheet={{ id: sheet.id, name: sheet.name, description: sheet.description }}
      rows={schools.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        nextFollowUpAt: s.nextFollowUpAt ? s.nextFollowUpAt.toISOString() : null,
        lastContactedAt: s.lastContactedAt ? s.lastContactedAt.toISOString() : null,
        extra: s.extra as Record<string, string>,
        cellColors: s.cellColors as Record<string, string>,
      }))}
      columns={columns}
      statuses={statuses}
      users={users}
      districts={districts.map((d) => d.district).filter(Boolean) as string[]}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      isAdmin={user.role === 'ADMIN'}
    />
  )
}
