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

const app = new Hono<AppEnv>();

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
      runIngest(env.DB, { trigger: 'cron' }).then(
        (s) => console.log('ingest', JSON.stringify(s)),
        (e) => console.error('ingest failed', e),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
