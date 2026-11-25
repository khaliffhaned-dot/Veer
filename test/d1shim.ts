// Minimal D1Database implementation over node:sqlite, so tests run the real SQL + FTS5 + migration.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

class Stmt {
  private args: unknown[] = [];
  constructor(private db: DatabaseSync, readonly sql: string) {}
  bind(...a: unknown[]) {
    this.args = a.map((x) => (x === undefined ? null : x));
    return this;
  }
  async first<T>(col?: string): Promise<T | null> {
    const r = this.db.prepare(this.sql).get(...(this.args as never[])) as Record<string, unknown> | undefined;
    if (!r) return null;
    return (col ? r[col] : { ...r }) as T;
  }
  async all<T>() {
    const results = this.db.prepare(this.sql).all(...(this.args as never[])).map((r) => ({ ...r })) as T[];
    return { results, success: true, meta: {} };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...(this.args as never[]));
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

export function makeDb(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(join(dir, f), 'utf8'));
  const shim = {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql: string) => db.exec(sql),
  };
  return shim as unknown as D1Database;
}
