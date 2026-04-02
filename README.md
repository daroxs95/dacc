# DACC

A Spain-first freelancer finance/accounting app for tracking income, expenses, invoices, payments, and quarterly tax preparation.

## Goals

- Track income and expenses clearly
- Handle issued vs paid invoices
- Generate invoice PDFs
- Prepare data for quarterly tax declarations
- Keep records organised for audits and annual reporting

## Tech stack

### Frontend
- Bun
- Vite
- React
- TypeScript
- Plain CSS

### Backend
- Bun
- Elysia
- TypeScript
- Prisma

### Database
- PostgreSQL

### Tooling
- Bun workspaces
- Zod
- Docker Compose
- GitHub Actions

## Monorepo layout

apps/
web/
api/
packages/
db/
shared/
validation/
config/
docs/
scripts/
docker/

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

### Prerequisites
- Bun
- Docker
- PostgreSQL (or Docker Compose)

### Install
bun install

### Run database
docker compose up -d postgres

### Run migrations
bun run db:migrate

### Start API
bun run dev:api

### Start web
bun run dev:web

## Scripts

bun run dev:web
bun run dev:api
bun run dev
bun run test
bun run lint
bun run typecheck
bun run db:generate
bun run db:migrate
bun run db:studio

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
