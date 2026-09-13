import 'server-only'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'
import { prisma } from './db'

export const SESSION_COOKIE = 'tensors_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set - copy .env.example to .env')
  return s
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signToken(user: SessionUser): string {
  return jwt.sign(user, secret(), { expiresIn: MAX_AGE_SECONDS })
}

export async function setSessionCookie(token: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/**
 * Verifies the cookie signature AND re-reads the user, so deactivating someone
 * in /admin/users locks them out immediately instead of when their token
 * happens to expire.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  let payload: SessionUser
  try {
    payload = jwt.verify(token, secret()) as SessionUser
  } catch {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  if (!user || !user.isActive) return null

  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

/** For pages. Redirects to login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) redirect('/login')
  return user
}

/**
 * For pages. The proxy only checks that a cookie exists - this is the real
 * server-side gate, so hiding an admin link in the UI is never the only thing
 * standing between a MEMBER and an admin screen.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') redirect('/?error=admin-only')
  return user
}

/** For route handlers - returns a 401/403 Response instead of redirecting. */
export async function apiUser(): Promise<
  { user: SessionUser; error: null } | { user: null; error: Response }
> {
  const user = await getSession()
  if (!user) {
    return {
      user: null,
      error: Response.json({ error: 'Not signed in' }, { status: 401 }),
    }
  }
  return { user, error: null }
}

export async function apiAdmin(): Promise<
  { user: SessionUser; error: null } | { user: null; error: Response }
> {
  const result = await apiUser()
  if (result.error) return result
  if (result.user.role !== 'ADMIN') {
    return {
      user: null,
      error: Response.json({ error: 'Admins only' }, { status: 403 }),
    }
  }
  return result
}
