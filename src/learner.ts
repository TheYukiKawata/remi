export type Channel = "telegram" | "web";

export type Learner = { id: string; channel: Channel };

export function telegramLearner(telegramUserId: number): Learner {
  return { id: `tg-${telegramUserId}`, channel: "telegram" };
}

const WEB_LEARNER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function webLearner(clientId: unknown): Learner | null {
  if (typeof clientId !== "string" || !WEB_LEARNER_ID.test(clientId)) return null;
  return { id: `web-${clientId}`, channel: "web" };
}

export function memoryNamespace(learner: Learner): string {
  return `remi-${learner.id}`;
}
