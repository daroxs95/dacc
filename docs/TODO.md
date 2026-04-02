## 3.1 Setup
- [ ] Initialise Bun workspace monorepo
- [ ] Create apps/web
- [ ] Create apps/api
- [ ] Create packages/db
- [ ] Create packages/shared
- [ ] Create packages/validation
- [ ] Add root tsconfig with strictest practical settings
- [ ] Add linting and formatting
- [ ] Add Docker Compose for PostgreSQL
- [ ] Add .env.example

## 3.2 Frontend foundation
- [ ] Setup Vite + React + TypeScript
- [ ] Setup React Router
- [ ] Setup TanStack Query
- [ ] Setup form system with React Hook Form + Zod
- [ ] Build app shell layout
- [ ] Build navigation sidebar
- [ ] Add base CSS tokens
- [ ] Add table component
- [ ] Add empty/loading/error states

## 3.3 Backend foundation
- [ ] Setup Elysia server
- [ ] Add health endpoint
- [ ] Add config module
- [ ] Add structured logger
- [ ] Add error handling
- [ ] Add request validation
- [ ] Add OpenAPI docs
- [ ] Add auth module
- [ ] Add test bootstrap

## 3.4 Database
- [ ] Setup Prisma with PostgreSQL
- [ ] Add decimal-safe money fields
- [ ] Create initial schema
- [ ] Add migrations
- [ ] Seed dev data
- [ ] Add DB indexes
- [ ] Add created/updated timestamps
- [ ] Add soft delete only where justified

## 3.5 Core domain
- [ ] Create Client model
- [ ] Create Contract model
- [ ] Create WorkPeriod model
- [ ] Create Invoice model
- [ ] Create InvoiceLine model
- [ ] Create Payment model
- [ ] Create PaymentAllocation model
- [ ] Create Expense model
- [ ] Create TaxQuarter model
- [ ] Create DocumentFile model
- [ ] Add settings model for tax defaults

## 3.6 Client module
- [ ] Client CRUD API
- [ ] Client list page
- [ ] Client detail page
- [ ] Client billing defaults
- [ ] Client country / currency fields

## 3.7 Contract module
- [ ] Contract CRUD API
- [ ] Contract list page
- [ ] Contract detail page
- [ ] Contract billing rules
- [ ] Contract payment rules
- [ ] Contract withholding rules
- [ ] Contract invoice note templates

## 3.8 Work periods
- [ ] Create monthly work period generator
- [ ] Track hours and notes
- [ ] Calculate expected billable amount
- [ ] Mark work period ready for invoicing
- [ ] Link work period to invoice

## 3.9 Expenses
- [ ] Expense CRUD API
- [ ] Receipt upload
- [ ] Expense categories
- [ ] Deductible flag
- [ ] Quarter assignment
- [ ] Expense filters and summaries

## 3.10 Invoices
- [ ] Invoice numbering service
- [ ] Invoice draft flow
- [ ] Issue invoice action
- [ ] Immutable issued snapshot
- [ ] Invoice lines editor
- [ ] Service period support
- [ ] Foreign client / no-IVA mode
- [ ] Withholding support
- [ ] Invoice PDF generation
- [ ] Invoice download endpoint

## 3.11 Payments
- [ ] Register payment API
- [ ] Partial payment support
- [ ] Multi-invoice allocation support
- [ ] FX metadata support
- [ ] Payment method support
- [ ] Reconciliation screen
- [ ] Unpaid / overdue indicators

## 3.12 Tax quarter
- [ ] Quarter calculator service
- [ ] Modelo 130 summary
- [ ] Modelo 303 summary
- [ ] Income issued vs paid summary
- [ ] Expense summary
- [ ] Quarter snapshot close action
- [ ] Quarter PDF export
- [ ] Quarter CSV export

## 3.13 Documents
- [ ] Local dev storage
- [ ] Abstract storage interface
- [ ] Upload validation
- [ ] File checksum
- [ ] Attach files to invoices
- [ ] Attach files to expenses
- [ ] Attach files to contracts

## 3.14 Reports
- [ ] Dashboard summaries
- [ ] Cash flow report
- [ ] Unpaid invoice report
- [ ] Expense by category report
- [ ] Yearly summary report

## 3.15 Quality
- [ ] Unit tests for money helpers
- [ ] Unit tests for tax helpers
- [ ] Unit tests for invoice numbering
- [ ] Integration tests for invoice issuing
- [ ] Integration tests for payment reconciliation
- [ ] E2E happy path
- [ ] CI pipeline
- [ ] Typecheck in CI
- [ ] Migration check in CI

## 3.16 Deployment
- [ ] Production Dockerfiles
- [ ] Reverse proxy config
- [ ] Environment docs
- [ ] Database backup strategy
- [ ] File backup strategy
- [ ] Basic observability
- [ ] Crash recovery docs

---

# 4. Recommended first implementation order

Do it in this order:

1. monorepo setup
2. DB schema
3. backend foundation
4. frontend shell
5. client CRUD
6. contract CRUD
7. expense CRUD
8. work periods
9. invoice generation
10. payment reconciliation
11. quarter summary
12. PDF exports
13. tests and hardening

That order gives you usable software early.

---

# 5. Strong opinionated choices

These are the ones I’d lock in now:

- Backend framework: Elysia
- ORM: Prisma
- Validation: Zod
- Data fetching: TanStack Query
- Forms: React Hook Form
- Auth: cookie session or simple JWT
- Money math: Decimal everywhere
- Architecture: modular monolith
- API style: REST + OpenAPI
- PDF strategy: server-side HTML to PDF
- Storage: local for dev, S3-compatible abstraction later

---

# 6. What I would do next

Next step should be:
define the monorepo structure, package names, scripts, and initial Prisma schema.

I can draft that next as a concrete starter scaffold with folders, package.json scripts, tsconfigs, and the first database models.