import { z } from 'zod'
import { apiAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toColumnKey } from '@/lib/columns'

const Body = z.object({
  label: z.string().min(1, 'Give the column a name'),
  type: z
    .enum(['TEXT', 'LONGTEXT', 'NUMBER', 'PHONE', 'EMAIL', 'SELECT', 'DATE', 'CHECKBOX'])
    .default('TEXT'),
  options: z.array(z.string()).nullish(),
  sheetId: z.string().nullish(),
})

export async function POST(request: Request) {
  const { error } = await apiAdmin()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad request' },
      { status: 400 }
    )
  }

  const key = toColumnKey(parsed.data.label)
  const sheetId = parsed.data.sheetId ?? null

  const clash = await prisma.columnDef.findFirst({ where: { key, sheetId } })
  if (clash) {
    return Response.json({ error: 'A column with that name already exists' }, { status: 409 })
  }

  const last = await prisma.columnDef.findFirst({ orderBy: { order: 'desc' } })
  const column = await prisma.columnDef.create({
    data: {
      key,
      label: parsed.data.label,
      type: parsed.data.type,
      options: parsed.data.options ?? undefined,
      sheetId,
      isCore: false,
      order: (last?.order ?? 0) + 1,
    },
  })
  return Response.json({ ok: true, column })
}
