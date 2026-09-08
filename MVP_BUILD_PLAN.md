# MVP Build Plan — Invora Invoice

Status: Phase 12 — Optional Cloud Backup complete (see IMPLEMENTATION_STATUS.md)
Last updated: 2026-09-07

This document is the single source of truth for what we are building and how.
It is a planning/architecture contract only. No application code is written
in this phase.

---

## 0. Working tree inspection (Phase 0 result)

`d:\invora-invoice` is currently an **empty directory** — no existing Flutter,
React Native, or other project scaffold; no git repository; no dependencies;
no backend; no database; no navigation; no design system; no reusable
components. There is nothing to preserve and nothing to migrate.

Because there is no existing implementation, this plan is written as a
greenfield architecture contract. Every later phase must still re-inspect the
working tree before making changes, per the phase rules in Section 8.

---

## 1. Product summary

A lightweight mobile SaaS app for small businesses (~1–20 employees) in the
USA, UK and Europe, combining:

1. Professional invoicing
2. Customer / payment tracking
3. Digital business card
4. QR / share functionality
5. Offline-first data storage
6. Google Drive backup
7. Optional paid cloud backup

Design constraints: lightweight, fast, offline-first, easy for
non-accountants, professional, mobile-first, easy to maintain, modular, low
dependency, reliable with poor/no internet connection.

**This is not a POS, inventory, payroll, accounting-ledger, expense-tracker,
purchase-order, supplier-management, complex CRM, e-commerce, payment
processor, or AI-analytics product.** None of those are added unless
explicitly requested later.

---

## 2. Technology stack

The original architecture contract assumed Flutter. **That assumption is
replaced.** The app is built with:

| Concern | Technology |
|---|---|
| Framework | React Native via **Expo** (managed workflow) |
| Language | TypeScript (strict mode) |
| Local dev runtime | **Expo Go** app on the physical phone + Metro bundler running on the developer laptop, both on the **same Wi‑Fi network** (LAN connection, no tunnel/cloud relay needed for daily development) |
| Navigation | React Navigation (bottom tabs + native stack) |
| Local database | SQLite via `expo-sqlite` |
| ORM / query layer | **Drizzle ORM** (SQLite dialect) — schema-first, type-safe, migration-generating; the direct functional replacement for Drift |
| State management | **Zustand** for app/UI state; local DB is the source of truth for domain data (no Redux, no second competing state system) |
| Forms | React Hook Form + Zod validation |
| PDF generation | `expo-print` (HTML → PDF) + `expo-sharing` |
| QR code | `react-native-qrcode-svg` |
| Share (WhatsApp/Email/link) | `expo-sharing` + native share sheet (`Share` API) |
| Google Drive backup | Google OAuth via `expo-auth-session` + Google Drive REST API (App Data folder) |
| Optional cloud backup | Thin REST backend (technology decided in Phase 11/12, see Section 10 "Open decisions") |
| Testing | Jest + React Native Testing Library (unit/integration); Detox deferred unless a phase specifically needs device-level e2e |
| Icons / design tokens | To be finalized in Phase 14 (Google Stitch) |

Rationale for swaps:
- **Drift → Drizzle ORM**: both are type-safe, schema-first, low-dependency
  SQL layers with generated migrations and compile-time query safety — the
  closest functional analog for SQLite on React Native.
- **State management → Zustand**: minimal boilerplate, no code generation,
  small bundle size, matches the "low dependency / lightweight" rule. No
  competing state system will be introduced later.
- No dependency is added beyond this table without a stated technical reason
  in the phase that needs it.

### 2.1 Local development environment

- Developer runs `npx expo start` on the laptop. This starts the Metro
  bundler and prints a QR code / LAN URL.
- The phone runs the **Expo Go** app, connects to the **same Wi‑Fi network**
  as the laptop, and scans the QR code (or enters the LAN URL) to load the
  app — no cable, no cloud tunnel, no app-store build required for daily
  development.
- This LAN-based Expo Go workflow is the default for Phases 1–13. A move to
  EAS Build / a development build is only introduced if a native module
  outside the Expo SDK becomes unavoidable (to be flagged explicitly if it
  happens, not assumed up front).

---

## 3. Architecture

Layering is unchanged in intent from the original contract, mapped onto the
React Native stack:

```
Presentation (screens, components — React Native views)
        ↓
State / Controller (Zustand stores + view-models/hooks)
        ↓
Use Case / Domain (plain TypeScript functions/classes — business rules,
                    invoice totals, balance calculations, numbering, etc.)
        ↓
Repository Interface (TypeScript interfaces — e.g. InvoiceRepository)
        ↓
Repository Implementation (Drizzle-backed SQLite implementation;
                             later a Google Drive backup adapter,
                             later a cloud-backend adapter)
        ↓
Local Database (SQLite via expo-sqlite/Drizzle) / Remote API (Drive, cloud)
```

