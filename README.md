# DACC

A Spain-first freelancer finance/accounting app for tracking income, expenses, invoices, payments, and quarterly tax preparation.

## Goals

- Track income and expenses clearly
- Handle issued vs paid invoices
- Generate invoice PDFs
- Prepare data for quarterly tax declarations
- Keep records organised for audits and annual reporting

## Current app

The invoice editor runs entirely in the browser using React, TypeScript and React Router in SPA mode. IndexedDB stores saved invoice profiles locally; no API, account, or database server is required. The features and domain model below describe the longer-term accounting roadmap.

### Profiles and invoices

The top navbar always shows the active profile. Its selection is saved locally. The root page lists only that profile's invoices; **Nueva factura** creates a new invoice for that profile, and **Abrir** edits an existing one. Changing profiles returns to the list and asks before discarding an unsaved invoice.

Use **Perfiles y empresas** to create or rename a profile and save its company details, default language, and logo preference. Each invoice has a stable ID and belongs to exactly one profile. Saving another invoice does not overwrite earlier invoices. New invoices inherit the active profile's defaults; saved invoices retain their own company snapshot and recipient.

Existing version 1 data migrates automatically: each former invoice/profile record becomes a named profile with its original invoice. The old IndexedDB store and localStorage value remain as recovery copies and are no longer updated.

### Local database and device transfers

1. Save your invoice with **Guardar factura** or **Guardar e imprimir**.
2. Open **Settings**, select the source profile, and click **Download backup** to export only that profile and its saved invoices as a version 2 JSON file.
3. Create a destination profile if needed, then choose the file under **Restore backup**. Choose the destination and confirm **Replace profile data**. Older backups containing multiple profiles also let you choose the source profile.

Restoring replaces only the destination's invoices and company defaults (including language and logo preference), preserving its name and ID. Other profiles remain unchanged. Imported invoices receive new IDs so a backup can safely be restored into another profile in the same browser or on another device. A profile with no invoices clears the destination's invoices. Download a backup first if you need the destination's records. Unsaved edits are not included. Imports are validated and applied atomically. Version 1 backups remain importable; backups containing no profiles cannot be restored into a profile. Import size is limited to 10 MB.

IndexedDB and SQLite are different database formats. These JSON backups are portable between DACC instances in browsers; they are not `.sqlite` files. Files contain unencrypted invoice and company data.

Browser storage belongs to the current browser profile and site address. Clearing site data removes the database, and private browsing may not retain it. Keep downloaded backups. Device transfer is manual, not synchronization. The app needs a static web host to load; offline reload support is not included.

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

- Node.js 22+ and npm
- The `decss` Git submodule (`git submodule update --init --recursive`)

```sh
npm ci
npm run dev
```

### Checks and production build

```sh
npm test
npm run typecheck
npm run build
npm start
```

`npm start` previews the static build locally. Deploy `build/client` to a static host for production. The Dockerfile builds the SPA and serves it with nginx on port 80.

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

Money and quantities use `Intl.NumberFormat`. Amounts retain the app's existing USD currency. Dates and company/profile/invoice content remain as entered, avoiding reinterpretation of existing free-text dates. The language preference is browser-local and is not part of database backups.
