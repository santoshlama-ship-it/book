import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'coverdesk_access';
const SESSION_SECONDS = 60 * 60 * 12;
const configuredPassword = () => process.env.ACCESS_PASSWORD || 'Book@2026';
const signingSecret = () => process.env.ACCESS_SESSION_SECRET || `coverdesk:${configuredPassword()}:session`;
const signature = (payload: string) => createHmac('sha256', signingSecret()).update(payload).digest('base64url');
function safeEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

export function passwordIsValid(password: string) { return safeEqual(password, configuredPassword()); }
export async function grantAccess() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = Buffer.from(JSON.stringify({ expires })).toString('base64url');
  (await cookies()).set(COOKIE_NAME, `${payload}.${signature(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
}
export async function hasAccess() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return false;
  const [payload, supplied] = value.split('.');
  if (!payload || !supplied || !safeEqual(supplied, signature(payload))) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { expires?: number }; return typeof data.expires === 'number' && data.expires > Math.floor(Date.now() / 1000); } catch { return false; }
}
export async function clearAccess() { (await cookies()).delete(COOKIE_NAME); }
export function sameOrigin(request: Request) { const origin = request.headers.get('origin'); return !origin || origin === new URL(request.url).origin; }
