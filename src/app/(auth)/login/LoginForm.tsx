'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not sign in')
        return
      }
      // Full navigation so the server layout re-reads the new session cookie.
      window.location.href = params.get('next') || '/'
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-5 space-y-3.5" style={{ boxShadow: 'var(--shadow)' }}>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary w-full" disabled={busy} type="submit">
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        No account? Ask a Tensors admin to add you.
      </p>
    </form>
  )
}