Hard rules (unchanged):
- UI components must **not** access the database directly.
- UI components must **not** make HTTP requests directly.
- Business calculations (totals, tax, discounts, balances, numbering,
  overdue status) must **not** live inside UI components — they live in the
  domain/use-case layer and are unit-testable in isolation.
- Repositories are accessed only through their interfaces from the
  state/controller layer; screens never import a Drizzle table or an HTTP
  client directly.

---

## 4. Backup architecture

- Local SQLite (via expo-sqlite/Drizzle) is the **primary, live, working
  database** on the device.
- Google Drive is a **backup destination only** — the app never reads Drive
  as its live data source.
- The optional paid cloud backup is a **second, optional backup
  destination**, also not a live database.
- The app must remain fully usable with invoicing, customers, items,
  payments, dashboard, search, PDF generation, QR generation, and the
  digital business card — with **zero internet connection**.
- Internet is required only for: Google Drive backup/restore, optional cloud
  backup/restore, account/subscription operations, and server-hosted share
  links (if/when that feature is built).

---

## 5. Core functionality modules

1. **Digital Business Card** — profile, digital card, social links
   (WhatsApp, Facebook, Instagram, Google Maps), share link, QR code, card
   sharing.
2. **Business / Company** — profile, logo, address, phone, email, website,
   currency, tax/VAT number, invoice prefix + numbering, business settings,
   invoice configuration.
3. **Invoice Type / Domain** — General, Quantity, Weight, Dimension, Custom.
   The selected type determines which item fields appear on an invoice.
4. **Items** — catalog, create/edit, search, SKU, price, unit, tax, weight,
   dimensions, invoice type/domain.
5. **Customers** — list, create/edit, search, detail, balance, invoice
   history, payment history, activity history.
6. **Invoices** — list, create (select customer → select items → dynamic
   fields → review), detail, edit, duplicate, numbering, status, due date,
   notes, terms.
7. **Payments** — record payment, payment history, payment methods, partial
   payments, paid/unpaid/overdue, remaining balance, customer balance.
8. **Dashboard** — total sales, paid, outstanding, overdue, invoice count,
   recent invoices, quick actions.
9. **PDF and Sharing** — invoice PDF, invoice templates, PDF sharing
   (WhatsApp, email, share link).
10. **Backup** — local backup, Google Drive automatic/manual backup,
    restore, backup history, error handling.
11. **Cloud Backup (optional, paid)** — storage usage, backup metadata,
    storage limits, cloud backup status.
12. **Settings** — business, invoice, backup, security, account,
    subscription, invoice template.

---

## 6. Data model

### 6.1 Local database entities (initial set)

`Business`, `InvoiceType`, `Customer`, `Item`, `Invoice`, `InvoiceItem`,
`Payment`, `SocialLink`, `AppSettings`, `BackupLog`.

Each entity is defined as a Drizzle schema (SQLite dialect) with generated
migrations. Exact column definitions are written in the phase that owns each
entity (e.g. `Customer` in Phase 5), not all up front, so schemas are
informed by the frontend behavior already validated with mock repositories.

### 6.2 Invoice item snapshot rule

`InvoiceItem` rows **must** store a historical snapshot of the item at the
time it was invoiced (name, price, unit, tax, etc.), independent of the
`Item` catalog row. If a catalog item is renamed or changes price later,
existing invoices must keep showing what was actually invoiced.

> Example: catalog item is renamed "Steel Tube" today. An old invoice created
> when it was called "Steel Pipe" must continue to display "Steel Pipe".

### 6.3 Payment rule

Payments are **separate, additive records**, never a single mutable
`amountPaid` field on `Invoice`.

> Example: Invoice = $1,000. Payment 1 = $300. Payment 2 = $200. Total paid =
> $500. Remaining = $500.

Customer outstanding balance is **always calculated** from the full set of
invoices and payments, never stored as a single cached number that can drift
out of sync.

### 6.4 Payment methods

Cash, Bank transfer, Card, PayPal, Other.

### 6.5 Payment status

Paid, Partial, Unpaid, Overdue.

### 6.6 Invoice type field matrix

| Type | Fields |
|---|---|
| General | Item, Quantity, Unit, Unit price, Discount, Tax |
| Quantity | Item, Quantity, Unit, Unit price, Discount, Tax |
| Weight | Item, Quantity, Weight, Unit price, Discount, Tax |
| Dimension | Item, Quantity, Length, Width, Height, Unit price, Discount, Tax |
| Custom | Business owner chooses from: item name, description, SKU, quantity, unit, weight, length, width, height, unit price, discount, tax |

---

## 7. Navigation

Primary navigation (bottom tabs): **Dashboard, Invoices, Customers,
Business.** No additional tabs are added.

### Screen groups

