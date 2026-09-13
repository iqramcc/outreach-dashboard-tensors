'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

/**
 * The theme lives on <html data-theme>, set by the inline script in the root
 * layout before first paint. React reads it from there rather than keeping its
 * own copy, so there is no second source of truth and no setState-in-effect.
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/** The server has no DOM; the inline script corrects this before paint. */
function getServerSnapshot(): Theme {
  return 'light'
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const next: Theme = getSnapshot() === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('tensors-theme', next)
    } catch {
      // Private mode - the theme just won't persist between visits.
    }
    listeners.forEach((l) => l())
  }, [])

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost px-2"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      type="button"
      suppressHydrationWarning
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
