# Remi

Remi is a language practice partner on Telegram and the web that remembers each learner between sessions. Long-term memory is [Walrus Memory](https://docs.memwal.ai) on Sui mainnet. The model is Gemma 4 26B (`@cf/google/gemma-4-26b-a4b-it`) on Cloudflare Workers AI.

Try it at https://remi.yukikawata.fyi.

## How memory works

Each learner gets a namespace (`remi-tg-<telegram user id>` or `remi-web-<random id>`) under one Walrus Memory account.

After each reply, Remi asks the model for facts worth keeping: profile, goal, interest, mistake, word, or preference. Each fact is stored as its own memory with `rememberBulk`, which writes one Walrus blob per fact.

A session starts with the first message after 6 idle hours. At that point Remi recalls the learner's profile, goals, interests, mistakes, and words, and puts them in the system prompt. Every message also recalls the 5 memories closest to it. The model is told to greet returning learners with something it remembers and to quiz them on a past mistake.

D1 keeps only the last 16 messages of the current session and usage counters. Anything older than the current session is available only through Walrus Memory.

Send `/memory` on Telegram, or press "What do you remember about me?" on the web, to see what Remi recalls. `GET /stats` returns usage counts.

## Run your own

You need Bun, a Cloudflare account, and a Sui key. The key needs no SUI: the Walrus Memory relayer sponsors gas for account setup and pays for storage.

1. Install dependencies.
   ```sh
   bun install
   ```
2. Create a Walrus Memory account and register a delegate key. Run this once per owner address.
   ```sh
   export MEMWAL_PRIVATE_KEY=$(openssl rand -hex 32)
   OWNER_SUI_PRIVATE_KEY=suiprivkey1... bun scripts/create-account.ts
   ```
   Put the printed `accountId` in `MEMWAL_ACCOUNT_ID` in `wrangler.toml`.
3. Create the database and store the delegate key.
   ```sh
   bunx wrangler d1 create remi   # put the id in wrangler.toml
   bunx wrangler d1 migrations apply remi --remote
   echo -n "$MEMWAL_PRIVATE_KEY" | bunx wrangler secret put MEMWAL_PRIVATE_KEY
   ```
4. For Telegram, create a bot with [@BotFather](https://t.me/BotFather), set `TELEGRAM_BOT_USERNAME` in `wrangler.toml`, and store the token and a webhook secret.
   ```sh
   bunx wrangler secret put TELEGRAM_BOT_TOKEN
   bunx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```
5. Change the custom domain in `wrangler.toml`, then deploy.
   ```sh
   bun run deploy
   ```
6. Point Telegram at the Worker.
   ```sh
   curl "https://api.telegram.org/bot$TOKEN/setWebhook" -d url=https://your.domain/telegram -d secret_token=$WEBHOOK_SECRET
   ```

Checks: `bun run check` and `bun test`.

Built by Yuki Kawata with an AI coding agent. MIT license.
