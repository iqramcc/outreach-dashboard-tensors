'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Plus, Trash2 } from 'lucide-react'

export type ContactEntry = { name: string | null; number: string }

/**
 * A school often answers on several numbers - the office, the principal's
 * mobile, a POC. The primary number stays in its own column (imports and
 * duplicate matching depend on it); everything else is listed here, each with
 * the person's name when it is known.
 */
export default function ContactsPanel({
  schoolId,
  primary,
  contacts: initial,
}: {
  schoolId: string
  primary: string | null
  contacts: ContactEntry[]
}) {
  const router = useRouter()
  const [contacts, setContacts] = useState<ContactEntry[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(next: ContactEntry[]) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/schools/${schoolId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'contacts', value: next }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not save those numbers')
      return
    }
    router.refresh()
  }

  function update(i: number, patch: Partial<ContactEntry>) {
    setContacts((cs) => cs.map((c, n) => (n === i ? { ...c, ...patch } : c)))
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Phone size={15} style={{ color: 'var(--accent)' }} />
        Numbers
      </h2>

      {primary && (
        <div className="mb-2 text-sm">
          <a href={`tel:${primary}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
            {primary}
          </a>
          <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>
            main number
          </span>
        </div>
      )}

      <div className="space-y-2">
        {contacts.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              className="input"
              value={c.number}
              onChange={(e) => update(i, { number: e.target.value })}
              onBlur={() => save(contacts)}
              placeholder="Number"
              aria-label={`Number ${i + 1}`}
            />
            <input
              className="input"
              value={c.name ?? ''}
              onChange={(e) => update(i, { name: e.target.value })}
              onBlur={() => save(contacts)}
              placeholder="Whose? (optional)"
              aria-label={`Name for number ${i + 1}`}
            />
            <button
              type="button"
              className="p-1"
              disabled={busy}
              onClick={() => {
                const next = contacts.filter((_, n) => n !== i)
                setContacts(next)
                save(next)
              }}
              aria-label={`Remove ${c.number || 'this number'}`}
              title="Remove"
            >
              <Trash2 size={14} style={{ color: 'var(--danger)' }} />
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn btn-ghost mt-2 py-1 text-xs"
        onClick={() => setContacts((cs) => [...cs, { name: '', number: '' }])}
        disabled={busy}
      >
        <Plus size={13} /> Add another number
      </button>
    </section>
  )
}
