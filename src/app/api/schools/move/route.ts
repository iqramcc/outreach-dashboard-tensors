import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { apiAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildSchoolWhere } from '@/lib/schoolFilter'

const Filter = z.object({
  sheetId: z.string().nullish(),
  q: z.string().nullish(),
  district: z.string().nullish(),
  region: z.string().nullish(),
  list: z.string().nullish(),
  status: z.string().nullish(),
  assigned: z.string().nullish(),
  due: z.string().nullish(),
})

const Body = z.object({
  scope: z.enum(['ids', 'filter']),
  ids: z.array(z.string()).optional(),
  filter: Filter.optional(),
  /** Which list the rows should belong to. */
  listType: z.enum(['MASS_CALL', 'CONNECTED', 'OFFLINE_OUTREACH']),
  /** Sheet to place them in. Null keeps them where they are. */
  targetSheetId: z.string().nullish(),
  /**
   * "move" relabels the rows in place. "copy" leaves the originals alone and
   * makes a second row in the target sheet, for a school that genuinely
   * belongs to both lists.
   */
  mode: z.enum(['move', 'copy']),
})

/**
 * Admin-only. Changing which list a school belongs to is a decision about the
 * team's targeting, not day-to-day data entry, so members no longer see it.
 */
export async function POST(request: Request) {
  const { user, error } = await apiAdmin()
  if (error) return error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 })
  const b = parsed.data

  let where
  if (b.scope === 'ids') {
    if (!b.ids?.length) return Response.json({ error: 'No rows selected' }, { status: 400 })
    where = { id: { in: b.ids } }
  } else {
    if (!b.filter?.sheetId) {
      return Response.json({ error: 'Pick a sheet first' }, { status: 400 })
    }
    where = buildSchoolWhere(b.filter)
  }

  if (b.mode === 'move') {
    const res = await prisma.school.updateMany({
      where,
      data: {
        listType: b.listType,
        ...(b.targetSheetId ? { sheetId: b.targetSheetId } : {}),
      },
    })
    return Response.json({ ok: true, moved: res.count, copied: 0 })
  }

  // --- copy ---------------------------------------------------------------
  if (!b.targetSheetId) {
    return Response.json(
      { error: 'Copying needs a sheet to copy into' },
      { status: 400 }
    )
  }

  const rows = await prisma.school.findMany({ where })
  if (rows.length === 0) return Response.json({ ok: true, moved: 0, copied: 0 })

  // Don't copy a school into a sheet that already has it under the same
  // name and district - re-running this should not stack up duplicates.
  const existing = await prisma.school.findMany({
    where: {
      sheetId: b.targetSheetId,
      nameKey: { in: [...new Set(rows.map((r) => r.nameKey))] },
    },
    select: { nameKey: true, district: true },
  })
  const taken = new Set(existing.map((e) => `${e.nameKey}|${(e.district ?? '').toLowerCase()}`))

  const last = await prisma.school.findFirst({
    where: { sheetId: b.targetSheetId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  let position = (last?.position ?? 0) + 1000

  // The copy is a fresh row in the other list: it carries the school's details
  // but not its identity or outreach history, which stay with the original.
  // Listed field by field rather than spread, so a column added later has to
  // be considered here deliberately instead of being copied by accident.
  const toCreate = rows
    .filter((r) => !taken.has(`${r.nameKey}|${(r.district ?? '').toLowerCase()}`))
    .map((r) => ({
      sheetId: b.targetSheetId as string,
      listType: b.listType,
      position: (position += 1000),
      createdById: user.id,

      name: r.name,
      nameKey: r.nameKey,
      primaryPoc: r.primaryPoc,
      entityType: r.entityType,
      schoolType: r.schoolType,
      financeType: r.financeType,
      studentStrength: r.studentStrength,
      strength8: r.strength8,
      strength9: r.strength9,
      strength10: r.strength10,
      strengthTotal: r.strengthTotal,
      regionCategory: r.regionCategory,
      district: r.district,
      state: r.state,
      connection: r.connection,
      pocName: r.pocName,
      pocRole: r.pocRole,
      contact: r.contact,
      contactKey: r.contactKey,
      email: r.email,
      address: r.address,
      website: r.website,
      remarks: r.remarks,
      registeredStudents: r.registeredStudents,

      // Prisma will not take a JSON null here, so fall back to an empty value.
      contacts: (r.contacts ?? []) as Prisma.InputJsonValue,
      extra: (r.extra ?? {}) as Prisma.InputJsonValue,
      cellColors: (r.cellColors ?? {}) as Prisma.InputJsonValue,
    }))

  if (toCreate.length === 0) {
    return Response.json({ ok: true, moved: 0, copied: 0, alreadyThere: rows.length })
  }

  const res = await prisma.school.createMany({ data: toCreate })
  return Response.json({
    ok: true,
    moved: 0,
    copied: res.count,
    alreadyThere: rows.length - res.count,
  })
}
