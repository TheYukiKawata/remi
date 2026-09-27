export interface Env {
  AI: Ai;
  DB: D1Database;
  LLM_PROVIDER: "workers-ai" | "gemini";
  MODEL: string;
  GEMINI_API_KEY: string;
  MEMWAL_RELAYER_URL: string;
  MEMWAL_ACCOUNT_ID: string;
  MEMWAL_PRIVATE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  TELEGRAM_BOT_USERNAME: string;
}
