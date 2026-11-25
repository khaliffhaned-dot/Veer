import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ZodTypeAny, z } from 'zod';
import type { AppEnv } from './env';

export async function body<S extends ZodTypeAny>(c: Context<AppEnv>, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Body must be valid JSON' });
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new HTTPException(400, { message: msg });
  }
  return r.data;
}

export function paging(c: Context<AppEnv>, defLimit = 25, maxLimit = 100) {
  const limit = Math.min(maxLimit, Math.max(1, Number(c.req.query('limit')) || defLimit));
  const offset = Math.max(0, Number(c.req.query('offset')) || 0);
  return { limit, offset };
}

export function notFound(what = 'Not found'): never {
  throw new HTTPException(404, { message: what });
}

/** RFC 4180 CSV with spreadsheet-formula neutralisation (cells starting = + - @ are prefixed with '). */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens Chinese text correctly
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function csvResponse(c: Context<AppEnv>, filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
      'cache-control': 'no-store',
    },
  });
}
