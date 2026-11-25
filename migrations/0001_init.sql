-- Veer: Malaysian media intelligence. D1 (SQLite) schema.
-- Conventions: ids are random text (hex); times are ISO-8601 UTC strings.

-- ───────────── Identity & tenancy ─────────────
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  alert_webhook_url TEXT,            -- optional https webhook for alerts
  alert_webhook_secret TEXT,         -- HMAC signing secret for the webhook
  require_approval_to_share INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE memberships (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','analyst','viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,       -- SHA-256 of the cookie token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE login_attempts (
  key TEXT NOT NULL,                 -- "email|ip"
  at TEXT NOT NULL
);
CREATE INDEX idx_login_attempts_key ON login_attempts(key, at);

-- ───────────── Outlets (media organisations) ─────────────
-- An outlet may optionally have an RSS/Atom feed we can poll. Print and broadcast
-- outlets normally have no feed; their coverage comes in via manual/CSV clippings.
CREATE TABLE outlets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('online','print','broadcast','blog','social','wire')),
  languages TEXT NOT NULL DEFAULT '[]',        -- JSON array: ms,en,zh,ta
  state TEXT,                                  -- Malaysian state / territory, or NULL = national
  city TEXT,
  website TEXT,
  audience_estimate INTEGER,                   -- analyst-entered, optional
  audience_source TEXT,                        -- where that number came from
  audience_as_of TEXT,
  notes TEXT,
  -- feed capture
  feed_url TEXT,
  feed_enabled INTEGER NOT NULL DEFAULT 0,
  feed_last_attempt_at TEXT,
  feed_last_success_at TEXT,
  feed_last_error TEXT,
  feed_consecutive_failures INTEGER NOT NULL DEFAULT 0,
  -- provenance of the outlet record itself
  info_source TEXT,
  info_verified_at TEXT,
  info_verified_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, name)
);
CREATE INDEX idx_outlets_ws ON outlets(workspace_id);

-- ───────────── Articles / coverage ─────────────
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  outlet_id TEXT REFERENCES outlets(id) ON DELETE SET NULL,
  outlet_name TEXT NOT NULL,                   -- denormalised so renames/deletes keep history
  kind TEXT NOT NULL CHECK (kind IN ('online','print','broadcast','blog','social','wire')),
  origin TEXT NOT NULL CHECK (origin IN ('feed','manual','import','demo')),
  url TEXT,
  canonical_url TEXT,
  title TEXT NOT NULL,
  snippet TEXT,                                -- short excerpt only; we link out, we do not republish
  language TEXT NOT NULL CHECK (language IN ('ms','en','zh','ta','mixed','unknown')),
  language_confidence REAL,
  published_at TEXT,                           -- as stated by the source; NULL if the source gave none
  fetched_at TEXT NOT NULL,
  ts TEXT NOT NULL,                            -- published_at if known, else fetched_at (used for all date filtering)
  group_id TEXT NOT NULL,                      -- story group; = id of the first article in the group
  search_text TEXT NOT NULL,                   -- normalised, CJK char-spaced text fed to FTS
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative','mixed')), -- analyst-tagged only
  sentiment_by TEXT REFERENCES users(id),
  sentiment_at TEXT,
  UNIQUE (workspace_id, canonical_url)
);
CREATE INDEX idx_articles_ws_ts ON articles(workspace_id, ts);
CREATE INDEX idx_articles_group ON articles(workspace_id, group_id);
CREATE INDEX idx_articles_outlet ON articles(outlet_id);

CREATE VIRTUAL TABLE articles_fts USING fts5(
  search_text,
  content='articles',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;
CREATE TRIGGER articles_ad AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, search_text) VALUES ('delete', old.rowid, old.search_text);
END;
CREATE TRIGGER articles_au AFTER UPDATE OF search_text ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, search_text) VALUES ('delete', old.rowid, old.search_text);
  INSERT INTO articles_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;

CREATE TABLE ingest_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  feeds_attempted INTEGER NOT NULL DEFAULT 0,
  feeds_failed INTEGER NOT NULL DEFAULT 0,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  trigger TEXT NOT NULL DEFAULT 'cron'
);
CREATE INDEX idx_ingest_runs_ws ON ingest_runs(workspace_id, started_at);

