import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { requireAuth, requireRole } from '../auth';
import { audit, auditStmt, nowIso, uid } from '../db';
import { body, notFound } from '../util';
import { buildFilter, searchStories } from '../search';
import { computeCoverage } from '../analytics';

export const workflow = new Hono<AppEnv>();
workflow.use('*', requireAuth);

const actor = (c: { get: (k: 'user') => { id: string; name: string } }) => ({ id: c.get('user').id, name: c.get('user').name });

async function assertMember(db: D1Database, wsId: string, userId: string) {
  const m = await db.prepare('SELECT 1 AS x FROM memberships WHERE workspace_id = ? AND user_id = ?').bind(wsId, userId).first();
  if (!m) throw new HTTPException(400, { message: 'That person is not a member of this workspace' });
}

// ───────────── Campaigns ─────────────
const campaignBody = z.object({
  name: z.string().trim().min(1).max(150),
  client: z.string().trim().max(150).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['planning', 'active', 'closed']).default('active'),
  query: z.string().trim().max(500).nullable().optional(),
  starts_on: z.string().max(20).nullable().optional(),
  ends_on: z.string().max(20).nullable().optional(),
});

async function campaignCounts(db: D1Database, wsId: string, id: string) {
  const b = await buildFilter(db, wsId, { campaignId: id });
  const r = await db
    .prepare(`SELECT COUNT(*) AS articles, COUNT(DISTINCT a.group_id) AS stories FROM articles a WHERE ${b.where}`)
    .bind(...b.params).first<{ articles: number; stories: number }>();
  return r ?? { articles: 0, stories: 0 };
}

