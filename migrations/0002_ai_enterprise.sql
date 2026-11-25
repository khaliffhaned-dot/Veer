-- Workers AI, realtime-adjacent and enterprise controls.

-- AI is opt-in per workspace and budgeted per UTC day (units = items processed across AI calls).
ALTER TABLE workspaces ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN ai_daily_limit INTEGER NOT NULL DEFAULT 1500;
ALTER TABLE workspaces ADD COLUMN retention_days INTEGER;   -- NULL = keep forever

-- AI output lives in its own columns. It never overwrites analyst `sentiment`.
ALTER TABLE articles ADD COLUMN ai_sentiment TEXT CHECK (ai_sentiment IN ('positive','neutral','negative','mixed'));
ALTER TABLE articles ADD COLUMN ai_sentiment_conf REAL;     -- model self-reported, uncalibrated
ALTER TABLE articles ADD COLUMN ai_title_en TEXT;           -- machine translation of the headline
ALTER TABLE articles ADD COLUMN ai_model TEXT;
ALTER TABLE articles ADD COLUMN ai_at TEXT;
CREATE INDEX idx_articles_ai_pending ON articles(workspace_id, ai_at, ts);

CREATE TABLE article_embeddings (
  article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  vec TEXT NOT NULL,                                        -- base64 Float32Array
  created_at TEXT NOT NULL
);
CREATE INDEX idx_embeddings_ws ON article_embeddings(workspace_id, created_at);

-- Cross-language / paraphrase duplicate *suggestions*. Merging is always a human decision.
CREATE TABLE story_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  group_a TEXT NOT NULL,            -- older group; the survivor if accepted
  group_b TEXT NOT NULL,
  score REAL NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TEXT NOT NULL,
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  UNIQUE (workspace_id, group_a, group_b)
);
CREATE INDEX idx_story_links_ws ON story_links(workspace_id, status);

CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  user_id TEXT,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  items INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  error TEXT
);
CREATE INDEX idx_ai_usage_ws ON ai_usage(workspace_id, at);

-- Programmatic access. Each key owns a hidden service user so audit trails name the key.
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (key, window)
);
