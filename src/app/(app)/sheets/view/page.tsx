import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveColumns, DEFAULT_VISIBLE } from '@/lib/columns'
import { buildSchoolWhere } from '@/lib/schoolFilter'
import { REGION_LABELS } from '@/lib/regions'
import SheetView from '../[id]/SheetView'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 100

const LIST_LABELS: Record<string, string> = {
  CONNECTED: 'Primary Target sheet',
  MASS_CALL: 'Secondary sheet',
  OFFLINE_OUTREACH: 'Offline outreach',
}

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

/**
 * A sheet assembled from a filter rather than stored as one - "everything
 * assigned to Amal", "every primary target in Kerala".
 *
 * These are views, not copies. A school moved between volunteers or districts
 * appears in the right view immediately, because nothing was duplicated to
 * build them.
 */
export default async function VirtualSheetPage(props: PageProps<'/sheets/view'>) {
  const user = await requireUser()
  const sp = await props.searchParams

  const page = Math.max(1, Number(one(sp.page)) || 1)
  const filter = {
    q: one(sp.q).trim(),
    district: one(sp.district),
    region: one(sp.region),
    list: one(sp.list),
    status: one(sp.status),
    assigned: one(sp.assigned),
    due: one(sp.due),
  }
  const where = buildSchoolWhere(filter)

  const [
    total,
    schools,
    statuses,
    columnDefs,
    prefs,
    users,
    districts,
    allSheets,
    campaigns,
    myColours,
    myTags,
  ] =
    await Promise.all([
      prisma.school.count({ where }),
      prisma.school.findMany({
        where,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          status: { select: { id: true, name: true, hex: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.outreachStatus.findMany({ orderBy: { order: 'asc' } }),
      prisma.columnDef.findMany({ where: { sheetId: null }, orderBy: { order: 'asc' } }),
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
        where,
        distinct: ['district'],
        select: { district: true },
        orderBy: { district: 'asc' },
      }),
      prisma.sheet.findMany({
        where: { isArchived: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.campaignList.findMany({
      where: { isArchived: false },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, requiredFields: true },
    }),
    prisma.userStatusColor.findMany({
        where: { userId: user.id },
        select: { statusId: true, hex: true },
      }),
      prisma.personalTag.findMany({
        where: { userId: user.id },
        orderBy: { order: 'asc' },
        include: { schools: { select: { schoolId: true } } },
      }),
    ])

  let columns = resolveColumns(columnDefs, prefs)
  const prefIds = new Set(prefs.map((p) => p.columnDefId))
  columns = columns.map((c) =>
    c.id && prefIds.has(c.id) ? c : { ...c, isVisible: DEFAULT_VISIBLE.has(c.key) }
  )

  // Name the view after what it actually shows.
  const assignee = filter.assigned
    ? filter.assigned === 'none'
      ? 'Unassigned'
      : (users.find((u) => u.id === filter.assigned)?.name ?? 'Someone')
    : null
  const title =
    [
      assignee,
      filter.list ? LIST_LABELS[filter.list] : null,
      filter.district || null,
      filter.region ? REGION_LABELS[filter.region as keyof typeof REGION_LABELS] : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'All schools'

  return (
    <SheetView
      sheet={{ id: '', name: title, description: null }}
      virtual
      rows={schools.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        nextFollowUpAt: s.nextFollowUpAt ? s.nextFollowUpAt.toISOString() : null,
        lastContactedAt: s.lastContactedAt ? s.lastContactedAt.toISOString() : null,
        contacts: (s.contacts as { name: string | null; number: string }[]) ?? [],
        extra: s.extra as Record<string, string>,
        cellColors: s.cellColors as Record<string, string>,
      }))}
      columns={columns}
      statuses={statuses}
      users={users}
      districts={districts.map((d) => d.district).filter(Boolean) as string[]}
      allSheets={allSheets}
      campaigns={campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        requiredFields: (c.requiredFields as string[]) ?? [],
      }))}
      myColours={Object.fromEntries(myColours.map((c) => [c.statusId, c.hex]))}
      myTags={myTags.map((t) => ({
        id: t.id,
        name: t.name,
        hex: t.hex,
        schoolIds: t.schools.map((x) => x.schoolId),
      }))}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      isAdmin={user.role === 'ADMIN'}
    />
  )
}