workflow.get('/campaigns', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.campaign_id = c.id AND t.status != 'done') AS open_tasks,
        (SELECT COUNT(*) FROM approvals a WHERE a.campaign_id = c.id AND a.status = 'pending') AS pending_approvals
     FROM campaigns c JOIN users u ON u.id = c.created_by WHERE c.workspace_id = ? ORDER BY c.created_at DESC`,
  ).bind(c.get('wsId')).all<Record<string, unknown>>();
  const out = [];
  for (const r of results) out.push({ ...r, ...(await campaignCounts(c.env.DB, c.get('wsId'), r.id as string)) });
  return c.json({ campaigns: out });
});

workflow.get('/campaigns/compare', async (c) => {
  const ids = (c.req.query('ids') ?? '').split(',').filter(Boolean).slice(0, 6);
  if (ids.length < 2) throw new HTTPException(400, { message: 'Pick at least two campaigns to compare' });
  const from = c.req.query('from');
  const to = c.req.query('to');
  const out = [];
  for (const id of ids) {
    const camp = await c.env.DB.prepare('SELECT id, name, client FROM campaigns WHERE id = ? AND workspace_id = ?').bind(id, c.get('wsId')).first<{ id: string; name: string; client: string | null }>();
    if (!camp) notFound(`Campaign ${id} not found`);
    const cov = await computeCoverage(c.env.DB, c.get('wsId'), { campaignId: id, from, to });
    out.push({
      campaign: camp,
      measured: { articles: cov.measured.articles, stories: cov.measured.stories, outlets: cov.measured.outlets, by_language: cov.measured.by_language, by_kind: cov.measured.by_kind },
      analyst_tagged: cov.analyst_tagged,
      estimated: cov.estimated,
    });
  }
  return c.json({ from, to, campaigns: out });
});

workflow.get('/campaigns/:id', async (c) => {
  const id = c.req.param('id');
  const camp = await c.env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND workspace_id = ?').bind(id, c.get('wsId')).first<Record<string, unknown>>();
  if (!camp) notFound();
  const counts = await campaignCounts(c.env.DB, c.get('wsId'), id);
  const recent = await searchStories(c.env.DB, c.get('wsId'), { campaignId: id }, { limit: 10, offset: 0 });
  const { results: tasks } = await c.env.DB.prepare(
    `SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.campaign_id = ? ORDER BY t.status = 'done', t.due_at IS NULL, t.due_at`,
  ).bind(id).all();
  const { results: reports } = await c.env.DB.prepare('SELECT id, title, status, date_from, date_to, created_at FROM reports WHERE campaign_id = ? ORDER BY created_at DESC').bind(id).all();
  return c.json({ campaign: camp, ...counts, recent: recent.rows, tasks, reports });
});

workflow.post('/campaigns', requireRole('analyst'), async (c) => {
  const b = await body(c, campaignBody);
  const id = uid();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO campaigns (id,workspace_id,name,client,description,status,query,starts_on,ends_on,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, c.get('wsId'), b.name, b.client ?? null, b.description ?? null, b.status, b.query ?? null, b.starts_on ?? null, b.ends_on ?? null, c.get('user').id, nowIso()),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'campaign.created', 'campaign', id, { name: b.name }),
  ]);
  return c.json({ id }, 201);
});

workflow.put('/campaigns/:id', requireRole('analyst'), async (c) => {
  const b = await body(c, campaignBody);
  const id = c.req.param('id');
  const r = await c.env.DB.prepare('UPDATE campaigns SET name=?, client=?, description=?, status=?, query=?, starts_on=?, ends_on=? WHERE id=? AND workspace_id=?')
    .bind(b.name, b.client ?? null, b.description ?? null, b.status, b.query ?? null, b.starts_on ?? null, b.ends_on ?? null, id, c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'campaign.updated', 'campaign', id, { name: b.name, query: b.query ?? null });
  return c.json({ ok: true });
});

workflow.delete('/campaigns/:id', requireRole('manager'), async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM campaigns WHERE id=? AND workspace_id=?').bind(c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'campaign.deleted', 'campaign', c.req.param('id'));
  return c.json({ ok: true });
});

workflow.put('/campaigns/:id/items/:articleId', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({ state: z.enum(['included', 'excluded']) }));
  const id = c.req.param('id');
  const a = await c.env.DB.prepare('SELECT 1 AS x FROM articles WHERE id = ? AND workspace_id = ?').bind(c.req.param('articleId'), c.get('wsId')).first();
  const k = await c.env.DB.prepare('SELECT 1 AS x FROM campaigns WHERE id = ? AND workspace_id = ?').bind(id, c.get('wsId')).first();
  if (!a || !k) notFound();
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO campaign_items (campaign_id,article_id,state,added_by,added_at) VALUES (?,?,?,?,?)
       ON CONFLICT(campaign_id,article_id) DO UPDATE SET state = excluded.state, added_by = excluded.added_by, added_at = excluded.added_at`)
      .bind(id, c.req.param('articleId'), b.state, c.get('user').id, nowIso()),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), `campaign.item_${b.state}`, 'campaign', id, { article_id: c.req.param('articleId') }),
  ]);
  return c.json({ ok: true });
});

workflow.delete('/campaigns/:id/items/:articleId', requireRole('analyst'), async (c) => {
  await c.env.DB.prepare('DELETE FROM campaign_items WHERE campaign_id = ? AND article_id = ? AND campaign_id IN (SELECT id FROM campaigns WHERE workspace_id = ?)')
    .bind(c.req.param('id'), c.req.param('articleId'), c.get('wsId')).run();
  return c.json({ ok: true });
});

// ───────────── Tasks ─────────────
const taskBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  campaign_id: z.string().nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  article_id: z.string().nullable().optional(),
  alert_id: z.string().nullable().optional(),
  status: z.enum(['todo', 'doing', 'done']).optional(),
});