-- ───────────── Entities (brands, competitors, spokespeople, topics) ─────────────
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('brand','competitor','spokesperson','topic')),
  aliases TEXT NOT NULL DEFAULT '[]',          -- JSON: names across ms / en / zh / abbreviations
  excludes TEXT NOT NULL DEFAULT '[]',         -- JSON: terms that disqualify a match (homonyms)
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, name)
);

CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters TEXT NOT NULL DEFAULT '{}',          -- JSON: languages, kinds, outlet ids
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- ───────────── Contacts ─────────────
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  outlet_id TEXT REFERENCES outlets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title TEXT,
  beats TEXT NOT NULL DEFAULT '[]',            -- JSON array
  languages TEXT NOT NULL DEFAULT '[]',        -- JSON array
  location TEXT,
  email TEXT,
  phone TEXT,
  social TEXT,
  do_not_contact INTEGER NOT NULL DEFAULT 0,
  -- provenance: required so nobody mistakes an unsourced row for a verified one
  source_note TEXT NOT NULL,
  source_url TEXT,
  verified_at TEXT,
  verified_by TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_contacts_ws ON contacts(workspace_id);
CREATE INDEX idx_contacts_outlet ON contacts(outlet_id);

CREATE TABLE contact_interactions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('email','call','meeting','message','event','note')),
  summary TEXT NOT NULL,
  at TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_interactions_contact ON contact_interactions(contact_id, at);

-- ───────────── Campaigns & workflow ─────────────
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning','active','closed')),
  query TEXT,                                  -- auto-collect coverage matching this query
  starts_on TEXT,
  ends_on TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- Manual curation on top of the query: include a story the query missed, exclude a false match.
CREATE TABLE campaign_items (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('included','excluded')),
  added_by TEXT NOT NULL REFERENCES users(id),
  added_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, article_id)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT REFERENCES users(id),
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  alert_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_tasks_ws ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id, status);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign','article','contact','alert','task','report')),
  entity_id TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id, created_at);

-- Sequential approval chain: step N becomes actionable only after step N-1 is approved.
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('report','statement','other')),
  subject_id TEXT,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested','rejected','cancelled')),
  requested_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX idx_approvals_ws ON approvals(workspace_id, status);

CREATE TABLE approval_steps (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  approver_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested','rejected')),
  comment TEXT,
  decided_at TEXT,
  UNIQUE (approval_id, step_order)
);

-- ───────────── Reports ─────────────
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',           -- JSON: entity ids, query, sections
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published')),
  snapshot TEXT,                               -- frozen computed data shared with the client
  snapshot_at TEXT,
  share_token_hash TEXT UNIQUE,
  share_expires_at TEXT,
  shared_by TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- ───────────── Alerts ─────────────
CREATE TABLE alert_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('spike','keyword')),
  query TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',           -- spike: window_minutes, baseline_days, multiplier, min_stories, cooldown_minutes
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low','medium','high','critical')),
  enabled INTEGER NOT NULL DEFAULT 1,
  notify_webhook INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_evaluated_at TEXT
);

CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id TEXT REFERENCES alert_rules(id) ON DELETE SET NULL,
  rule_name TEXT NOT NULL,
  rule_snapshot TEXT NOT NULL,                 -- rule config at trigger time, so later edits don't rewrite history
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',           -- JSON: counts, baseline, sample story ids
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  triggered_at TEXT NOT NULL,
  acknowledged_by TEXT REFERENCES users(id),
  acknowledged_at TEXT,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  resolution_note TEXT,
  webhook_status TEXT                          -- null | sent | failed:<reason>
);
CREATE INDEX idx_alerts_ws ON alerts(workspace_id, status, triggered_at);
CREATE UNIQUE INDEX idx_alerts_dedupe ON alerts(workspace_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ───────────── Audit trail (append-only) ─────────────
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  at TEXT NOT NULL,
  user_id TEXT,
  actor TEXT NOT NULL,                         -- display label: user name, or 'system'
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_audit_ws ON audit_log(workspace_id, at);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
