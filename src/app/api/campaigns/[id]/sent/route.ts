import { z } from 'zod'
import { apiAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  /** Specific entries, or every unsent one on the list. */
  scope: z.enum(['ids', 'allNew']),
  entryIds: z.array(z.string()).optional(),
  /** false puts them back to new, for a send that did not actually go out. */
  sent: z.boolean().default(true),
})

/**
 * Mark what has gone out.
 *
 * This is what separates "new" from "already sent" on the next export, so the
 * team never mails the same school twice by exporting the whole list again.
 * Admin-only, because it is a claim about what actually happened.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/campaigns/[id]/sent'>) {
  const { error } = await apiAdmin()
  if (error) return error

  const { id } = await ctx.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })
  const b = parsed.data

  const where =
    b.scope === 'ids'
      ? { listId: id, id: { in: b.entryIds ?? [] } }
      : { listId: id, status: 'NEW' as const }

  if (b.scope === 'ids' && !b.entryIds?.length) {
    return Response.json({ error: 'No entries given' }, { status: 400 })
  }

  const res = await prisma.campaignEntry.updateMany({
    where,
    data: b.sent
      ? { status: 'SENT', sentAt: new Date() }
      : { status: 'NEW', sentAt: null },
  })

  return Response.json({ ok: true, count: res.count })
}
