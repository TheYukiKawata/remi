import type { Env } from "./env";
import { handleTelegramWebhook } from "./telegram";
import { handleChat, handleMemory, handleOpen, handleStats, servePage } from "./web";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    const route = `${request.method} ${pathname}`;
    switch (route) {
      case "GET /":
        return servePage(env);
      case "GET /stats":
        return handleStats(env);
      case "POST /api/open":
        return handleOpen(request, env, ctx);
      case "POST /api/chat":
        return handleChat(request, env, ctx);
      case "POST /api/memory":
        return handleMemory(request, env);
      case "POST /telegram":
        return handleTelegramWebhook(request, env, ctx);
      default:
        return new Response("Not found", { status: 404 });
    }
  },
} satisfies ExportedHandler<Env>;
