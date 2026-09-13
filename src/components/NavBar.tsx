'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { BarChart3, Columns3, Mail, LayoutDashboard, LogOut, Menu, Settings, Table2, Upload, X } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

type Sheet = { id: string; name: string }

export default function NavBar({
  user,
  sheets,
}: {
  user: { name: string; role: string }
  sheets: Sheet[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const isAdmin = user.role === 'ADMIN'

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/sheets', label: 'Sheets', icon: Table2 },
    { href: '/columns', label: 'Columns', icon: Columns3 },
    ...(isAdmin ? [{ href: '/import', label: 'Import', icon: Upload }] : []),
    ...(isAdmin ? [{ href: '/admin/campaigns', label: 'Lists', icon: Mail }] : []),
    ...(isAdmin ? [{ href: '/admin/progress', label: 'Progress', icon: BarChart3 }] : []),
    ...(isAdmin ? [{ href: '/admin/users', label: 'Team', icon: Settings }] : []),
  ]

  function active(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    // refresh() discards the cached server render of the signed-in shell, so
    // the next paint cannot briefly show the previous user's data.
    router.replace('/login')
    router.refresh()
  }

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
          <span
            className="grid h-6 w-6 place-items-center rounded-md text-xs font-bold"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            T
          </span>
          <span className="hidden sm:inline">Tensors</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-0.5 md:flex">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="btn btn-ghost"
              style={
                active(href)
                  ? {
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      borderColor: 'transparent',
                    }
                  : { border: 'none', background: 'transparent' }
              }
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs sm:inline" style={{ color: 'var(--muted)' }}>
            {user.name}
            {isAdmin && (
              <span
                className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                ADMIN
              </span>
            )}
          </span>
          <ThemeToggle />
          <button onClick={logout} className="btn btn-ghost px-2" title="Sign out" type="button">
            <LogOut size={15} />
          </button>
          <button
            className="btn btn-ghost px-2 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            type="button"
          >
            {open ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t px-3 py-2 md:hidden" style={{ borderColor: 'var(--border)' }}>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm"
              style={active(href) ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : {}}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
          <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
            <p className="px-2 text-xs" style={{ color: 'var(--muted)' }}>
              Sheets
            </p>
            {sheets.slice(0, 20).map((s) => (
              <Link
                key={s.id}
                href={`/sheets/${s.id}`}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-1.5 text-sm"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
