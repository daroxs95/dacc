# DACC

A Spain-first freelancer finance/accounting app for tracking income, expenses, invoices, payments, and quarterly tax preparation.

| App | Directory | Purpose |
| --- | --- | --- |
| DACC | `apps/dacc` | Browser-based accounting and invoice editor |
| Wise MCP | [`apps/wise-mcp`](apps/wise-mcp/README.md) | Standalone server for read-only Wise API access |

Each app manages its own npm dependencies. The shared `decss/` styles submodule lives at the repository root. Paths starting with `app/` below are relative to `apps/dacc/`.

## Goals

- Track income and expenses clearly
- Handle issued vs paid invoices
- Generate invoice PDFs
- Prepare data for quarterly tax declarations
- Keep records organised for audits and annual reporting

## Current app

DACC now has a React frontend and a TypeScript backend in apps/dacc. Google sign-in establishes an account session. The UI API and the Streamable HTTP MCP endpoint at /mcp use the same account-scoped services.

Cloudflare deployment uses a Worker and D1. Docker deployment serves the UI and backend from one Node process and stores SQLite in a persistent volume. See [deployment and account setup](apps/dacc/DEPLOYMENT.md).

Profiles, invoices, mutation receipts, and import previews are stored as a versioned JSON account aggregate in SQL. Each write uses compare-and-swap to prevent lost updates. Users, sessions, OAuth state, and MCP credentials have separate SQL tables. Account data is fetched as a whole, so this initial persistence model targets small personal accounts. It will need normalized invoice tables and server-side pagination for larger datasets.

Use the Account button to open account settings and create or revoke MCP tokens. Existing version 1 and version 2 backups remain supported; version 3 preserves expenses and non-USD amounts. Settings can rename and delete profiles, and export and restore individual profiles. Deleting a profile shows its invoice count for confirmation and permanently removes its company defaults, invoices and expenses; at least one profile must remain. Restoring replaces the selected profile’s saved invoices, expenses and defaults.

MCP exposes profile and invoice reads, summaries, creation, updates, profile renaming/deletion, and preview/apply imports. Use `dacc_rename_profile` with the latest profile version. For deletion, call `dacc_preview_profile_deletion`, then `dacc_delete_profile` with its version and a unique request ID after authorization. Set `emptyOnly: true` for cleanup that must preserve company details, invoices and expenses. Changed data invalidates deletion previews. The Cloudflare deployment supports ChatGPT OAuth connections at `/mcp`, using Google sign-in and an explicit consent page. Other clients can use a personal bearer token generated in Account settings; personal tokens allow reads and writes and expire after 90 days. Browser WebMCP tools use the same backend through the authenticated API. Saved records are available across browsers. Unsaved form edits remain local, and stale saves are rejected.

The current invoice model supports one line item, USD/EUR/GBP amounts, free-text dates, and paid/unpaid/unknown payment states. Expenses have a separate searchable view and create/update/read/summary MCP tools. Amounts are grouped by original currency without automatic conversions. Source references, notes and separately reported tax-ledger amounts are retained as metadata. It preserves existing invoice snapshots and exact decimal total calculations. Agent creates have idempotency receipts, updates require version tokens, and import previews are account-scoped and expire after ten minutes.

## Main features

- Client management
- Contract management
- Work period tracking
- Expense tracking
- Invoice generation
- Payment reconciliation
- Quarterly tax summary
- CSV/PDF exports
- Document storage

## Domain model

### Key concepts
- A Work Period represents services performed in a period
- An Invoice represents a formal billing document
- A Payment represents money actually received
- An Expense represents deductible or non-deductible spending
- A Tax Quarter aggregates values for quarterly reporting

These concepts are intentionally separate.

## Development principles

- Strict TypeScript everywhere
- No floats for money
- Immutable invoice snapshots after issue
- Explicit business rules in backend services
- Modular monolith first
- Keep legal/tax logic configurable

## Getting started

Use Node.js 22+ and initialize the decss Git submodule. Follow [DEPLOYMENT.md](apps/dacc/DEPLOYMENT.md) for Google credentials, development, Docker, and Cloudflare setup.

Run npm test, npm run typecheck, and npm run build from apps/dacc before deployment.

## Initial scope

### Included in MVP
- clients
- contracts
- expenses
- work periods
- invoices
- payments
- quarter summaries
- exports

### Excluded from MVP
- bank sync
- OCR
- AI extraction
- automatic tax filing
- multi-user support

## Data correctness rules

- Invoice numbering must be sequential
- Invoice totals are stored as snapshots
- Payments can be partial
- One payment may settle multiple invoices
- Tax quarter values are calculated from stored documents
- Every invoice and expense may have supporting files

## Roadmap

### v0.1
- foundation
- auth
- client CRUD
- expense CRUD
- basic invoice creation

### v0.2
- invoice PDF generation
- payment reconciliation
- quarter summary views

### v0.3
- quarter exports
- audit logs
- snapshots
- backup/restore

## Notes

This app helps prepare accounting and tax data but does not replace professional tax advice.

## Localization

The interface supports English and Spanish. The language selector remembers the choice in this browser; on first use it follows the first supported browser language, falling back to English. Interface language is independent of the language saved with each invoice and each profile's invoice defaults.

UI strings and interpolation templates live in `app/lib/i18n.ts`. Use `useLang()` for interface text and `useLang(invoice.language)` for document text. Keys are type checked; add an English key and its Spanish translation together. Store message keys for status/error state so existing notices translate when the language changes. Known database errors are translated at the UI boundary; unknown browser errors use a localized fallback.

Money and quantities use `Intl.NumberFormat`. Existing invoices default to USD; new invoices and expenses store their own supported currency. Dates and company/profile/invoice content remain as entered, avoiding reinterpretation of existing free-text dates. The language preference is browser-local and is not part of database backups.
