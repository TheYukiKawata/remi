import type { Learner } from "./learner";
import type { SavedMemory } from "./memory";
import { parseSession, type Session } from "./session";

export type LearnerState = { session: Session | null; messagesToday: number };

export type Stats = { learners: number; returningLearners: number; messages: number; memories: number };

type LearnerRow = { session: string | null; day: string; day_messages: number };

export async function loadLearnerState(db: D1Database, learner: Learner, today: string): Promise<LearnerState> {
  const row = await db
    .prepare("SELECT session, day, day_messages FROM learners WHERE id = ?")
    .bind(learner.id)
    .first<LearnerRow>();
  if (row === null) return { session: null, messagesToday: 0 };
  return { session: parseSession(row.session), messagesToday: row.day === today ? row.day_messages : 0 };
}

export async function saveTurn(
  db: D1Database,
  learner: Learner,
  session: Session,
  startedSession: boolean,
  today: string,
): Promise<void> {
  const sessionIncrement = startedSession ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO learners (id, channel, created_at, last_seen_at, sessions, messages, day, day_messages, session)
       VALUES (?1, ?2, ?3, ?3, ?4, 1, ?5, 1, ?6)
       ON CONFLICT (id) DO UPDATE SET
         last_seen_at = ?3,
         sessions = sessions + ?4,
         messages = messages + 1,
         day_messages = CASE WHEN day = ?5 THEN day_messages + 1 ELSE 1 END,
         day = ?5,
         session = ?6`,
    )
    .bind(learner.id, learner.channel, session.lastActiveAt, sessionIncrement, today, JSON.stringify(session))
    .run();
}

export async function saveSessionMemories(db: D1Database, learner: Learner, memories: string[]): Promise<void> {
  await db
    .prepare("UPDATE learners SET session = json_set(session, '$.memories', json(?)) WHERE id = ?")
    .bind(JSON.stringify(memories), learner.id)
    .run();
}

export async function recordMemories(db: D1Database, learner: Learner, saved: SavedMemory[], now: number): Promise<void> {
  if (saved.length === 0) return;
  const insert = db.prepare("INSERT INTO memories (job_id, learner_id, kind, created_at) VALUES (?, ?, ?, ?)");
  await db.batch(saved.map(({ jobId, fact }) => insert.bind(jobId, learner.id, fact.kind, now)));
}

export async function readStats(db: D1Database): Promise<Stats> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM learners) AS learners,
         (SELECT COUNT(*) FROM learners WHERE sessions > 1) AS returningLearners,
         (SELECT COALESCE(SUM(messages), 0) FROM learners) AS messages,
         (SELECT COUNT(*) FROM memories) AS memories`,
    )
    .first<Stats>();
  return row ?? { learners: 0, returningLearners: 0, messages: 0, memories: 0 };
}
