import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv, Env } from './env';
import { csrfGuard } from './auth';
import { authRoutes, wsRoutes } from './routes/auth';
import { coverage } from './routes/coverage';
import { contacts } from './routes/contacts';
import { workflow } from './routes/workflow';
import { alerts, auditRoutes, dashboard } from './routes/alerts';
import { reports, publicReports } from './routes/reports';
import { runIngest } from './ingest';
import { ai } from './routes/ai';
import { requireAuth } from './auth';
import { makePublish } from './realtime';
import { enrichHook } from './hooks';
import { purgeExpired } from './maintenance';

export { WorkspaceHub } from './hub';

const app = new Hono<AppEnv>();

// Request id + one structured log line per request (visible in Workers Logs / Logpush).
app.use('*', async (c, next) => {
  const id = c.req.header('cf-ray') ?? crypto.randomUUID();
  const t0 = Date.now();
  await next();
  c.header('x-request-id', id);
  console.log(JSON.stringify({ rid: id, method: c.req.method, path: new URL(c.req.url).pathname, status: c.res.status, ms: Date.now() - t0 }));
});

app.use('*', async (c, next) => {
  await next();
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'no-referrer');
  c.header('x-frame-options', 'DENY');
});

const api = new Hono<AppEnv>();
api.use('*', csrfGuard);
api.get('/health', (c) => c.json({ ok: true }));
api.route('/auth', authRoutes);
api.route('/workspace', wsRoutes);
api.route('/public', publicReports);
api.route('/contacts', contacts);
api.route('/reports', reports);
api.route('/alerts', alerts);
api.route('/audit', auditRoutes);
api.route('/dashboard', dashboard);
api.route('/ai', ai);
api.get('/realtime', requireAuth, async (c) => {
  if (c.req.header('upgrade') !== 'websocket') return c.json({ error: 'Expected a WebSocket upgrade' }, 426);
  // Browsers do not apply CORS to WebSockets, so the Origin must be checked explicitly.
  const origin = c.req.header('origin');
  if (!origin || new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: 'Cross-origin WebSocket blocked' }, 403);
  return c.env.HUB.get(c.env.HUB.idFromName(c.get('wsId'))).fetch(new Request('https://hub/ws', c.req.raw));
});
api.route('/', coverage);
api.route('/', workflow);

app.route('/api', api);

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found' }, 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  // Never leak internals to clients; the detail goes to Workers logs.
  console.error('unhandled', c.req.method, c.req.path, err);
  return c.json({ error: 'Something went wrong on our side' }, 500);
});

export default {
  fetch: app.fetch,
  // Cron: capture feeds, dedupe, then evaluate alert rules (see wrangler.jsonc triggers).
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runIngest(env.DB, { trigger: 'cron', hooks: { publish: makePublish(env), enrich: enrichHook(env) } })
        .then((s) => console.log('ingest', JSON.stringify(s)))
        .catch((e) => console.error('ingest failed', e))
        .then(() => purgeExpired(env.DB))
        .then((p) => console.log('maintenance', JSON.stringify(p)), (e) => console.error('maintenance failed', e)),
    );
  },
} satisfies ExportedHandler<Env>;