workflow.get('/tasks', async (c) => {
  const where = ['t.workspace_id = ?'];
  const p: unknown[] = [c.get('wsId')];
  if (c.req.query('campaign')) { where.push('t.campaign_id = ?'); p.push(c.req.query('campaign')); }
  if (c.req.query('assignee') === 'me') { where.push('t.assignee_id = ?'); p.push(c.get('user').id); }
  else if (c.req.query('assignee')) { where.push('t.assignee_id = ?'); p.push(c.req.query('assignee')); }
  if (c.req.query('status')) { where.push('t.status = ?'); p.push(c.req.query('status')); }
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, u.name AS assignee_name, k.name AS campaign_name FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN campaigns k ON k.id = t.campaign_id
     WHERE ${where.join(' AND ')} ORDER BY t.status = 'done', t.due_at IS NULL, t.due_at LIMIT 300`,
  ).bind(...p).all();
  return c.json({ tasks: results });
});

async function checkRefs(c: Context<AppEnv>, b: Partial<z.infer<typeof taskBody>>) {
  const wsId = c.get('wsId') as string;
  if (b.assignee_id) await assertMember(c.env.DB, wsId, b.assignee_id);
  if (b.campaign_id && !(await c.env.DB.prepare('SELECT 1 AS x FROM campaigns WHERE id=? AND workspace_id=?').bind(b.campaign_id, wsId).first())) throw new HTTPException(400, { message: 'Unknown campaign' });
  if (b.article_id && !(await c.env.DB.prepare('SELECT 1 AS x FROM articles WHERE id=? AND workspace_id=?').bind(b.article_id, wsId).first())) throw new HTTPException(400, { message: 'Unknown article' });
  if (b.alert_id && !(await c.env.DB.prepare('SELECT 1 AS x FROM alerts WHERE id=? AND workspace_id=?').bind(b.alert_id, wsId).first())) throw new HTTPException(400, { message: 'Unknown alert' });
}

workflow.post('/tasks', requireRole('analyst'), async (c) => {
  const b = await body(c, taskBody);
  await checkRefs(c, b);
  const id = uid();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO tasks (id,workspace_id,campaign_id,title,description,assignee_id,due_at,status,article_id,alert_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, c.get('wsId'), b.campaign_id ?? null, b.title, b.description ?? null, b.assignee_id ?? null, b.due_at ?? null, b.status ?? 'todo', b.article_id ?? null, b.alert_id ?? null, c.get('user').id, nowIso()),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'task.created', 'task', id, { title: b.title, assignee: b.assignee_id ?? null }),
  ]);
  return c.json({ id }, 201);
});

workflow.patch('/tasks/:id', requireRole('analyst'), async (c) => {
  const b = await body(c, taskBody.partial());
  await checkRefs(c, b);
  const cur = await c.env.DB.prepare('SELECT status FROM tasks WHERE id=? AND workspace_id=?').bind(c.req.param('id'), c.get('wsId')).first<{ status: string }>();
  if (!cur) notFound();
  const map: Record<string, unknown> = { title: b.title, description: b.description, campaign_id: b.campaign_id, assignee_id: b.assignee_id, due_at: b.due_at, status: b.status };
  if (b.status && b.status !== cur.status) map.completed_at = b.status === 'done' ? nowIso() : null;
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) return c.json({ ok: true });
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE tasks SET ${keys.map((k) => `${k}=?`).join(', ')} WHERE id=? AND workspace_id=?`).bind(...keys.map((k) => map[k]), c.req.param('id'), c.get('wsId')),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'task.updated', 'task', c.req.param('id'), { fields: keys, status: b.status, assignee: b.assignee_id }),
  ]);
  return c.json({ ok: true });
});

workflow.delete('/tasks/:id', requireRole('manager'), async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM tasks WHERE id=? AND workspace_id=?').bind(c.req.param('id'), c.get('wsId')).run();
  if (!r.meta.changes) notFound();
  await audit(c.env.DB, c.get('wsId'), actor(c), 'task.deleted', 'task', c.req.param('id'));
  return c.json({ ok: true });
});

// ───────────── Notes ─────────────
const NOTE_TABLE: Record<string, string> = { campaign: 'campaigns', article: 'articles', contact: 'contacts', alert: 'alerts', task: 'tasks', report: 'reports' };

