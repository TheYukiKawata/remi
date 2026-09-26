export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Session = {
  startedAt: number;
  lastActiveAt: number;
  messages: ChatMessage[];
  memories: string[];
};

export const OPENED_CHAT = "(I just opened the chat.)";

const IDLE_BEFORE_NEW_SESSION_MS = 6 * 60 * 60 * 1000;
const MAX_MESSAGES = 16;

export function isActive(session: Session | null, now: number): session is Session {
  return session !== null && now - session.lastActiveAt < IDLE_BEFORE_NEW_SESSION_MS;
}

export function startSession(memories: string[], now: number): Session {
  return { startedAt: now, lastActiveAt: now, messages: [], memories };
}

export function isFirstExchange(session: Session): boolean {
  return session.messages.length === 0;
}

export function withExchange(session: Session, userText: string, reply: string, now: number): Session {
  const messages: ChatMessage[] = [
    ...session.messages,
    { role: "user", content: userText },
    { role: "assistant", content: reply },
  ];
  return { ...session, lastActiveAt: now, messages: messages.slice(-MAX_MESSAGES) };
}

export function withMemories(session: Session, memories: string[]): Session {
  return { ...session, memories: unique([...session.memories, ...memories]) };
}

export function visibleMessages(session: Session): ChatMessage[] {
  return session.messages.filter((message) => message.content !== OPENED_CHAT);
}

export function parseSession(json: string | null): Session | null {
  if (json === null) return null;
  return JSON.parse(json) as Session;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
