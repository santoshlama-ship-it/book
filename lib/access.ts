import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'coverdesk_access';
const SESSION_SECONDS = 60 * 60 * 12;
export type AccessMode = 'covers' | 'books';
const coverPassword = () => process.env.ACCESS_PASSWORD || 'Book@2026';
const bookPassword = () => process.env.BOOK_ACCESS_PASSWORD || 'All@2026';
const signingSecret = () => process.env.ACCESS_SESSION_SECRET || `coverdesk:${coverPassword()}:${bookPassword()}:session`;
const signature = (payload: string) => createHmac('sha256', signingSecret()).update(payload).digest('base64url');
function safeEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

export function accessModeForPassword(password: string): AccessMode | null {
  if (safeEqual(password, coverPassword())) return 'covers';
  if (safeEqual(password, bookPassword())) return 'books';
  return null;
}
export async function grantAccess(mode: AccessMode) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = Buffer.from(JSON.stringify({ expires, mode })).toString('base64url');
  (await cookies()).set(COOKIE_NAME, `${payload}.${signature(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
}
export async function getAccessMode(): Promise<AccessMode | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;
  const [payload, supplied] = value.split('.');
  if (!payload || !supplied || !safeEqual(supplied, signature(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { expires?: number; mode?: AccessMode };
    return typeof data.expires === 'number' && data.expires > Math.floor(Date.now() / 1000) && (data.mode === 'covers' || data.mode === 'books') ? data.mode : null;
  } catch { return null; }
}
export async function hasAccess(mode?: AccessMode) { const current = await getAccessMode(); return mode ? current === mode : current !== null; }
export async function clearAccess() { (await cookies()).delete(COOKIE_NAME); }
export function sameOrigin(request: Request) { const origin = request.headers.get('origin'); return !origin || origin === new URL(request.url).origin; }
