import { describe, expect, test } from "bun:test";
import { tutorSystemPrompt } from "../src/prompts";

const memories = ["[profile] The learner's native language is Ukrainian.", "[word] The learner asked about 'madrugar' in Spanish."];

describe("tutorSystemPrompt", () => {
  test("asks for corrections in the learner's native language", () => {
    const prompt = tutorSystemPrompt(memories, false, "2026-09-27");
    expect(prompt).toContain("Write the reason in the learner's native language, not in the target language.");
    expect(prompt).toContain("If it has none, add nothing.");
  });

  test("tells the model to greet returning learners with a memory and a review question", () => {
    const prompt = tutorSystemPrompt(memories, true, "2026-09-27");
    expect(prompt).toContain("returning learner");
    expect(prompt).toContain("review question");
    for (const memory of memories) expect(prompt).toContain(memory);
  });

  test("new learners are asked for their language instead", () => {
    const prompt = tutorSystemPrompt([], true, "2026-09-27");
    expect(prompt).toContain("new learner");
    expect(prompt).not.toContain("review question");
  });

  test("the session-start instruction only appears on the first exchange", () => {
    expect(tutorSystemPrompt(memories, false, "2026-09-27")).not.toContain("Right now:");
  });
});
