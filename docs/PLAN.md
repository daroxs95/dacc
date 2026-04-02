Bun + Vite + React + plain CSS + strict TypeScript + PostgreSQL + Elysia.
---

# 1. Course of action

## 1.1 Product goal

Build a personal finance + freelancer tax assistant for Spain that lets you:

- track income, expenses, payments and cash flow
- manage clients and contracts
- issue compliant invoices
- track unpaid vs paid invoices
- prepare quarterly tax data for:
    - Modelo 130
    - Modelo 303
- keep evidence and bookkeeping records ready for review
- handle your specific case:
    - foreign client
    - no IVA charged in normal cases
    - delayed payments
    - invoices tied to service periods

This app is not “general accounting software”.
It is a focused freelancer finance OS.

---

## 1.2 Main product decisions

### A. Accounting model
Use invoice-based bookkeeping, not just payment-based bookkeeping.

Reason:
- you need to know:
    - what was worked
    - what was invoiced
    - what was paid
    - what belongs to which quarter

So the core domain objects should be separate:

- Work Period
- Invoice
- Payment
- Expense
- Tax Quarter

That avoids the classic mess where one table tries to represent everything.

---

### B. Spain-first domain rules
The app should model these concepts explicitly:

- income issued but unpaid
- expenses deductible in a quarter
- foreign client invoices without Spanish IVA
- quarterly aggregation
- annual reconciliation
- withholding tracking
- exchange rate metadata when payment arrives in another currency
- invoice service period vs invoice issue date

These are not optional details.
They are the core of the app.

---

### C. Architecture style
Use a modular monolith first.

Do not split into microservices.

You are one user, one app, one domain.
A modular monolith will be faster to build, easier to reason about, and still clean.

---

## 1.3 Recommended monorepo structure

finance-os/
apps/
web/                 # Vite + React
api/                 # Elysia + Bun
packages/
db/                  # Prisma schema, migrations, DB types
shared/              # shared TS types, constants, helpers
ui/                  # optional reusable React UI primitives
validation/          # zod schemas
config/              # tsconfig, eslint, shared build config
docs/
architecture/
tax-rules/
decisions/
scripts/
docker/
.github/

---

## 1.4 Tech stack

### Frontend
- Vite
- React
- TypeScript strict
- plain CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- date-fns or dayjs
- Recharts only if charts are needed later

### Backend
- Bun
- Elysia
- Zod / Elysia validation
- Prisma with PostgreSQL
- JWT or cookie session auth
- OpenAPI generation
- structured logging

### Database
- PostgreSQL
- Prisma migrations
- UUID primary keys for business entities
- numeric/decimal types for money, never float

### Tooling
- Bun workspaces
- Biome or ESLint + Prettier
- Vitest or Bun test
- Docker Compose
- GitHub Actions

---

## 1.5 Core modules

### 1. Clients
Stores:
- legal name
- tax ID if available
- country
- billing currency
- billing preferences
- contract notes
- default invoice language
- default tax behaviour

### 2. Contracts
Stores:
- client
- start/end dates
- hourly or fixed rate
- billing cadence
- invoice window
- payment terms
- payment methods
- withholding rules
- IVA applicability
- contract clause snapshots

Important because your tax and invoice logic depends on the contract.

### 3. Work periods
Stores:
- month / service period
- expected hours
- approved hours
- billable amount
- status:
    - draft
    - ready to invoice
    - invoiced
    - partially paid
    - paid

### 4. Invoices
Stores:
- invoice number
- issue date
- service period start/end
- currency
- subtotal
- withholding
- IVA
- total
- notes
- PDF snapshot
- status

### 5. Payments
Stores:
- linked invoice(s)
- received date
- amount received
- original currency
- converted currency
- exchange rate
- payment method
- reference
- fees
- reconciliation notes

### 6. Expenses
Stores:
- supplier
- category
- issue date
- payment date
- deductible flag
- amount net
- VAT amount
- total
- receipt file
- linked quarter
- notes

### 7. Tax quarters
Stores aggregated values for:
- revenue issued
- revenue collected
- deductible expenses
- VAT outputs
- VAT inputs
- model 130 estimate
- model 303 estimate
- notes and audit snapshot

### 8. Documents
Stores:
- invoice PDFs
- receipts
- contracts
- tax reports
- quarter exports

---

## 1.6 MVP scope

Build only what solves the real pain first.

