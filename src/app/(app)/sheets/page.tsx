import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import SheetsHome from './SheetsHome'

export const dynamic = 'force-dynamic'

/**
 * Two ways into the same rows: by where a school is, or by whose job it is.
 *
 * Everything except the stored sheets is a view built from a filter, so a
 * school reassigned from one volunteer to another moves between these
 * immediately and no row is ever duplicated to make a branch exist.
 */
export default async function SheetsPage() {
  const user = await requireUser()

  const [sheets, byListAndSheet, members, byMember] = await Promise.all([
    prisma.sheet.findMany({
      where: { isArchived: false },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { schools: true } } },
    }),
    // Which lists each stored sheet actually holds, so a sheet appears under
    // Primary or Secondary based on its contents rather than its name.
    prisma.school.groupBy({
      by: ['sheetId', 'listType'],
      _count: true,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.school.groupBy({
      by: ['assignedToId', 'listType'],
      _count: true,
    }),
  ])

  const sheetLists = new Map<string, Record<string, number>>()
  for (const row of byListAndSheet) {
    const entry = sheetLists.get(row.sheetId) ?? {}
    entry[row.listType] = (entry[row.listType] ?? 0) + row._count
    sheetLists.set(row.sheetId, entry)
  }

  const memberCounts = new Map<string, Record<string, number>>()
  let unassigned = 0
  for (const row of byMember) {
    if (!row.assignedToId) {
      unassigned += row._count
      continue
    }
    const entry = memberCounts.get(row.assignedToId) ?? {}
    entry[row.listType] = (entry[row.listType] ?? 0) + row._count
    memberCounts.set(row.assignedToId, entry)
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-3 sm:p-5">
      <SheetsHome
        canImport={user.role === 'ADMIN'}
        sheets={sheets.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          count: s._count.schools,
          lists: sheetLists.get(s.id) ?? {},
        }))}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          lists: memberCounts.get(m.id) ?? {},
        }))}
        unassigned={unassigned}
      />
    </main>
  )
}
