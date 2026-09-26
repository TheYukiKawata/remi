import type { Env } from "./env";
import { memoryText, parseFacts } from "./facts";
import { memoryNamespace, type Learner } from "./learner";
import { complete, ModelQuotaExhausted, type PromptMessage } from "./llm";
import { recallOverview, recallRelevant, recallSessionContext, saveFacts } from "./memory";
import { extractionPrompt, tutorSystemPrompt } from "./prompts";
import {
  isActive,
  isFirstExchange,
  OPENED_CHAT,
  startSession,
  visibleMessages,
  withExchange,
  withMemories,
  type ChatMessage,
  type Session,
} from "./session";
import { loadLearnerState, recordMemories, saveSessionMemories, saveTurn } from "./store";

const DAILY_MESSAGE_LIMIT = 60;
const REPLY_MAX_TOKENS = 400;
const EXTRACTION_MAX_TOKENS = 500;

export const DAILY_LIMIT_TEXT = `You've sent ${DAILY_MESSAGE_LIMIT} messages today, which is Remi's daily limit per learner. Come back tomorrow (UTC) and I'll remember where we stopped.`;
export const QUOTA_TEXT = "Remi has used today's free AI quota. It resets at 00:00 UTC. Your memories are safe, so we'll pick up from here.";

export type OpenedChat = { resumed: boolean; messages: ChatMessage[] };

export async function respond(env: Env, ctx: ExecutionContext, learner: Learner, text: string): Promise<string> {
  const now = Date.now();
  const today = isoDay(now);
  const state = await loadLearnerState(env.DB, learner, today);
  if (state.messagesToday >= DAILY_MESSAGE_LIMIT) return DAILY_LIMIT_TEXT;

  const namespace = memoryNamespace(learner);
  const activeSession = isActive(state.session, now) ? state.session : null;
  const [session, relevant] = await Promise.all([
    activeSession ?? startSessionFromMemory(env, namespace, now),
    text === OPENED_CHAT ? [] : recallOrNothing(() => recallRelevant(env, namespace, text)),
  ]);

  const reply = await replyOrQuotaText(env, promptFor(session, relevant, text, today));
  if (reply === QUOTA_TEXT) return reply;

  const updated = withExchange(withMemories(session, relevant), text, reply, now);
  await saveTurn(env.DB, learner, updated, activeSession === null, today);
  if (text !== OPENED_CHAT) ctx.waitUntil(rememberExchange(env, learner, updated, text, reply));
  return reply;
}

export async function openChat(env: Env, ctx: ExecutionContext, learner: Learner): Promise<OpenedChat> {
  const now = Date.now();
  const state = await loadLearnerState(env.DB, learner, isoDay(now));
  if (isActive(state.session, now)) return { resumed: true, messages: visibleMessages(state.session) };
  const reply = await respond(env, ctx, learner, OPENED_CHAT);
  return { resumed: false, messages: [{ role: "assistant", content: reply }] };
}

export async function rememberedFacts(env: Env, learner: Learner): Promise<string[]> {
  return recallOverview(env, memoryNamespace(learner));
}

async function startSessionFromMemory(env: Env, namespace: string, now: number): Promise<Session> {
  const memories = await recallOrNothing(() => recallSessionContext(env, namespace));
  return startSession(memories, now);
}

function promptFor(session: Session, relevant: string[], text: string, today: string): PromptMessage[] {
  const memories = [...new Set([...session.memories, ...relevant])];
  return [
    { role: "system", content: tutorSystemPrompt(memories, isFirstExchange(session), today) },
    ...session.messages,
    { role: "user", content: text },
  ];
}

async function replyOrQuotaText(env: Env, prompt: PromptMessage[]): Promise<string> {
  try {
    return await complete(env, prompt, REPLY_MAX_TOKENS);
  } catch (error) {
    if (error instanceof ModelQuotaExhausted) return QUOTA_TEXT;
    throw error;
  }
}

async function rememberExchange(env: Env, learner: Learner, session: Session, text: string, reply: string): Promise<void> {
  try {
    const output = await complete(env, [{ role: "user", content: extractionPrompt(session.memories, text, reply) }], EXTRACTION_MAX_TOKENS);
    const facts = parseFacts(output);
    const saved = await saveFacts(env, memoryNamespace(learner), facts);
    await recordMemories(env.DB, learner, saved, Date.now());
    await saveSessionMemories(env.DB, learner, withMemories(session, facts.map(memoryText)).memories);
  } catch (error) {
    console.error("remember exchange failed", error);
  }
}

async function recallOrNothing(recall: () => Promise<string[]>): Promise<string[]> {
  try {
    return await recall();
  } catch (error) {
    console.error("recall failed", error);
    return [];
  }
}

function isoDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
