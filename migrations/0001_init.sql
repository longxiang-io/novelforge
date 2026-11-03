-- NovelForge community edition.
-- Fresh install only. Table names keep the cj_ prefix used by the application code.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  username TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  avatar TEXT,
  username_changed_at TEXT,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_username ON users(username);

CREATE TABLE cj_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE cj_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  chapter_words INTEGER NOT NULL DEFAULT 2500,
  foreshadow_remind INTEGER NOT NULL DEFAULT 3,
  budget REAL NOT NULL DEFAULT 1,
  world TEXT NOT NULL DEFAULT '',
  outline TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_books_user_id ON cj_books(user_id);

CREATE TABLE cj_volumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  sort INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  outline TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_volumes_book_id ON cj_volumes(book_id);

CREATE TABLE cj_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  volume_id INTEGER,
  number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  conflict TEXT NOT NULL DEFAULT '',
  payoff TEXT NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  characters TEXT NOT NULL DEFAULT '[]',
  foreshadows TEXT NOT NULL DEFAULT '[]',
  target_words INTEGER,
  content TEXT NOT NULL DEFAULT '',
  generated_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  checked_at TEXT,
  check_run INTEGER NOT NULL DEFAULT 0,
  check_dirty INTEGER NOT NULL DEFAULT 1,
  injected TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  confirmed_at TEXT,
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_chapters_user_id ON cj_chapters(user_id);
CREATE INDEX idx_cj_chapters_book_number ON cj_chapters(book_id, number);

CREATE TABLE cj_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_cards_book_kind ON cj_cards(book_id, kind);
CREATE INDEX idx_cj_cards_user_id ON cj_cards(user_id);

CREATE TABLE cj_foreshadows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  content TEXT NOT NULL,
  characters TEXT NOT NULL DEFAULT '[]',
  planted_chapter INTEGER,
  planned_chapter INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_chapter INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_foreshadows_book_id ON cj_foreshadows(book_id);

CREATE TABLE cj_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  run INTEGER NOT NULL DEFAULT 1,
  seq INTEGER NOT NULL DEFAULT 1,
  severity TEXT NOT NULL DEFAULT 'hint',
  title TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  paragraph INTEGER,
  basis TEXT NOT NULL DEFAULT '',
  card_name TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'model',
  false_positive INTEGER NOT NULL DEFAULT 0,
  fp_reason TEXT NOT NULL DEFAULT '',
  fp_note TEXT NOT NULL DEFAULT '',
  fp_suppress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_issues_chapter_run ON cj_issues(chapter_id, run);
CREATE INDEX idx_cj_issues_book_id ON cj_issues(book_id);

CREATE TABLE cj_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  target_name TEXT NOT NULL DEFAULT '',
  field TEXT NOT NULL DEFAULT '',
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  paragraph INTEGER,
  payload TEXT NOT NULL DEFAULT '{}',
  decision TEXT NOT NULL DEFAULT 'pending',
  edited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_changes_chapter_id ON cj_changes(chapter_id);

CREATE TABLE cj_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  chapter_number INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  changes TEXT NOT NULL DEFAULT '[]',
  before_state TEXT NOT NULL DEFAULT '{}',
  after_state TEXT NOT NULL DEFAULT '{}',
  stats TEXT NOT NULL DEFAULT '{}',
  reverted INTEGER NOT NULL DEFAULT 0,
  reverted_at TEXT,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_versions_book_id ON cj_versions(book_id);

CREATE TABLE cj_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER,
  chapter_id INTEGER,
  task TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL,
  output_chars INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_usage_user_created ON cj_usage(user_id, created_at);
CREATE INDEX idx_cj_usage_chapter_id ON cj_usage(chapter_id);

CREATE TABLE cj_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  key_storage TEXT NOT NULL DEFAULT 'server',
  status TEXT NOT NULL DEFAULT 'unknown',
  last_error TEXT NOT NULL DEFAULT '',
  tested_at TEXT,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_providers_user_id ON cj_providers(user_id);

CREATE TABLE cj_testcases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  expected TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_testcases_user_id ON cj_testcases(user_id);

CREATE TABLE cj_test_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT '',
  caught INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  issue_count INTEGER NOT NULL DEFAULT 0,
  false_count INTEGER NOT NULL DEFAULT 0,
  details TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_test_runs_user_id ON cj_test_runs(user_id);

CREATE TABLE cj_ai_chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_ai_chats_user_target ON cj_ai_chats(user_id, target_type, target_id);
CREATE INDEX idx_cj_ai_chats_book_id ON cj_ai_chats(book_id);

CREATE TABLE cj_ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  suggestions TEXT NOT NULL DEFAULT '[]',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX idx_cj_ai_messages_chat_id ON cj_ai_messages(chat_id);
CREATE INDEX idx_cj_ai_messages_user_id ON cj_ai_messages(user_id);
