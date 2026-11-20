# Run DACC

DACC uses Google login for browser access. On Cloudflare, MCP clients can connect through OAuth with Google sign-in and explicit DACC consent. Personal bearer tokens remain available for clients that support them. Configure an OAuth web client in Google Cloud with the callback URL `<APP_URL>/auth/google/callback` and the `openid`, `email`, and `profile` scopes. Configure test users if the Google consent screen is in testing mode.

## Local development

From `apps/dacc`, install dependencies with `npm install`. Copy `.env.example` to `.env` and fill in the Google client ID and secret. Use `APP_URL=http://localhost:5173` for Vite development, and register `http://localhost:5173/auth/google/callback` in Google Cloud.

Run `npm run dev:server` and `npm run dev` in two terminals. Open `http://localhost:5173`. Vite proxies `/api`, `/auth`, and `/mcp` to port 3000. SQLite migrations run at server startup. Keep the Vite and backend hostnames consistent with APP_URL.

For a built application use `npm run build`, set `APP_URL=http://localhost:3000`, register the corresponding Google callback, and run `npm start`.

## Docker

From the repository root, supply `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_URL` through environment variables or a root `.env` file, then run `docker compose up --build -d`.

The container serves the UI, API, and MCP on port 3000. SQLite lives at `/data/dacc.sqlite` in the named `dacc-data` volume. Keep this volume when replacing containers. Use HTTPS at your reverse proxy for a public deployment and set APP_URL to the public origin. Set the Google callback URL to that origin followed by `/auth/google/callback`.

For a full deployment backup, stop the container before copying the data volume, or use SQLite's online backup facility. JSON profile exports contain invoice data only. Google secrets and account sessions are excluded from those exports.

## Cloudflare

Install the pinned deployment CLI from the repository root with `npm ci --prefix tools/cloudflare`, then run `npm ci` from `apps/dacc`. Wrangler lives separately because the current React Router version declares an optional Wrangler 3 peer dependency. Use `npm run wrangler -- <command>` from `apps/dacc` for all Worker commands.

The configuration targets the existing `dacc` Worker at `https://dacc.darodev.site` and its D1 database. Set `vars.GOOGLE_CLIENT_ID` to the Google OAuth web client ID and register `https://dacc.darodev.site/auth/google/callback` as its authorized redirect URI. When setting up another account, create a database with `npm run wrangler -- d1 create dacc` and update the account, domain, APP_URL, and database ID in `wrangler.jsonc`.

Cloudflare Workers Builds deploys every push to `master` to the `dacc` Worker. It uses root directory `apps/dacc`, build command `git -C ../.. submodule update --init --recursive && npm ci && npm run setup:cloudflare && npm test && npm run typecheck && npm run build`, and deploy command `npm run cloudflare -- deploy`. Commit changes before deploying manually, because the next push to `master` replaces any deployed version. New Worker versions copy secrets from the latest uploaded version.

Store the secret using `npm run wrangler -- secret put GOOGLE_CLIENT_SECRET`. Run `npm run db:migrate:cloudflare`, then `npm run deploy:cloudflare`.

For local Worker development, use `.dev.vars` for the Google settings and `APP_URL=https://localhost:8787`, register that callback with Google, apply local migrations using `npm run wrangler -- d1 migrations apply dacc --local`, and run `npm run dev:cloudflare`. Use a locally trusted development certificate for browser OAuth testing. `npm run test:oauth` tests the protocol in an isolated local Worker without a real Google login.

MCP OAuth uses the `OAUTH_KV` binding for clients, consent transactions, grants, and encrypted token properties. When deploying to another account, create a namespace with `npm run wrangler -- kv namespace create OAUTH_KV` and update its ID. Keep `global_fetch_strictly_public` enabled for safe client metadata discovery. OAuth, discovery, and MCP routes must stay in `assets.run_worker_first`. Generate Worker binding/runtime types with `npm run types:cloudflare` (also run by typecheck).

The Google Auth project is `DACC` (`ivory-forklift-515015-p4`), with OAuth client `DACC Cloudflare`. It currently uses Google testing mode with the owner account registered as a test user. Manage additional test users in Google Auth Platform → Audience. Public Google sign-in requires completing branding and publishing the OAuth app. The client secret is stored as the Worker secret `GOOGLE_CLIENT_SECRET`, not in this repository.

Cloudflare and Docker hold independent databases. Profile JSON backups transfer invoice data between deployments. Account identities, sessions, and MCP credentials remain deployment-specific.

## Existing browser backups

The one-time browser migration button has been removed. Browser storage belongs to its original origin. To move another browser installation, download a backup from that installation and restore it through DACC Settings. Existing version 1 and version 2 backups are supported.

## MCP

For ChatGPT, open Plugins → + → Add custom MCP server. Enter `https://dacc.darodev.site/mcp` and choose OAuth. Discovery supports Client ID Metadata Documents (CIMD) and Dynamic Client Registration (DCR); no manually copied client secret is needed. Sign in with Google if needed, check the account and requested permissions, and approve the connection. Install the plugin and select `@DACC` in a conversation.

The Cloudflare Worker uses `@cloudflare/workers-oauth-provider` for discovery, S256 PKCE, browser-bound consent, issuer identification, resource-bound tokens, refresh rotation, and revocation. The `dacc:account` permission grants access to read and edit the user's account; `offline_access` permits refresh tokens. Access tokens last one hour and refresh grants last 30 days. Google credentials are only used for identity and are never forwarded to MCP clients. The authorization server is `APP_URL`, and the protected resource is exactly `<APP_URL>/mcp`.

For other clients, open Account and create a named personal token. Copy it when shown. Configure Streamable HTTP URL `<APP_URL>/mcp` with `Authorization: Bearer <token>`. Personal tokens permit reads and writes, expire after 90 days, and can be revoked individually. The standalone Node/Docker server currently supports these personal tokens; the OAuth provider integration runs in the Cloudflare Worker.

The endpoint exposes the existing profile, invoice, summary, and preview/apply import tools. Each request authenticates independently. Import previews persist in SQL across requests and expire after ten minutes. Browser form state is unavailable to remote MCP calls. Concurrent changes reject stale saves.

## Persistence design

Users, sessions, OAuth state, and credentials use individual SQL tables. Accounting data, mutation receipts, and import previews use one JSON document per user in the `workspaces` table. SQL compare-and-swap updates make each account mutation atomic on both D1 and SQLite. Queries currently load the account document. This design targets small accounts and is subject to D1 row-size limits. Larger accounts will require normalized profile/invoice tables and database pagination.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run test:oauth` (includes build). The OAuth integration test starts real workerd with temporary D1/KV fixtures, exercises consent, PKCE, rejected redirects/resources, account isolation, refresh and revocation, then removes its temporary data. It never accesses production storage. Live Google verification requires configured credentials.