- **Digital Business Card**: Digital Card, QR Code, Share Card
- **Business**: Business Profile, Business Settings, Invoice Settings
- **Invoice Types**: Invoice Type Selection, Custom Invoice Type
- **Items**: Item List, Create Item, Edit Item
- **Customers**: Customer List, Create Customer, Customer Detail, Customer History
- **Invoices**: Invoice List, Create Invoice – Customer, Create Invoice – Items, Invoice Review, Invoice Detail
- **Payments**: Record Payment, Payment History
- **Dashboard**: Dashboard
- **PDF/Sharing**: Invoice PDF Preview, Invoice Sharing
- **Backup**: Backup & Restore, Backup History
- **Settings**: Settings, Invoice Templates, Security, Account/Subscription

---

## 8. Development approach

Built **functionality-by-functionality**, not screen-by-screen. Each
functionality may span multiple screens. Sequence per functionality:

1. Build frontend behavior using a mock/in-memory repository.
2. Build backend/API contract and implementation where required.
3. Build database schema and persistence (Drizzle + expo-sqlite).
4. Connect frontend to the real repository/API/database.
5. Test the complete functionality.
6. Only after it works end-to-end, apply Google Stitch visual polish.

The next functionality does not start until the current one is stable,
unless explicitly instructed otherwise.

### Per-phase checklist (A–N)

A. Inspect existing implementation.
B. Define functionality requirements.
C. Build frontend behavior using mock/in-memory repository.
D. Verify frontend behavior.
E. Define backend/API contracts if backend is required.
F. Implement backend.
G. Define and implement database persistence.
H. Connect real repository.
I. Test offline behavior.
J. Test error states.
K. Test loading states.
L. Test empty states.
M. Test navigation.
N. Verify existing functionality was not broken.

Google Stitch design work always happens **after** functional behavior is
stable — never immediately after mock data.

---

## 9. Development phases

| Phase | Scope |
|---|---|
| 0 | Project inspection and architecture contract *(this document)* |
| 1 | Digital Business Card |
| 2 | Business / Company |
| 3 | Invoice Type / Domain |
| 4 | Items |
| 5 | Customers |
| 6 | Invoices |
| 7 | Payments |
| 8 | Dashboard |
| 9 | PDF and Sharing |
| 10 | Settings |
| 11 | Google Drive backup |
| 12 | Optional cloud backup |
| 13 | Global offline-first integration |
| 14 | Google Stitch visual design integration |
| 15 | Final QA / performance / security audit |

Phases are never started automatically — each waits for an explicit
instruction to begin. Before every phase, the working tree is re-inspected.
Working code is never overwritten without first understanding it.

---

## 10. Open decisions (to confirm before the relevant phase)

These are flagged now, not decided now, so Phase 0 stays documentation-only:

- **Optional cloud backup backend** (Phase 11/12): still **not built or
  chosen** (e.g. a lightweight Node.js/Express API, or a managed
  backend-as-a-service) — Phase 12 built the complete mobile-side
  architecture (encryption, versioning, storage-limit handling, the
  `CloudBackupApi` REST contract) against this still-undeployed backend, the
  same way Phase 11 built Google Drive's real integration against a real,
  already-existing API. `RestCloudBackupApi` throws a clear
  `CloudBackupNotConfiguredError` until `expo.extra.cloudBackupApiUrl` is
  set — see `IMPLEMENTATION_STATUS.md`'s Phase 12 notes.
- **Subscription/payment provider** for the paid cloud tier (Phase 12):
  still **not selected** (e.g. Stripe/RevenueCat/native IAP) — Phase 12 kept
  this a deliberately isolated seam (`CloudUpgradeService`), with only a
  placeholder implementation (`PlaceholderCloudUpgradeService`) behind it,
  per the explicit "do not implement a complicated billing system" scope
  limit. Cloud backup itself works independently of whether this is ever
  filled in.
- ~~**Server-hosted share links** (Module 9/1)~~ — **resolved in Phase 9**:
  both the digital-card and invoice share links stay static, device-
  generated `invora://` deep links (`LocalShareLinkService`/
  `LocalInvoiceShareLinkService`), with no hosted redirect service. Revisit
  only if a real cross-device/web-viewable share link is explicitly
  requested later (that would need a small hosted service — see
  `IMPLEMENTATION_STATUS.md`'s Phase 9 notes for the documented future
  `RemoteInvoiceShareLinkService` contract).

---

## 11. Code quality rules

- Keep components small and composable; reuse common components across
  screens.
- Business logic and database logic stay out of components.
- API logic stays out of components.
- No unnecessary abstractions, no unnecessary packages.
- No duplicate models, repositories, or calculations.
- Keep the app lightweight and dependency-light.

---

## 12. Documentation

This file (`MVP_BUILD_PLAN.md`) and `IMPLEMENTATION_STATUS.md` are
maintained together. `IMPLEMENTATION_STATUS.md` records, for every completed
functionality: what was built, files changed, database changes, API
changes, tests, known limitations, and the next phase.
