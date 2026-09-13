import { z } from 'zod'
import { apiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const Body = z.object({
  prefs: z
    .array(
      z.object({
        columnDefId: z.string().min(1),
        isVisible: z.boolean().optional(),
        order: z.number().int().optional(),
      })
    )
    .min(1)
    .max(200),
})

/**
 * The caller's own column layout - which columns they see, and in what order.
 *
 * Kept per user rather than shared: one volunteer widening their view to chase
 * email addresses should not rearrange the grid for everyone else mid-call.
 * The shared defaults still live on the Columns screen.
 */
export async function POST(request: Request) {
  const { user, error } = await apiUser()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })

  await prisma.$transaction(
    parsed.data.prefs.map((p) =>
      prisma.columnPref.upsert({
        where: { userId_columnDefId: { userId: user.id, columnDefId: p.columnDefId } },
        update: {
          ...(p.isVisible === undefined ? {} : { isVisible: p.isVisible }),
          ...(p.order === undefined ? {} : { order: p.order }),
        },
        create: {
          userId: user.id,
          columnDefId: p.columnDefId,
          isVisible: p.isVisible ?? true,
          order: p.order ?? null,
        },
      })
    )
  )

  return Response.json({ ok: true, saved: parsed.data.prefs.length })
}

/** Back to the shared defaults. */
export async function DELETE() {
  const { user, error } = await apiUser()
  if (error) return error
  const res = await prisma.columnPref.deleteMany({ where: { userId: user.id } })
  return Response.json({ ok: true, cleared: res.count })
}
