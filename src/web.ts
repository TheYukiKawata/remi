import type { Env } from "./env";
import { webLearner, type Learner } from "./learner";
import page from "./page.html";
import { readStats } from "./store";
import { openChat, rememberedFacts, respond } from "./tutor";

const MAX_MESSAGE_LENGTH = 1000;

type ChatRequest = { learnerId?: unknown; message?: unknown };

export function servePage(env: Env): Response {
  const html = page.replace("{{TELEGRAM_LINK}}", telegramLink(env.TELEGRAM_BOT_USERNAME));
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function telegramLink(botUsername: string): string {
  if (!/^\w{5,32}$/.test(botUsername)) return "";
  return `<a href="https://t.me/${botUsername}">Chat on Telegram</a>`;
}

export async function handleOpen(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const learner = learnerFrom(await readBody(request));
  if (learner === null) return badRequest("learnerId must be a UUID v4");
  return Response.json(await openChat(env, ctx, learner));
}

export async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await readBody(request);
  const learner = learnerFrom(body);
  if (learner === null) return badRequest("learnerId must be a UUID v4");
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length === 0 || message.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`message must be 1 to ${MAX_MESSAGE_LENGTH} characters`);
  }
  return Response.json({ reply: await respond(env, ctx, learner, message) });
}

export async function handleMemory(request: Request, env: Env): Promise<Response> {
  const learner = learnerFrom(await readBody(request));
  if (learner === null) return badRequest("learnerId must be a UUID v4");
  return Response.json({ memories: await rememberedFacts(env, learner) });
}

export async function handleStats(env: Env): Promise<Response> {
  return Response.json(await readStats(env.DB));
}

function learnerFrom(body: ChatRequest): Learner | null {
  return webLearner(body.learnerId);
}

async function readBody(request: Request): Promise<ChatRequest> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as ChatRequest) : {};
  } catch {
    return {};
  }
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}
