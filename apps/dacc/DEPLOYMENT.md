# Run DACC

DACC uses Google login for browser access. MCP clients use revocable DACC bearer tokens created from account settings. Configure an OAuth web client in Google Cloud with the callback URL `<APP_URL>/auth/google/callback` and the `openid`, `email`, and `profile` scopes. Configure test users if the Google consent screen is in testing mode.

## Local development

From `apps/dacc`, install dependencies with `npm install`. Copy `.env.example` to `.env` and fill in the Google client ID and secret. Use `APP_URL=http://localhost:5173` for Vite development, and register `http://localhost:5173/auth/google/callback` in Google Cloud.

Run `npm run dev:server` and `npm run dev` in two terminals. Open `http://localhost:5173`. Vite proxies `/api`, `/auth`, and `/mcp` to port 3000. SQLite migrations run at server startup. Keep the Vite and backend hostnames consistent with APP_URL.

For a built application use `npm run build`, set `APP_URL=http://localhost:3000`, register the corresponding Google callback, and run `npm start`.

## Docker

From the repository root, supply `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_URL` through environment variables or a root `.env` file, then run `docker compose up --build -d`.

The container serves the UI, API, and MCP on port 3000. SQLite lives at `/data/dacc.sqlite` in the named `dacc-data` volume. Keep this volume when replacing containers. Use HTTPS at your reverse proxy for a public deployment and set APP_URL to the public origin. Set the Google callback URL to that origin followed by `/auth/google/callback`.

For a full deployment backup, stop the container before copying the data volume, or use SQLite's online backup facility. JSON profile exports contain invoice data only. Google secrets and account sessions are excluded from those exports.

## Cloudflare

Production runs as the `dacc` Worker at `https://dacc.darodev.site` with the `dacc` D1 database. `wrangler.jsonc` holds the database ID, route, and `APP_URL`. Set `GOOGLE_CLIENT_ID` as a variable in the Worker's dashboard settings and store `GOOGLE_CLIENT_SECRET` as a Worker secret. `keep_vars` stops deploys from removing dashboard variables. Register `https://dacc.darodev.site/auth/google/callback` in Google Cloud.

Wrangler lives in `tools/cloudflare`, isolated from the framework dependencies, whose optional peer range excludes Wrangler 4. Run `npm run setup:cloudflare` once, then use `npm run cloudflare -- <command>`, for example `npm run cloudflare -- secret put GOOGLE_CLIENT_SECRET`.

Cloudflare Workers Builds deploys every push to `master`. Configure it with root directory `apps/dacc`, build command `npm run setup:cloudflare && npm run build`, and deploy command `npm run cloudflare -- deploy`. Every other wrangler configuration deploying to the `dacc` Worker replaces this app.

Apply new migrations with `npm run db:migrate:cloudflare` before merging changes that depend on them. `npm run deploy:cloudflare` deploys manually.

For a new installation, run `npm run cloudflare -- d1 create dacc` and replace the database ID, account ID, route, and `APP_URL` in `wrangler.jsonc`.

For local Worker development, use `.dev.vars` for the Google settings and `APP_URL=http://localhost:8787`, register that callback with Google, apply local migrations using `npm run cloudflare -- d1 migrations apply dacc --local`, and run `npm run dev:cloudflare`.

Cloudflare and Docker hold independent databases. Profile JSON backups transfer invoice data between deployments. Account identities, sessions, and MCP credentials remain deployment-specific.

## Import browser data

Sign in, click your email address, and select **Import browser data**. The import adds the browser's profiles to the signed-in account and keeps the browser records available. The same source data uses a stable import request ID. Changed source data counts as a new import.

Browser storage belongs to its original origin. If the deployment origin changed, download a backup from the original installation and restore it through DACC Settings. Existing version 1 and version 2 backups are supported.

## MCP

Open account settings and create a named token. Copy it when shown. Configure your client's Streamable HTTP URL as `<APP_URL>/mcp` and its Authorization header as `Bearer <token>`. Tokens permit reads and writes on the user's account, expire after 90 days, and can be revoked individually. Clients must support configuring bearer headers. OAuth-based MCP client authorization is not implemented.

The endpoint exposes the existing profile, invoice, summary, and preview/apply import tools. Each request authenticates independently. Import previews persist in SQL across requests and expire after ten minutes. Browser form state is unavailable to remote MCP calls. Concurrent changes reject stale saves.

## Persistence design

Users, sessions, OAuth state, and credentials use individual SQL tables. Accounting data, mutation receipts, and import previews use one JSON document per user in the `workspaces` table. SQL compare-and-swap updates make each account mutation atomic on both D1 and SQLite. Queries currently load the account document. This design targets small accounts and is subject to D1 row-size limits. Larger accounts will require normalized profile/invoice tables and database pagination.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build`. Test both deployment targets with two Google users, verify isolation, save an invoice in the browser, read and update it over MCP, revoke the token, and check persistence after restarting the server. Live OAuth verification requires configured Google credentials.
