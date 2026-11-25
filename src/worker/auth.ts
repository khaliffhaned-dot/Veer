import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { type AppEnv, type Role, ROLE_RANK } from './env';
import { nowIso, randomToken, sha256Hex } from './db';

const COOKIE = 'veer_session';
const SESSION_DAYS = 14;
// Workers' WebCrypto caps PBKDF2 at 100k iterations.
const PBKDF2_ITER = 100_000;

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const h = await pbkdf2(password, salt, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(h)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterS, saltS, hashS] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const expect = unb64(hashS);
  const got = await pbkdf2(password, unb64(saltS), Number(iterS));
  if (got.length !== expect.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expect[i];
  return diff === 0;
}

export async function createSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(await sha256Hex(token), userId, nowIso(), expires.toISOString())
    .run();
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    expires,
  });
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Reject cross-site state changes: Origin (when sent) must match Host. SameSite=Lax is the second layer. */
export const csrfGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const m = c.req.method;
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
    const origin = c.req.header('origin');
    if (origin) {
      let ok = false;
      try {
        ok = new URL(origin).host === new URL(c.req.url).host;
      } catch {
        ok = false;
      }
      if (!ok) throw new HTTPException(403, { message: 'Cross-origin request blocked' });
    }
  }
  await next();
};

/** Resolves session → user → workspace membership. Sets c.var.user / wsId / role. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) throw new HTTPException(401, { message: 'Not signed in' });
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256Hex(token), nowIso())
    .first<{ id: string; email: string; name: string }>();
  if (!row) throw new HTTPException(401, { message: 'Session expired' });

  const wanted = c.req.header('x-workspace-id');
  const m = wanted
    ? await c.env.DB.prepare('SELECT workspace_id, role FROM memberships WHERE user_id = ? AND workspace_id = ?')
        .bind(row.id, wanted)
        .first<{ workspace_id: string; role: Role }>()
    : await c.env.DB.prepare('SELECT workspace_id, role FROM memberships WHERE user_id = ? ORDER BY created_at LIMIT 1')
        .bind(row.id)
        .first<{ workspace_id: string; role: Role }>();
  if (!m) throw new HTTPException(403, { message: 'No access to this workspace' });

  c.set('user', row);
  c.set('wsId', m.workspace_id);
  c.set('role', m.role);
  await next();
};

export function requireRole(min: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (ROLE_RANK[c.get('role')] < ROLE_RANK[min]) {
      throw new HTTPException(403, { message: `Requires ${min} role or higher` });
    }
    await next();
  };
}

export async function checkLoginRate(db: D1Database, key: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const r = await db
    .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at > ?')
    .bind(key, since)
    .first<{ n: number }>();
  return (r?.n ?? 0) < 10;
}

export async function recordLoginFailure(db: D1Database, key: string): Promise<void> {
  await db.prepare('INSERT INTO login_attempts (key, at) VALUES (?,?)').bind(key, nowIso()).run();
  // opportunistic cleanup
  await db
    .prepare('DELETE FROM login_attempts WHERE at < ?')
    .bind(new Date(Date.now() - 3600_000).toISOString())
    .run();
}
