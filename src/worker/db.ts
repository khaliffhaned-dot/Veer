// Small D1 helpers. All SQL elsewhere uses bound parameters; never string-interpolate user input.

export const uid = (): string => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

export const nowIso = (): string => new Date().toISOString();

export function jparse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export interface Actor {
  id: string | null;
  name: string;
}
export const SYSTEM: Actor = { id: null, name: 'system' };

/** Statement for the append-only audit log; add to a batch so it commits with the change itself. */
export function auditStmt(
  db: D1Database,
  wsId: string,
  actor: Actor,
  action: string,
  entityType: string | null,
  entityId: string | null,
  detail: Record<string, unknown> = {},
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_log (id, workspace_id, at, user_id, actor, action, entity_type, entity_id, detail)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .bind(uid(), wsId, nowIso(), actor.id, actor.name, action, entityType, entityId, JSON.stringify(detail));
}

export async function audit(
  db: D1Database,
  wsId: string,
  actor: Actor,
  action: string,
  entityType: string | null,
  entityId: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await auditStmt(db, wsId, actor, action, entityType, entityId, detail).run();
}

export function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
