export const FACT_KINDS = ["profile", "goal", "interest", "mistake", "word", "preference"] as const;

export type FactKind = (typeof FACT_KINDS)[number];

export type Fact = { kind: FactKind; text: string };

const MAX_FACTS_PER_EXCHANGE = 5;
const MAX_FACT_LENGTH = 300;

export function parseFacts(modelOutput: string): Fact[] {
  const json = firstJsonObject(modelOutput);
  if (json === null) return [];
  const facts = (json as { facts?: unknown }).facts;
  if (!Array.isArray(facts)) return [];
  return facts.flatMap(toFact).slice(0, MAX_FACTS_PER_EXCHANGE);
}

export function memoryText(fact: Fact): string {
  return `[${fact.kind}] ${fact.text}`;
}

function toFact(candidate: unknown): Fact[] {
  if (typeof candidate !== "object" || candidate === null) return [];
  const { kind, text } = candidate as { kind?: unknown; text?: unknown };
  if (!isFactKind(kind) || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_FACT_LENGTH) return [];
  return [{ kind, text: trimmed }];
}

function isFactKind(value: unknown): value is FactKind {
  return FACT_KINDS.includes(value as FactKind);
}

function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
