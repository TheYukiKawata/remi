CREATE TABLE learners (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  day_messages INTEGER NOT NULL DEFAULT 0,
  session TEXT
);

CREATE TABLE memories (
  job_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
