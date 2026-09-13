import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ImportWizard from './ImportWizard'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  // Server-side gate. The nav hides this link for members, but that is not
  // what keeps them out - this is.
  await requireAdmin()

  const recent = await prisma.importBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { createdBy: { select: { name: true } } },
  })

  return (
    <ImportWizard
      recent={recent.map((b) => ({
        id: b.id,
        filename: b.filename,
        mode: b.mode,
        rowsCreated: b.rowsCreated,
        rowsUpdated: b.rowsUpdated,
        rowsSkipped: b.rowsSkipped,
        isUndone: b.isUndone,
        by: b.createdBy?.name ?? 'Someone',
        at: b.createdAt.toISOString(),
      }))}
    />
  )
}
