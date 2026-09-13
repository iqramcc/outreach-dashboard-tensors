import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { REGION_LABELS } from '@/lib/regions'
import LogCallPanel from './LogCallPanel'
import ContactsPanel, { type ContactEntry } from './ContactsPanel'

export const dynamic = 'force-dynamic'

const ENTITY_LABELS: Record<string, string> = {
  SCHOOL: 'School',
  TUITION_CENTRE: 'Tuition centre',
  OTHER: 'Other',
}
const LIST_LABELS: Record<string, string> = {
  CONNECTED: 'Primary Target sheet',
  MASS_CALL: 'Secondary sheet',
  OFFLINE_OUTREACH: 'Offline outreach',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-sm">{value || <span style={{ color: 'var(--muted)' }}>&mdash;</span>}</p>
    </div>
  )
}

export default async function SchoolPage(props: PageProps<'/schools/[id]'>) {
  await requireUser()
  const { id } = await props.params

  const [school, statuses] = await Promise.all([
    prisma.school.findUnique({
      where: { id },
      include: {
        sheet: { select: { id: true, name: true } },
        status: true,
        assignedTo: { select: { id: true, name: true } },
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } },
        },
      },
    }),
    prisma.outreachStatus.findMany({ orderBy: { order: 'asc' } }),
  ])

  if (!school) notFound()

  const extra = school.extra as Record<string, string>

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-5">
      <Link href={`/sheets/${school.sheet.id}`} className="mb-3 inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={13} /> Back to {school.sheet.name}
      </Link>

      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{school.name}</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {[school.district, REGION_LABELS[school.regionCategory], LIST_LABELS[school.listType]]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {school.status && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: school.status.hex, color: '#fff' }}
          >
            {school.status.name}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Type" value={ENTITY_LABELS[school.entityType]} />
            <Field label="Finance type" value={school.financeType} />
            <Field label="Board" value={school.schoolType} />
            <Field label="Student strength" value={school.studentStrength} />
            <Field label="Registered students" value={school.registeredStudents} />
            <Field label="State" value={school.state} />
            <Field label="Primary POC" value={school.primaryPoc} />
            <Field label="Connection" value={school.connection} />
            <Field label="POC from school" value={school.pocName} />
            <Field
              label="Contact"
              value={school.contact ? <a href={`tel:${school.contact}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{school.contact}</a> : null}
            />
            <Field
              label="Mail"
              value={school.email ? <a href={`mailto:${school.email}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{school.email}</a> : null}
            />
            <Field label="Assigned to" value={school.assignedTo?.name} />
          </div>

          {school.address && (
            <div className="mt-3">
              <Field label="Address" value={school.address} />
            </div>
          )}
          {school.website && (
            <div className="mt-3">
              <Field
                label="Website"
                value={<a href={school.website} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>{school.website}</a>}
              />
            </div>
          )}
          {school.remarks && (
            <div className="mt-3">
              <Field label="Remarks" value={school.remarks} />
            </div>
          )}

          {Object.keys(extra).length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                From the imported file
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(extra).map(([k, v]) => (
                  <Field key={k} label={k.replace(/_/g, ' ')} value={v} />
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="space-y-4">
          <ContactsPanel
            schoolId={school.id}
            primary={school.contact}
            contacts={(school.contacts as ContactEntry[]) ?? []}
          />

          <LogCallPanel
            schoolId={school.id}
            statuses={statuses}
            currentStatusId={school.statusId}
            nextFollowUpAt={school.nextFollowUpAt ? school.nextFollowUpAt.toISOString().slice(0, 10) : ''}
          />

          <section className="card overflow-hidden">
            <h2 className="border-b px-4 py-2.5 text-sm font-semibold">
              History
              <span className="ml-1 font-normal" style={{ color: 'var(--muted)' }}>
                ({school.logs.length})
              </span>
            </h2>
            {school.logs.length === 0 ? (
              <p className="px-4 py-5 text-sm" style={{ color: 'var(--muted)' }}>
                No calls logged yet.
              </p>
            ) : (
              <ul className="thin-scroll max-h-96 overflow-auto">
                {school.logs.map((l) => (
                  <li key={l.id} className="border-b px-4 py-2.5 text-sm last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium uppercase" style={{ color: 'var(--accent)' }}>
                        {l.channel}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {l.createdAt.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {l.fromStatusName !== l.toStatusName && l.toStatusName && (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {l.fromStatusName ?? 'No status'} → {l.toStatusName}
                      </p>
                    )}
                    {l.outcome && <p className="text-xs">{l.outcome}</p>}
                    {l.note && <p className="mt-0.5">{l.note}</p>}
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {l.user?.name ?? 'Someone'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
