import { describe, expect, test } from "bun:test";
import { memoryText, parseFacts } from "../src/facts";

describe("parseFacts", () => {
  test("reads facts from JSON wrapped in model chatter", () => {
    const output = 'Sure:\n```json\n{"facts":[{"kind":"goal","text":"The learner wants to pass DELE B1 in Spanish."}]}\n```';
    expect(parseFacts(output)).toEqual([{ kind: "goal", text: "The learner wants to pass DELE B1 in Spanish." }]);
  });

  test("drops unknown kinds, empty text and non-objects", () => {
    const output = JSON.stringify({
      facts: [{ kind: "secret", text: "x" }, { kind: "word", text: "  " }, "text", { kind: "word", text: "The learner learned 'hola'." }],
    });
    expect(parseFacts(output)).toEqual([{ kind: "word", text: "The learner learned 'hola'." }]);
  });

  test("returns nothing for invalid JSON", () => {
    expect(parseFacts("no facts here")).toEqual([]);
    expect(parseFacts("{broken")).toEqual([]);
  });

  test("keeps at most five facts", () => {
    const facts = Array.from({ length: 8 }, (_, index) => ({ kind: "interest", text: `The learner likes topic ${index}.` }));
    expect(parseFacts(JSON.stringify({ facts }))).toHaveLength(5);
  });
});

test("memoryText prefixes the kind", () => {
  expect(memoryText({ kind: "mistake", text: "The learner mixed up ser and estar." })).toBe(
    "[mistake] The learner mixed up ser and estar.",
  );
});
