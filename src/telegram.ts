import type { Env } from "./env";
import { telegramLearner, type Learner } from "./learner";
import { openChat, rememberedFacts, respond } from "./tutor";

type IncomingText = { chatId: number; learner: Learner; text: string };

type TelegramUpdate = {
  message?: { chat?: { id?: number; type?: string }; from?: { id?: number }; text?: string };
};

const HELP_TEXT = [
  "I'm Remi, a language practice partner that remembers you between chats.",
  "Tell me which language you're learning, your level, and your native language, then just talk to me.",
  "I remember your goals, interests, new words and mistakes, and bring them back in later sessions. Memories are stored encrypted on Walrus. Don't send me anything private.",
  "",
  "/memory shows what I remember about you",
  "/help shows this message",
].join("\n");

const RESUMED_TEXT = "We're in the middle of a chat, so keep going. Send /memory to see what I remember about you.";
const MAX_MESSAGE_LENGTH = 1000;

export async function handleTelegramWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  const incoming = parseIncomingText((await request.json()) as TelegramUpdate);
  if (incoming === null) return new Response("OK");
  try {
    await sendTyping(env, incoming.chatId);
    await sendMessage(env, incoming.chatId, await answer(env, ctx, incoming));
  } catch (error) {
    console.error("telegram update failed", error);
    await sendMessage(env, incoming.chatId, "Something went wrong on my side. Please try again in a minute.");
  }
  return new Response("OK");
}

function parseIncomingText(update: TelegramUpdate): IncomingText | null {
  const message = update.message;
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;
  const text = message?.text?.trim();
  if (message?.chat?.type !== "private" || chatId === undefined || userId === undefined || !text) return null;
  return { chatId, learner: telegramLearner(userId), text: text.slice(0, MAX_MESSAGE_LENGTH) };
}

async function answer(env: Env, ctx: ExecutionContext, { learner, text }: IncomingText): Promise<string> {
  const command = text.split(/[\s@]/)[0];
  if (command === "/help") return HELP_TEXT;
  if (command === "/memory") return describeMemories(await rememberedFacts(env, learner));
  if (command === "/start") return startChat(env, ctx, learner);
  return respond(env, ctx, learner, text);
}

async function startChat(env: Env, ctx: ExecutionContext, learner: Learner): Promise<string> {
  const opened = await openChat(env, ctx, learner);
  if (opened.resumed) return RESUMED_TEXT;
  return opened.messages.map((message) => message.content).join("\n\n");
}

function describeMemories(memories: string[]): string {
  if (memories.length === 0) return "I don't remember anything about you yet. Tell me what language you're learning and why.";
  return ["Here's what I remember about you:", ...memories.map((memory) => `• ${memory}`)].join("\n");
}

async function sendTyping(env: Env, chatId: number): Promise<void> {
  await callTelegram(env, "sendChatAction", { chat_id: chatId, action: "typing" });
}

async function sendMessage(env: Env, chatId: number, text: string): Promise<void> {
  await callTelegram(env, "sendMessage", { chat_id: chatId, text });
}

async function callTelegram(env: Env, method: string, body: unknown): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) console.error(`telegram ${method} failed`, response.status, await response.text());
}
