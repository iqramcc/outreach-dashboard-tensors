'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, UserPlus, Users } from 'lucide-react'

type Row = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  assigned: number
  logs: number
}

export default function UsersAdmin({ meId, users }: { meId: string; users: Row[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'list' | 'bulk' | 'single'>('list')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [bulk, setBulk] = useState('')
  const [bulkRole, setBulkRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER')
  const [created, setCreated] = useState<{ name: string; email: string; password: string }[]>([])
  const [skipped, setSkipped] = useState<{ line: string; reason: string }[]>([])

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MEMBER' })

  async function addBulk() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk, role: bulkRole }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not add those users')
      return
    }
    setCreated(data.created)
    setSkipped(data.skipped)
    setBulk('')
    router.refresh()
  }

  async function addSingle() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not add that user')
      return
    }
    setForm({ name: '', email: '', password: '', role: 'MEMBER' })
    setTab('list')
    router.refresh()
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true)
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Could not update')
      return
    }
    router.refresh()
  }

  async function resetPassword(id: string, name: string) {
    const pw = prompt(`New password for ${name} (at least 6 characters):`)
    if (!pw) return
    if (pw.length < 6) {
      alert('Use at least 6 characters')
      return
    }
    await patch(id, { password: pw })
    alert(`Password for ${name} is now: ${pw}`)
  }

  const credentialsText = created
    .map((c) => `${c.name} — ${c.email} — ${c.password}`)
    .join('\n')

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Team</h1>
        <nav className="ml-auto flex gap-1">
          <Link href="/admin/users" className="btn btn-ghost" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            Users
          </Link>
          <Link href="/admin/columns" className="btn btn-ghost">Columns</Link>
        </nav>
      </div>

      <div className="mb-3 flex gap-1">
        {([
          ['list', 'All users', Users],
          ['bulk', 'Add many', UserPlus],
          ['single', 'Add one', UserPlus],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            className="btn btn-ghost"
            style={tab === key ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : {}}
            onClick={() => setTab(key)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 text-sm" style={{ color: 'var(--danger)' }} role="alert">{error}</p>
      )}

      {tab === 'list' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Email</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Role</th>
                <th className="px-3 py-2 text-right text-xs font-medium">Assigned</th>
                <th className="px-3 py-2 text-right text-xs font-medium">Calls</th>
                <th className="px-3 py-2 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: 'var(--border)', opacity: u.isActive ? 1 : 0.5 }}>
                  <td className="px-3 py-2">
                    {u.name}
                    {u.id === meId && <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>(you)</span>}
                    {!u.isActive && <span className="ml-1 text-xs" style={{ color: 'var(--danger)' }}>deactivated</span>}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      className="input py-0.5 text-xs"
                      value={u.role}
                      disabled={u.id === meId || busy}
                      onChange={(e) => patch(u.id, { role: e.target.value })}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.assigned}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.logs}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn btn-ghost py-0.5 text-xs" onClick={() => resetPassword(u.id, u.name)} disabled={busy} type="button">
                      Reset password
                    </button>
                    {u.id !== meId && (
                      <button
                        className="btn btn-ghost ml-1 py-0.5 text-xs"
                        onClick={() => patch(u.id, { isActive: !u.isActive })}
                        disabled={busy}
                        type="button"
                      >
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bulk' && (
        <div className="card p-4">
          <p className="label">Paste your team, one per line</p>
          <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
            <code>Name, email@example.com</code> — or just an email address. A password is generated
            for each person and shown once below, so copy them before leaving this page.
          </p>
          <textarea
            className="input font-mono text-xs"
            rows={10}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'Ikram, ikram@tensors.org\nAmal, amal@tensors.org\nfathima@tensors.org'}
          />
          <div className="mt-2 flex items-center gap-2">
            <select className="input w-40" value={bulkRole} onChange={(e) => setBulkRole(e.target.value as 'MEMBER' | 'ADMIN')}>
              <option value="MEMBER">Add as members</option>
              <option value="ADMIN">Add as admins</option>
            </select>
            <button className="btn btn-primary" onClick={addBulk} disabled={busy || !bulk.trim()} type="button">
              {busy ? 'Adding...' : 'Add users'}
            </button>
          </div>

          {created.length > 0 && (
            <div className="mt-4 rounded-md border p-3" style={{ borderColor: 'var(--accent)' }}>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-medium">{created.length} accounts created</p>
                <button
                  className="btn btn-ghost ml-auto py-0.5 text-xs"
                  type="button"
                  onClick={() => navigator.clipboard.writeText(credentialsText)}
                >
                  <Copy size={13} /> Copy all
                </button>
              </div>
              <p className="mb-2 text-xs" style={{ color: 'var(--danger)' }}>
                These passwords are shown only once. Copy them now.
              </p>
              <pre className="thin-scroll max-h-52 overflow-auto rounded p-2 text-xs" style={{ background: 'var(--surface-2)' }}>
                {credentialsText}
              </pre>
            </div>
          )}

          {skipped.length > 0 && (
            <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
              <p className="font-medium">Skipped {skipped.length}:</p>
              <ul className="mt-1 list-inside list-disc">
                {skipped.map((s, i) => (
                  <li key={i}>{s.line} — {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'single' && (
        <div className="card max-w-md space-y-3 p-4">
          <div>
            <label className="label" htmlFor="u-name">Name</label>
            <input id="u-name" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="u-email">Email</label>
            <input id="u-email" type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="u-pw">Password</label>
            <input id="u-pw" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="u-role">Role</label>
            <select id="u-role" className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={addSingle} disabled={busy} type="button">
            Add user
          </button>
        </div>
      )}
    </main>
  )
}
