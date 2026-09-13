import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tensors | Junior Olympiad Dashboard',
  description: 'School outreach tracking for the Tensors Junior Olympiad.',
}

/**
 * The inline script sets the theme before first paint. Without it the page
 * flashes white before switching to dark, on every navigation.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('tensors-theme');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