workflow.get('/notes', async (c) => {
  const t = c.req.query('type') ?? '';
  const id = c.req.query('id') ?? '';
  if (!NOTE_TABLE[t] || !id) throw new HTTPException(400, { message: 'type and id are required' });
  // Contact notes are personal-data adjacent: same gate as the contacts API.
  if (t === 'contact' && c.get('role') === 'viewer') throw new HTTPException(403, { message: 'Not permitted' });
  const { results } = await c.env.DB.prepare(
    `SELECT n.id, n.body, n.created_at, u.name AS author FROM notes n JOIN users u ON u.id = n.author_id
     WHERE n.workspace_id = ? AND n.entity_type = ? AND n.entity_id = ? ORDER BY n.created_at`,
  ).bind(c.get('wsId'), t, id).all();
  return c.json({ notes: results });
});

workflow.post('/notes', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({ entity_type: z.enum(['campaign', 'article', 'contact', 'alert', 'task', 'report']), entity_id: z.string().min(1), body: z.string().trim().min(1).max(4000) }));
  const exists = await c.env.DB.prepare(`SELECT 1 AS x FROM ${NOTE_TABLE[b.entity_type]} WHERE id = ? AND workspace_id = ?`).bind(b.entity_id, c.get('wsId')).first();
  if (!exists) notFound();
  const id = uid();
  await c.env.DB.prepare('INSERT INTO notes (id,workspace_id,entity_type,entity_id,body,author_id,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id, c.get('wsId'), b.entity_type, b.entity_id, b.body, c.get('user').id, nowIso()).run();
  return c.json({ id }, 201);
});

