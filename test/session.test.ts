import { expect, test } from "bun:test";
import { isActive, isFirstExchange, OPENED_CHAT, startSession, visibleMessages, withExchange, withMemories } from "../src/session";

const HOUR = 60 * 60 * 1000;

test("a session expires after six idle hours", () => {
  const session = startSession([], 0);
  expect(isActive(session, 5 * HOUR)).toBe(true);
  expect(isActive(session, 6 * HOUR)).toBe(false);
  expect(isActive(null, 0)).toBe(false);
});

test("exchanges extend the session and keep the last 16 messages", () => {
  let session = startSession([], 0);
  expect(isFirstExchange(session)).toBe(true);
  for (let turn = 0; turn < 10; turn++) session = withExchange(session, `q${turn}`, `a${turn}`, turn * HOUR);
  expect(isFirstExchange(session)).toBe(false);
  expect(session.lastActiveAt).toBe(9 * HOUR);
  expect(session.messages).toHaveLength(16);
  expect(session.messages[0]).toEqual({ role: "user", content: "q2" });
});

test("memories merge without duplicates", () => {
  const session = withMemories(startSession(["a", "b"], 0), ["b", "c"]);
  expect(session.memories).toEqual(["a", "b", "c"]);
});

test("the opened-chat marker is hidden from visible messages", () => {
  const session = withExchange(startSession([], 0), OPENED_CHAT, "Hi, I'm Remi.", 0);
  expect(visibleMessages(session)).toEqual([{ role: "assistant", content: "Hi, I'm Remi." }]);
});
