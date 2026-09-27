import { expect, test } from "bun:test";
import type { Env } from "../src/env";
import { complete, EmptyModelReply } from "../src/llm";

function envWithWorkersAi(run: (model: string, input: Record<string, unknown>) => Promise<unknown>): Env {
  return { LLM_PROVIDER: "workers-ai", MODEL: "@cf/google/gemma-4-26b-a4b-it", AI: { run } } as unknown as Env;
}

test("Workers AI calls turn off thinking so it can't use up the reply budget", async () => {
  const inputs: Record<string, unknown>[] = [];
  const env = envWithWorkersAi(async (_model, input) => {
    inputs.push(input);
    return { choices: [{ message: { content: " Hola " } }] };
  });
  expect(await complete(env, [{ role: "user", content: "hi" }], 100)).toBe("Hola");
  expect(inputs[0]?.chat_template_kwargs).toEqual({ enable_thinking: false });
});

test("an empty model reply is an error, not a blank message", async () => {
  const env = envWithWorkersAi(async () => ({ choices: [{ message: { content: "" }, finish_reason: "length" }] }));
  expect(complete(env, [{ role: "user", content: "hi" }], 100)).rejects.toBeInstanceOf(EmptyModelReply);
});
