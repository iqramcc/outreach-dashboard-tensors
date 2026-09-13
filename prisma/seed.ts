import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import pg from 'pg'
import { CORE_COLUMNS } from '../src/lib/columns'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

/**
 * The starting colour legend. These double as the outreach funnel, so the
 * order here is the order of the pipeline. Teams can rename, recolour, reorder
 * and add to these from the legend at the top of any sheet.
 */
const STATUSES = [
  { name: 'Not Contacted', hex: '#94a3b8', order: 0, isDefault: true },
  { name: 'Call Attempted', hex: '#f59e0b', order: 1, isContacted: true },
  { name: 'Contacted', hex: '#3b82f6', order: 2, isContacted: true },
  { name: 'Interested', hex: '#8b5cf6', order: 3, isContacted: true },
  { name: 'Follow Up Needed', hex: '#eab308', order: 4, isContacted: true },
  { name: 'Confirmed', hex: '#16a34a', order: 5, isContacted: true, isPositive: true },
  { name: 'Registered', hex: '#059669', order: 6, isContacted: true, isPositive: true },
  { name: 'Not Interested', hex: '#ef4444', order: 7, isContacted: true },
  { name: 'Wrong Number', hex: '#6b7280', order: 8, isContacted: true },
]

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@tensors.org').toLowerCase()
  const password = process.env.ADMIN_PASSWORD ?? 'changeme123'
  const name = process.env.ADMIN_NAME ?? 'Tensors Admin'

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', isActive: true },
    create: { email, name, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) },
  })
  console.log(`admin: ${admin.email}`)

  for (const s of STATUSES) {
    await prisma.outreachStatus.upsert({
      where: { name: s.name },
      update: { hex: s.hex, order: s.order },
      create: s,
    })
  }
  console.log(`statuses: ${STATUSES.length}`)

  // Register the core columns so admins can relabel/reorder them in the UI.
  for (const [i, col] of CORE_COLUMNS.entries()) {
    const existing = await prisma.columnDef.findFirst({
      where: { key: col.key, sheetId: null },
    })
    if (existing) continue
    await prisma.columnDef.create({
      data: {
        key: col.key,
        label: col.label,
        type: col.type,
        isCore: true,
        order: i,
        width: col.width ?? null,
      },
    })
  }
  console.log(`core columns: ${CORE_COLUMNS.length}`)

  // One starter sheet so the app is never an empty void on first login.
  const sheetCount = await prisma.sheet.count()
  if (sheetCount === 0) {
    await prisma.sheet.create({
      data: {
        name: 'Primary Target Schools',
        description: 'Schools we have a personal connection with - primary targets.',
        order: 0,
        createdById: admin.id,
      },
    })
    console.log('created starter sheet')
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
