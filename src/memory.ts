import { MemWal } from "@mysten-incubation/memwal";
import type { Env } from "./env";
import { memoryText, type Fact } from "./facts";

const SESSION_CONTEXT_QUERIES = [
  { query: "The learner's target language, level, native language and name", limit: 4 },
  { query: "The learner's goals and interests", limit: 4 },
  { query: "Mistakes the learner made", limit: 4 },
  { query: "Words the learner learned", limit: 3 },
];

const RELEVANT_LIMIT = 5;
const OVERVIEW_LIMIT = 30;

export type SavedMemory = { jobId: string; fact: Fact };

let cachedClient: MemWal | null = null;

function client(env: Env): MemWal {
  cachedClient ??= MemWal.create({
    key: env.MEMWAL_PRIVATE_KEY,
    accountId: env.MEMWAL_ACCOUNT_ID,
    serverUrl: env.MEMWAL_RELAYER_URL,
  });
  return cachedClient;
}

export async function recallSessionContext(env: Env, namespace: string): Promise<string[]> {
  const batches = await Promise.all(
    SESSION_CONTEXT_QUERIES.map(({ query, limit }) => recallTexts(env, namespace, query, limit)),
  );
  return unique(batches.flat());
}

export async function recallRelevant(env: Env, namespace: string, text: string): Promise<string[]> {
  return recallTexts(env, namespace, text, RELEVANT_LIMIT);
}

export async function recallOverview(env: Env, namespace: string): Promise<string[]> {
  return recallTexts(env, namespace, "Everything known about the learner", OVERVIEW_LIMIT);
}

export async function saveFacts(env: Env, namespace: string, facts: Fact[]): Promise<SavedMemory[]> {
  if (facts.length === 0) return [];
  const accepted = await client(env).rememberBulk(facts.map((fact) => ({ text: memoryText(fact), namespace })));
  return accepted.job_ids.flatMap((jobId, index) => {
    const fact = facts[index];
    return fact ? [{ jobId, fact }] : [];
  });
}

async function recallTexts(env: Env, namespace: string, query: string, limit: number): Promise<string[]> {
  const result = await client(env).recall({ query, namespace, limit });
  return result.results.map((memory) => memory.text);
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
