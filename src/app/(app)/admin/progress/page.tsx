import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ProgressTable, { type MemberProgress } from './ProgressTable'

export const dynamic = 'force-dynamic'

/**
 * Where every volunteer stands, in one table.
 *
 * Done as a single grouped query rather than a few per person: at 35 members
 * that would be well over a hundred round trips for one page.
 *
 * The counts are deliberately derived from the colour key's own flags
 * (isContacted, isPositive) rather than from hardcoded status names, so
 * renaming or adding a status keeps this report correct.
 */
export default async function ProgressPage() {
  await requireAdmin()

  const rows = await prisma.$queryRaw<
    {
      id: string
      name: string
      assigned: bigint
      callPending: bigint
      followUpPending: bigint
      confirmed: bigint
      registeredSchools: bigint
      students: bigint
    }[]
  >`
    SELECT
      u.id,
      u.name,
      count(s.id) AS "assigned",
      -- Never called: no status yet, or a status the team has not marked as
      -- counting for contact.
      count(*) FILTER (
        WHERE s.id IS NOT NULL
          AND (s."statusId" IS NULL OR os."isContacted" = false)
      ) AS "callPending",
      -- A follow-up that is due or already overdue.
      count(*) FILTER (
        WHERE s.id IS NOT NULL
          AND s."nextFollowUpAt" IS NOT NULL
          AND s."nextFollowUpAt" <= now()
      ) AS "followUpPending",
      count(*) FILTER (WHERE s.id IS NOT NULL AND os."isPositive") AS "confirmed",
      count(*) FILTER (
        WHERE s.id IS NOT NULL AND COALESCE(s."registeredStudents", 0) > 0
      ) AS "registeredSchools",
      COALESCE(sum(s."registeredStudents"), 0) AS "students"
    FROM "User" u
    LEFT JOIN "School" s ON s."assignedToId" = u.id
    LEFT JOIN "OutreachStatus" os ON os.id = s."statusId"
    WHERE u."isActive" = true
    GROUP BY u.id, u.name
    ORDER BY u.name
  `

  const members: MemberProgress[] = rows.map((r) => {
    const callPending = Number(r.callPending)
    const followUpPending = Number(r.followUpPending)
    return {
      id: r.id,
      name: r.name,
      assigned: Number(r.assigned),
      callPending,
      followUpPending,
      // Two different kinds of "still to do", plus their total, because the
      // team asked to sort on each of them separately.
      pendingTotal: callPending + followUpPending,
      confirmed: Number(r.confirmed),
      registeredSchools: Number(r.registeredSchools),
      students: Number(r.students),
    }
  })

  return (
    <main className="mx-auto w-full max-w-6xl p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Member progress</h1>
        <nav className="ml-auto flex gap-1">
          <Link href="/admin/users" className="btn btn-ghost">Team</Link>
          <Link href="/columns" className="btn btn-ghost">Columns</Link>
        </nav>
      </div>

      <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
        Click a column heading to sort by it; click again to reverse. Every number
        links through to the rows behind it.
      </p>

      <ProgressTable members={members} />
    </main>
  )
}
