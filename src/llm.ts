import type { Env } from "./env";

export type PromptMessage = { role: "system" | "user" | "assistant"; content: string };

export class ModelQuotaExhausted extends Error {}

type WorkersAiOutput = {
  response?: string;
  choices?: { message?: { content?: string } }[];
};

type ChatCompletion = { choices?: { message?: { content?: string } }[] };

const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export async function complete(env: Env, messages: PromptMessage[], maxTokens: number): Promise<string> {
  const text = env.LLM_PROVIDER === "gemini"
    ? await completeWithGemini(env, messages, maxTokens)
    : await completeWithWorkersAi(env, messages, maxTokens);
  return text.trim();
}

async function completeWithWorkersAi(env: Env, messages: PromptMessage[], maxTokens: number): Promise<string> {
  try {
    const output = (await env.AI.run(env.MODEL as keyof AiModels, { messages, max_tokens: maxTokens } as never)) as WorkersAiOutput;
    return output.response ?? output.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (String(error).includes("daily free allocation")) throw new ModelQuotaExhausted(String(error));
    throw error;
  }
}

async function completeWithGemini(env: Env, messages: PromptMessage[], maxTokens: number): Promise<string> {
  const response = await fetch(GEMINI_CHAT_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.GEMINI_API_KEY}` },
    body: JSON.stringify({ model: env.MODEL, messages, max_tokens: maxTokens, reasoning_effort: "none" }),
  });
  if (response.status === 429) throw new ModelQuotaExhausted(await response.text());
  if (!response.ok) throw new Error(`Gemini returned ${response.status}: ${await response.text()}`);
  const completion = (await response.json()) as ChatCompletion;
  return completion.choices?.[0]?.message?.content ?? "";
}
