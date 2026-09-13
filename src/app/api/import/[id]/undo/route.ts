import { apiAdmin } from '@/lib/auth'
import { undoImport } from '@/lib/excel/import'

export async function POST(_request: Request, ctx: RouteContext<'/api/import/[id]/undo'>) {
  const { error } = await apiAdmin()
  if (error) return error

  const { id } = await ctx.params
  const deleted = await undoImport(id)
  return Response.json({ ok: true, deleted })
}
