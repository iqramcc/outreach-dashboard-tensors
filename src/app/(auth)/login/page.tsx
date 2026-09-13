import { Suspense } from 'react'
import LoginForm from './LoginForm'

export const metadata = { title: 'Sign in | Tensors' }

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div
            className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl text-lg font-bold"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            T
          </div>
          <h1 className="text-xl font-semibold">Tensors</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Junior Olympiad outreach dashboard
          </p>
        </div>
        {/* LoginForm reads ?next= via useSearchParams, which opts it into
            client rendering; the boundary lets the rest of the page prerender. */}
        <Suspense fallback={<div className="card p-5 h-64" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
