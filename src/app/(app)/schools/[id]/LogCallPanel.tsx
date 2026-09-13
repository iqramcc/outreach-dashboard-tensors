'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall } from 'lucide-react'

type Status = { id: string; name: string; hex: string }

const CHANNELS = [
  ['CALL', 'Call'],
  ['WHATSAPP', 'WhatsApp'],
  ['EMAIL', 'Email'],
  ['VISIT', 'Visit'],
  ['OTHER', 'Other'],
] as const

/**
 * Log one outreach attempt. Status, note and the next follow-up date are set
 * together in a single action - the team is working down a call list, so this
 * has to be one interaction, not three.
 */
export default function LogCallPanel({
  schoolId,
  statuses,
  currentStatusId,
  nextFollowUpAt,
}: {
  schoolId: string
  statuses: Status[]
  currentStatusId: string | null
  nextFollowUpAt: string
}) {
  const router = useRouter()
  const [channel, setChannel] = useState<string>('CALL')
  const [statusId, setStatusId] = useState(currentStatusId ?? '')
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState(nextFollowUpAt)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId,
        channel,
        outcome: outcome || null,
        note: note || null,
        nextFollowUpAt: followUp || null,
        statusId: statusId || null,
      }),
    })
    setBusy(false)
    if (res.ok) {
      setOutcome('')
      setNote('')
      router.refresh()
    } else {
      alert('Could not save that log')
    }
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <PhoneCall size={15} style={{ color: 'var(--accent)' }} />
        Log an attempt
      </h2>

      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1">
          {CHANNELS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setChannel(v)}
              className="rounded-md border px-2 py-1 text-xs"
              style={channel === v ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' } : { color: 'var(--muted)' }}
            >
              {l}
            </button>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="lc-status">Move to status</label>
          <select id="lc-status" className="input" value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            <option value="">Leave unchanged</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="lc-outcome">Outcome</label>
          <input
            id="lc-outcome"
            className="input"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="No answer / Spoke to principal / Asked to call later"
          />
        </div>

        <div>
          <label className="label" htmlFor="lc-note">Note</label>
          <textarea id="lc-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div>
          <label className="label" htmlFor="lc-followup">Next follow-up</label>
          <input id="lc-followup" type="date" className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </div>

        <button className="btn btn-primary w-full" onClick={submit} disabled={busy} type="button">
          {busy ? 'Saving...' : 'Save log'}
        </button>
      </div>
    </section>
  )
}