### MVP features
- dashboard
- clients CRUD
- contracts CRUD
- expense CRUD
- work period tracking
- invoice creation
- invoice PDF generation
- payment registration
- quarter view
- Modelo 130 summary view
- Modelo 303 summary view
- CSV export
- PDF export for quarter dossier

### Not in MVP
- bank sync
- OCR receipts
- multi-user
- role system
- mobile app
- AI bookkeeping assistant
- automatic AEAT submission
- full accounting ledger

---

## 1.7 Suggested UX

### Main screens
- Dashboard
- Clients
- Contracts
- Work Periods
- Invoices
- Payments
- Expenses
- Tax Quarters
- Documents
- Settings

### Dashboard widgets
- unpaid invoices
- revenue this quarter
- expenses this quarter
- estimated modelo 130
- estimated modelo 303
- upcoming invoice window
- missing receipts
- payment delays

---

## 1.8 Important business rules

These should live in code as explicit services, not random UI logic.

### Invoice rules
- invoice number must be unique and sequential per series
- invoice issue date drives quarter assignment
- service period is informational but also reportable
- one payment can settle many invoices
- one invoice can be paid in many payments

### Money rules
- use Decimal
- store money as:
    - amount
    - currency
- never store computed totals only; persist snapshots

### Tax rules
Keep rules configurable:
- IVA percentage
- IVA exempt reason
- withholding percentage
- quarterly close dates
- foreign client classification
- tax residency assumptions

Do not hardcode too much.
Spain rules change, and your exact setup may evolve.

---

## 1.9 API design

Use typed REST first.

Why not GraphQL here:
- domain is operational, not content-heavy
- REST is simpler for invoices, expenses, quarters and exports
- OpenAPI docs are useful
- easier integration with file downloads and PDFs

### Example route groups

/api/health
/api/auth/*
/api/clients/*
/api/contracts/*
/api/work-periods/*
/api/invoices/*
/api/payments/*
/api/expenses/*
/api/tax-quarters/*
/api/reports/*
/api/files/*
/api/settings/*

---

## 1.10 Database design approach

### Main entities
- User
- Client
- Contract
- WorkPeriod
- Invoice
- InvoiceLine
- Payment
- PaymentAllocation
- Expense
- ExpenseCategory
- TaxQuarter
- TaxSnapshot
- DocumentFile
- AppSetting

### Important relations
- Client 1..n Contract
- Contract 1..n WorkPeriod
- WorkPeriod 0..1 Invoice
- Invoice 1..n InvoiceLine
- Invoice n..n Payment through PaymentAllocation
- TaxQuarter 1..n Expense
- TaxQuarter 1..n Invoice
- Invoice / Expense / Contract 0..n DocumentFile

---

## 1.11 PDF and reporting strategy

Generate these documents:

### Invoice PDF
- legal header
- issuer data
- client data
- service period
- line items
- subtotal
- withholding
- VAT note
- total due
- payment instructions
- legal notes

### Quarterly dossier PDF
- quarter summary
- issued invoices list
- received payments list
- expenses list
- estimated Modelo 130
- estimated Modelo 303
- supporting notes

### Exports
- CSV
- JSON backup
- printable quarter summary

---

## 1.12 Security and correctness

### Security
- local auth for now
- password hashing
- CSRF-safe auth style
- rate limiting
- audit log for edits to invoices / expenses / quarter closes

### Correctness
- immutable invoice snapshots after issue
- immutable quarter snapshots after close
- append-only payment records
- file checksum for uploaded documents

For finance apps, correctness beats convenience.

---

## 1.13 Testing strategy

### Unit tests
- tax calculation helpers
- invoice numbering
- money arithmetic
- quarter assignment
- withholding logic
- payment allocation

### Integration tests
- create invoice -> register payment -> quarter summary
- expense creation -> quarter aggregation
- invoice PDF generation
- report export

### E2E
- create client
- create contract
- create work period
- generate invoice
- record payment
- inspect quarter report

Bun has a built-in TypeScript-capable test runner, which fits well here.

---

## 1.14 Delivery phases

### Phase 0 — foundation
- monorepo
- strict TS
- DB
- auth
- shared validation
- layout shell

### Phase 1 — bookkeeping core
- clients
- contracts
- work periods
- expenses

### Phase 2 — invoicing
- invoice builder
- invoice numbering
- PDF generation
- status flow

### Phase 3 — payments and reconciliation
- payment registration
- partial payments
- FX support
- unpaid tracking

### Phase 4 — tax quarters
- quarter calculations
- reports
- exports

### Phase 5 — hardening
- audit logs
- snapshots
- tests
- backups
- deployment