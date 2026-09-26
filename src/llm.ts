import type { Env } from "./env";

export type PromptMessage = { role: "system" | "user" | "assistant"; content: string };

export class ModelQuotaExhausted extends Error {}

type WorkersAiOutput = {
  response?: string;
  choices?: { message?: { content?: string } }[];
};

export async function complete(env: Env, messages: PromptMessage[], maxTokens: number): Promise<string> {
  const output = await runModel(env, messages, maxTokens);
  const text = output.response ?? output.choices?.[0]?.message?.content ?? "";
  return text.trim();
}

async function runModel(env: Env, messages: PromptMessage[], maxTokens: number): Promise<WorkersAiOutput> {
  try {
    return (await env.AI.run(env.MODEL as keyof AiModels, { messages, max_tokens: maxTokens } as never)) as WorkersAiOutput;
  } catch (error) {
    if (String(error).includes("daily free allocation")) throw new ModelQuotaExhausted(String(error));
    throw error;
  }
}