// ───────────── Approvals ─────────────
export async function startApproval(
  db: D1Database,
  wsId: string,
  by: { id: string; name: string },
  a: { campaign_id?: string | null; subject_type: 'report' | 'statement' | 'other'; subject_id?: string | null; title: string; body?: string | null; approver_ids: string[] },
): Promise<string> {
  const approvers = a.approver_ids;
  if (!approvers.length) throw new HTTPException(400, { message: 'Choose at least one approver' });
  for (const u of new Set(approvers)) await assertMember(db, wsId, u);
  const id = uid();
  const stmts = [
    db.prepare('INSERT INTO approvals (id,workspace_id,campaign_id,subject_type,subject_id,title,body,requested_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id, wsId, a.campaign_id ?? null, a.subject_type, a.subject_id ?? null, a.title, a.body ?? null, by.id, nowIso()),
    ...approvers.map((u, i) => db.prepare('INSERT INTO approval_steps (id,approval_id,step_order,approver_id) VALUES (?,?,?,?)').bind(uid(), id, i + 1, u)),
    auditStmt(db, wsId, by, 'approval.requested', 'approval', id, { title: a.title, approvers, subject: a.subject_type }),
  ];
  await db.batch(stmts);
  return id;
}

workflow.get('/approvals', async (c) => {
  const status = c.req.query('status');
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, u.name AS requested_by_name, k.name AS campaign_name FROM approvals a
     JOIN users u ON u.id = a.requested_by LEFT JOIN campaigns k ON k.id = a.campaign_id
     WHERE a.workspace_id = ? ${status ? 'AND a.status = ?' : ''} ORDER BY a.created_at DESC LIMIT 100`,
  ).bind(c.get('wsId'), ...(status ? [status] : [])).all<Record<string, unknown>>();
  const out = [];
  for (const a of results) {
    const { results: steps } = await c.env.DB.prepare(
      `SELECT s.step_order, s.approver_id, s.status, s.comment, s.decided_at, u.name AS approver_name FROM approval_steps s
       JOIN users u ON u.id = s.approver_id WHERE s.approval_id = ? ORDER BY s.step_order`,
    ).bind(a.id).all<{ step_order: number; approver_id: string; status: string }>();
    const current = a.status === 'pending' ? steps.find((s) => s.status === 'pending') : undefined;
    out.push({ ...a, steps, awaiting_user_id: current?.approver_id ?? null, can_decide: current?.approver_id === c.get('user').id });
  }
  return c.json({ approvals: out });
});

workflow.post('/approvals', requireRole('analyst'), async (c) => {
  const b = await body(c, z.object({
    title: z.string().trim().min(1).max(200), body: z.string().trim().max(4000).nullable().optional(),
    campaign_id: z.string().nullable().optional(), subject_type: z.enum(['statement', 'other']).default('statement'),
    approver_ids: z.array(z.string()).min(1).max(5),
  }));
  const id = await startApproval(c.env.DB, c.get('wsId'), actor(c), b);
  return c.json({ id }, 201);
});

workflow.post('/approvals/:id/decide', async (c) => {
  const b = await body(c, z.object({ decision: z.enum(['approved', 'changes_requested', 'rejected']), comment: z.string().trim().max(2000).optional() }));
  if (b.decision !== 'approved' && !b.comment) throw new HTTPException(400, { message: 'Add a comment explaining what needs to change' });
  const id = c.req.param('id');
  const wsId = c.get('wsId');
  const ap = await c.env.DB.prepare('SELECT * FROM approvals WHERE id=? AND workspace_id=?').bind(id, wsId).first<{ status: string; subject_type: string; subject_id: string | null; title: string }>();
  if (!ap) notFound();
  if (ap.status !== 'pending') throw new HTTPException(409, { message: `This approval is already ${ap.status}` });
  const { results: steps } = await c.env.DB.prepare('SELECT id, step_order, approver_id, status FROM approval_steps WHERE approval_id = ? ORDER BY step_order').bind(id).all<{ id: string; step_order: number; approver_id: string; status: string }>();
  const cur = steps.find((s) => s.status === 'pending');
  if (!cur) throw new HTTPException(409, { message: 'No pending step' });
  // Only the named approver for the current step may decide. Not even workspace owners can approve on someone's behalf.
  if (cur.approver_id !== c.get('user').id) throw new HTTPException(403, { message: 'This step is waiting on a different approver' });

  const last = cur.step_order === steps[steps.length - 1].step_order;
  const final = b.decision === 'approved' ? (last ? 'approved' : 'pending') : b.decision;
  const stmts = [
    c.env.DB.prepare('UPDATE approval_steps SET status=?, comment=?, decided_at=? WHERE id=?').bind(b.decision, b.comment ?? null, nowIso(), cur.id),
    c.env.DB.prepare('UPDATE approvals SET status=?, closed_at=? WHERE id=?').bind(final, final === 'pending' ? null : nowIso(), id),
    auditStmt(c.env.DB, wsId, actor(c), `approval.${b.decision}`, 'approval', id, { step: cur.step_order, comment: b.comment ?? null, title: ap.title }),
  ];
  if (ap.subject_type === 'report' && ap.subject_id && final !== 'pending') {
    stmts.push(c.env.DB.prepare(`UPDATE reports SET status = ? WHERE id = ? AND workspace_id = ? AND status = 'in_review'`)
      .bind(final === 'approved' ? 'approved' : 'draft', ap.subject_id, wsId));
  }
  await c.env.DB.batch(stmts);
  return c.json({ status: final });
});

workflow.post('/approvals/:id/cancel', requireRole('analyst'), async (c) => {
  const id = c.req.param('id');
  const ap = await c.env.DB.prepare('SELECT requested_by, status, subject_type, subject_id FROM approvals WHERE id=? AND workspace_id=?').bind(id, c.get('wsId')).first<{ requested_by: string; status: string; subject_type: string; subject_id: string | null }>();
  if (!ap) notFound();
  if (ap.status !== 'pending') throw new HTTPException(409, { message: `Already ${ap.status}` });
  if (ap.requested_by !== c.get('user').id && c.get('role') !== 'owner' && c.get('role') !== 'manager') throw new HTTPException(403, { message: 'Only the requester or a manager can cancel' });
  const stmts = [
    c.env.DB.prepare(`UPDATE approvals SET status='cancelled', closed_at=? WHERE id=?`).bind(nowIso(), id),
    auditStmt(c.env.DB, c.get('wsId'), actor(c), 'approval.cancelled', 'approval', id),
  ];
  if (ap.subject_type === 'report' && ap.subject_id) stmts.push(c.env.DB.prepare(`UPDATE reports SET status='draft' WHERE id=? AND workspace_id=? AND status='in_review'`).bind(ap.subject_id, c.get('wsId')));
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});
