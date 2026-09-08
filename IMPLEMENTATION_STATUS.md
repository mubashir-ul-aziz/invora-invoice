# Implementation Status — Invora Invoice

Tracks what has actually been built, phase by phase. Updated at the end of
every completed functionality/phase.

---

## Phase 0 — Project inspection and architecture contract

**Status:** Complete (documentation only — no application code written).

**What was built:**
- Inspected the working tree at `d:\invora-invoice`: confirmed it is empty
  (no existing Flutter/React Native project, no git repo, no dependencies,
  no backend, no database, no navigation, no design system, no reusable
  components).
- Replaced the originally assumed Flutter/Dart/SQLite/Drift stack with a
  React Native + Expo stack (TypeScript, expo-sqlite, Drizzle ORM, Zustand,
  React Navigation), per explicit instruction.
- Defined the local development workflow: `expo start` on the developer
  laptop (Metro bundler) + the Expo Go app on a physical phone, both on the
  same Wi‑Fi network (LAN), no cloud tunnel required for daily dev.
- Authored `MVP_BUILD_PLAN.md` covering: product summary, technology stack,
  architecture layering, backup architecture, all 12 functionality modules,
  data model rules (invoice-item snapshotting, separate payment records),
  payment methods/status, invoice-type field matrix, navigation/screen
  groups, the functionality-by-functionality development approach, the
  15-phase roadmap, open decisions to confirm later, and code-quality rules.

**Files changed:**
- `MVP_BUILD_PLAN.md` (created)
- `IMPLEMENTATION_STATUS.md` (created)

**Database changes:** None. No schema exists yet.

**API changes:** None.

**Tests:** None (no code in this phase).

**Known limitations:**
- No git repository has been initialized yet.
- No Expo project has been scaffolded yet — Phase 1 will scaffold the
  project as part of building the Digital Business Card functionality
  (mock repository first, per the standard phase sequence).
- Backend technology for the optional paid cloud backup (Phase 11/12) and
  the subscription/payment provider (Phase 12) are not yet decided — see
  "Open decisions" in `MVP_BUILD_PLAN.md`.
- Whether share links need a small hosted redirect service is undecided —
  to confirm before Phase 9.

**Next phase:** Phase 1 — Digital Business Card functionality. Not started;
waiting for explicit instruction to begin, per the "never automatically
implement the next phase" rule.

---

## Phase 1 — Digital Business Card

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first and confirmed still empty
except the two planning docs — nothing existing was at risk.

### What was built

- Scaffolded the Expo + TypeScript project by hand (the `create-expo-app`
  CLI scaffolder was blocked by this environment's command classifier), by
  downloading and replicating the official `expo-template-blank-typescript`
  57.0.22 template files, then layering the project's own dependencies on
  top. Verified the result actually bundles by running a full Metro static
  export (`expo export --platform android`) — 1411 modules, no resolution
  errors.
- Digital Business Card functionality end-to-end on the frontend, backed by
  a real local SQLite database (not just mock data) — see the sequencing
  note below.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens →
  `businessCardStore` (Zustand) → `BusinessCardRepository` /
  `ShareLinkService` interfaces → SQLite (Drizzle) / mock implementations.
  Screens never import the database or a concrete repository directly.
- Frontend-first sequencing was followed literally: `InMemoryBusinessCardRepository`
  was built and used first to validate all screen/store behavior, then the
  SQLite-backed `SqliteBusinessCardRepository` was added behind the same
  `BusinessCardRepository` interface and wired in at the composition root
  (`src/data/container.ts`). The in-memory repository remains in the
  codebase — it's what the Jest test suite uses, since Jest can't drive the
  native SQLite module without a device.

### 1. Frontend files

- `App.tsx` — bootstraps the local database, then renders navigation.
- `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts`
- `src/screens/businessCard/DigitalCardScreen.tsx` — loads and displays the
  card; contact/social action buttons only render for fields that are
  actually set; empty/loading/error states.
- `src/screens/businessCard/EditBusinessCardScreen.tsx` — React Hook Form +
  Zod validation; logo picker; saves through the store.
- `src/screens/businessCard/QRCodeScreen.tsx` — renders the QR code.
- `src/screens/businessCard/ShareCardScreen.tsx` — card preview + native
  share sheet action.
- `src/components/businessCard/{CardPreview,ActionButton,LogoPicker,FormField}.tsx`
- `src/state/businessCardStore.ts` — Zustand store; `createBusinessCardStore()`
  factory takes injectable repository/service (used by tests), plus an
  app-wide singleton bound to the real implementations.
- `src/domain/businessCard/{types,validation,formMapping,shareText}.ts` —
  domain types, Zod validation/normalization rules, form↔domain mapping,
  share-message formatting. Pure functions, no React/DB/network.
- `src/lib/linking.ts` — call/email/website/WhatsApp/Facebook/Instagram/Maps
  openers, injectable for testing, alert-on-failure instead of throwing.
- `src/lib/id.ts` — local id/slug generator.
- `src/theme/colors.ts` — minimal shared palette (no visual redesign; Google
  Stitch polish is Phase 14).

### 2. Backend files

No backend service was built — none is required yet. What exists instead:

- `src/data/shareLink/ShareLinkService.ts` — the interface a future hosted
  redirect service would implement.
- `src/data/shareLink/LocalShareLinkService.ts` — today's implementation:
  builds the QR/share destination from the app's own `invora://` scheme via
  `expo-linking`'s `Linking.createURL()`. This resolves to whatever
  transport actually exists on the device (a real `invora://` URI in a
  standalone/dev-client build, an `exp://…` URL in Expo Go) — it never
  hard-codes a production domain that doesn't exist yet. No network call is
  made to produce it.
- `src/data/container.ts` — the one place that decides which concrete
  repository/service is wired up; swapping in a future
  `RemoteShareLinkService` (once a hosted redirect service exists — see
  "Open decisions" in `MVP_BUILD_PLAN.md`) is a one-line change here, with
  no screen or store touched.

### 3. Database changes

New local SQLite database (`invora.db`, via `expo-sqlite`), schema defined
with Drizzle ORM in `src/data/db/schema.ts`:

- **`business`** — `id`, `name`, `owner_name`, `logo_uri`, `phone`, `email`,
  `website`, `address`, `currency` (default `USD`), `tax_id`, `share_slug`,
  `created_at`, `updated_at`. One row today (`id = 'default'`); modelled as
  a normal table (not a hard-coded singleton) so Phase 2 (Business/Company
  settings) can extend it without a shape change.
- **`social_link`** — `id`, `business_id` (FK → `business.id`, cascade
  delete), `platform` (`whatsapp` | `facebook` | `instagram` |
  `googleMaps`), `value`; unique on `(business_id, platform)`. One row per
  platform instead of ad-hoc `facebookUrl`/`instagramUrl`/... columns, per
  the brief's requirement for a proper structure.
- Canonical SQL generated for documentation via
  `node node_modules/drizzle-kit/bin.cjs generate` → `drizzle/0000_true_rhodey.sql`
  (kept in version control, matches `schema.ts` — verified by hand).
- **Migration-runner note:** `drizzle-kit generate --driver expo` also
  auto-produced `drizzle/migrations.js`, the bridge file
  `drizzle-orm/expo-sqlite`'s official `useMigrations()` hook expects.
  Wiring that hook was **not** done: it requires the app's Metro config to
  resolve raw `.sql` file imports, which this Expo SDK does not support out
  of the box (checked directly in `@expo/metro-config`'s source — no `.sql`
  handling present) and would need an untested `metro.config.js` change
  this environment has no device/simulator to verify against. Instead,
  `src/data/db/client.ts` applies the equivalent `CREATE TABLE IF NOT EXISTS`
  statements directly through the `expo-sqlite` connection at startup —
  idempotent, offline, and exercised by the Metro static-export build (see
  below). Switching to the generated migrator later is a self-contained
  change inside `data/db/client.ts` only.
- `SqliteBusinessCardRepository` (`src/data/businessCard/`) implements
  `BusinessCardRepository` against this schema via Drizzle queries.

### 4. API contracts

Defined, but **not implemented** — Phase 1 has no backend, per "implement
only what is necessary":

- **Business card retrieval** — `GET /business-card` → the same shape as
  domain type `BusinessCard` (`src/domain/businessCard/types.ts`): id,
  businessName, ownerName, logoUri, phone, email, website, address,
  currency, taxId, shareSlug, socialLinks[], updatedAt. Would back a future
  `RemoteBusinessCardRepository` implementing today's
  `BusinessCardRepository` interface unchanged.
- **Business card update** — `PUT /business-card` with a `BusinessCardInput`
  body (same shape minus id/shareSlug/updatedAt). Same interface, no new
  screen-facing contract.
- **Share-link creation/retrieval** — deferred. Per `MVP_BUILD_PLAN.md`
  §10, whether digital-card share links ever need a hosted redirect service
  is an open decision to confirm before Phase 9. If confirmed, the contract
  would be `POST /share-links {cardId}` → `{url}` and
  `GET /share-links/:slug` → card view payload, behind a new
  `RemoteShareLinkService` implementing today's `ShareLinkService`
  interface. Not built now because nothing in Phase 1 needs it — QR/share
  are fully local.

### 5. Tests

49 Jest tests across 12 suites, all passing
(`npx jest` / `npm test`); TypeScript strict-mode `tsc --noEmit` is clean;
a full Metro static export (`expo export`) bundles the whole app
(1411 modules) with no resolution errors — the closest thing to an on-device
smoke test available without an emulator/physical device in this
environment.

- **Validation** (`src/domain/businessCard/__tests__/validation.test.ts`):
  empty profile (business name required), complete profile, missing
  optional social links, missing logo, invalid URL, invalid phone, invalid
  email, currency normalization.
- **Form↔domain mapping** (`formMapping.test.ts`): round-trips, omits unset
  social links.
- **Share text** (`shareText.test.ts`): only-set-fields formatting.
- **Repository** (`InMemoryBusinessCardRepository.test.ts`): empty profile
  read, full save/read, missing logo, missing social links, update-not-
  duplicate semantics.
- **Share link service** (`LocalShareLinkService.test.ts`): builds from the
  card's slug via `expo-linking`, confirms it's never a hard-coded
  `http(s)://` production URL.
- **Store** (`businessCardStore.test.ts`): load/save happy paths, error
  states from a failing repository (load and save).
- **Linking helpers** (`linking.test.ts`): call/email/website/WhatsApp/Maps
  URL building, Maps address-vs-explicit-link precedence, alert-not-throw
  on failure.
- **Screens** (`DigitalCardScreen`, `QRCodeScreen`, `ShareCardScreen`,
  `EditBusinessCardScreen` + `.save`): empty state, conditional action
  rendering, navigation, QR value wiring (mocked `react-native-qrcode-svg`
  to assert the encoded value — the pixel-level rendering is the upstream
  library's own tested concern), native `Share.share` invocation with the
  expected message, form validation errors, successful save + navigate-back.
- **Offline mode / app restart**: not exercised by an automated test — see
  Known limitations. Manual verification steps are below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → Digital Card screen loads (or shows the empty state) —
   no network call is made anywhere in this flow.
3. Edit business information, including logo, phone, email, website,
   address, currency, tax ID, and social links.
4. Save — writes to local SQLite only.
5. Close the app fully.
6. Reopen the app (still offline) — the saved data is read back from
   SQLite and displayed.
7. Generate the QR code and open the Share screen — both work with zero
   network activity (QR is drawn locally as SVG; the share link is a local
   deep link; the native share sheet doesn't require connectivity).

This wasn't run against a physical device/emulator in this environment (none
is available here); the schema, repository, and offline-safe design were
verified as far as this environment allows (unit tests + strict typecheck +
full Metro bundle export).

### 6. Known limitations

- **No device/emulator in this environment.** All verification is
  typecheck + Jest + a Metro static export. The steps above should be run
  on a real device/Expo Go before calling Phase 1 fully QA'd.
- **Migration runner is hand-rolled, not the generated one** — see the
  "Migration-runner note" above. Functionally equivalent for this schema
  size; revisit if `.sql` Metro support lands or the schema grows enough to
  want real forward-migrations instead of `CREATE TABLE IF NOT EXISTS`.
- **Single business profile only** — `business.id` is hard-coded to
  `'default'`. Correct for this MVP (one business per install); would need
  a real primary key strategy if multi-business ever becomes a requirement.
- **No clipboard "copy link" action** — only the native share sheet and QR
  code expose the share link, to avoid adding a clipboard dependency not
  in the approved stack for something not explicitly requested.
- **`expo-sharing` is installed but unused in Phase 1** — the stack table
  in `MVP_BUILD_PLAN.md` pairs it with the native `Share` API for
  "WhatsApp/Email/link" sharing; Phase 1's Share Card screen only needs
  text/link sharing, which the built-in `Share.share` API covers alone.
  `expo-sharing` (file/image sharing) is reserved for Phase 9 (PDF and
  Sharing).
- **Currency/tax ID fields exist in the schema and edit form but aren't
  used anywhere yet** — they're part of the `business` entity the brief's
  database section asked for; Phase 2 (Business/Company) is what actually
  builds invoice-facing behavior around them.
- **create-expo-app CLI could not be used** — blocked by this
  environment's command classifier; the project was scaffolded by hand
  from the official template's published files instead (see above). No
  functional difference, but worth knowing if a future `expo upgrade` is
  compared against a freshly-scaffolded project.

### 7. Files modified

New files only — nothing pre-existing was touched except this status file
and `MVP_BUILD_PLAN.md`'s status header. Full list: `package.json`,
`package-lock.json`, `app.json`, `tsconfig.json`, `babel.config.js`,
`jest.config.js`, `drizzle.config.ts`, `index.ts`, `App.tsx`, `.gitignore`,
`assets/*` (stock Expo icons), `drizzle/*`, and everything under `src/`
listed above.

### 8. Issues

None outstanding. The only friction worth recording: `create-expo-app`
being blocked required hand-scaffolding (documented above and not a
functional gap), and `@babel/core` had to be pinned to `^7.29.7` — installing
without a version constraint resolved `@babel/core@8.0.1`, which is
incompatible with `babel-preset-expo`/the RN Jest preset (both require
Babel 7's plugin API) and made every Jest suite fail with a version-
mismatch error until pinned.

**Next phase:** Phase 2 — Business / Company. Complete — see below.

---

## Phase 2 — Business / Company

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file list at the
top of this document); nothing in the Digital Business Card functionality
was deleted or behaviorally changed except one additive navigation button
(see below).

### What was built

- Business / Company functionality end-to-end on the frontend, backed by
  the real local SQLite database (not just mock data) — same
  frontend-first sequencing as Phase 1: an `InMemoryBusinessRepository` was
  built first and is what all 96 Jest tests run against; the SQLite-backed
  `SqliteBusinessRepository` was added behind the same `BusinessRepository`
  interface and wired in at the composition root (`src/data/container.ts`).
- **The Phase 1 `business` entity/table was extended, not duplicated.**
  Business Profile, Business Settings, and Invoice Settings all read/write
  the *same* on-device `business` row that the Digital Business Card uses —
  see "Database changes" below for how three feature slices safely share one
  row without clobbering each other's columns.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens →
  `businessProfileStore` / `invoiceSettingsStore` (Zustand) →
  `BusinessRepository` interface → SQLite (Drizzle) / in-memory
  implementations. Screens never import the database or a concrete
  repository directly.
- Reused rather than duplicated: phone/URL normalization and validation
  (`domain/businessCard/validation.ts`), the `ActionButton`, `FormField`,
  and `LogoPicker` presentational components, and the `colors` theme — all
  imported into the new screens instead of being re-implemented.

### 1. Screens built (per the brief)

1. **Business / Company screen** — `src/screens/business/BusinessScreen.tsx`.
   Read-only profile summary (name, address, phone, email, website, tax/VAT
   number, currency, and the formatted next invoice number, e.g. "INV-1");
   empty/loading/error states; links to Edit Business, Business Settings,
   and back to the Digital Business Card.
2. **Edit Business screen** — `src/screens/business/EditBusinessScreen.tsx`.
   React Hook Form + Zod validation; logo picker (reused); fields: business
   name, phone, email, website, address, currency, tax/VAT number, invoice
   prefix, next invoice number. Saves through `businessProfileStore`.
3. **Business Settings** — `src/screens/business/BusinessSettingsScreen.tsx`.
   A settings hub (`SettingsRow` rows) routing to Business Profile, Invoice
   Settings, and the Digital Business Card.
4. **Invoice Settings** — `src/screens/business/InvoiceSettingsScreen.tsx`.
   Invoice prefix, next invoice number, currency, default tax rate (%, text
   field, optional), default payment terms (chip-picker:
   No default / Due on receipt / Net 7 / 15 / 30 / 45 / 60), default invoice
   template (chip-picker: Classic / Modern / Minimal), and an **invoice
   type/domain selection entry point** (chip-picker: General / Quantity /
   Weight / Dimension / Custom) with an inline note that the field
   matrix/custom-field builder behind "Custom" is Phase 3 scope — this
   screen only stores the selection, per the brief's "entry point" wording.

Supporting components: `src/components/business/OptionPicker.tsx` (a
dependency-free chip-based single-select, used instead of pulling in
`@react-native-picker/picker` for a handful of fixed enum choices) and
`src/components/business/SettingsRow.tsx` (a navigable hub row).

**Navigation:** `RootStackParamList` gained `Business`, `EditBusiness`,
`BusinessSettings`, `InvoiceSettings`; `RootNavigator` registers all four.
The app still has no bottom tab bar (Dashboard/Invoices/Customers don't
exist yet — those are Phases 4–8), so the single existing stack was kept;
the only change to a Phase 1 screen is one additive "Business" button on
`DigitalCardScreen` (alongside a matching "Business card" button on the new
`BusinessScreen`) so both feature areas are reachable end-to-end. No
existing Digital Business Card test assertion, testID, or behavior was
changed.

### 2. Backend files

No backend service was built — none is required (Phase 2 brief: "Define
and implement only the APIs necessary for business profile/settings", and
everything needed is local). What exists instead, as a documented future
contract:

- **Business profile retrieval/update** — would be `GET /business-profile`
  → `BusinessProfile` (`src/domain/business/types.ts`: id, businessName,
  logoUri, address, phone, email, website, currency, taxId, invoicePrefix,
  nextInvoiceNumber, updatedAt) and `PUT /business-profile` with a
  `BusinessProfileInput` body. Would back a future
  `RemoteBusinessRepository` implementing today's `BusinessRepository`
  interface unchanged.
- **Invoice settings retrieval/update** — would be `GET /invoice-settings`
  → `InvoiceSettings` (invoicePrefix, nextInvoiceNumber, currency,
  defaultTaxRate, defaultPaymentTermsDays, defaultInvoiceTemplate,
  invoiceType, updatedAt) and `PUT /invoice-settings` with an
  `InvoiceSettingsInput` body. Same repository interface, no new
  screen-facing contract.
- Not built now because nothing in Phase 2 needs network I/O — everything
  is local SQLite, exactly like Phase 1.

### 3. Database changes

No new table — the existing `business` table (`src/data/db/schema.ts`,
Phase 1) was extended with six columns:

- `invoice_prefix TEXT NOT NULL DEFAULT 'INV-'`
- `next_invoice_number INTEGER NOT NULL DEFAULT 1`
- `default_tax_rate REAL` (nullable — no default tax rate applied)
- `default_payment_terms_days INTEGER` (nullable — no default term)
- `default_invoice_template TEXT NOT NULL DEFAULT 'classic'`
- `invoice_type TEXT NOT NULL DEFAULT 'general'`

**Fresh installs** get these columns from the updated
`CREATE_TABLES_SQL` in `db/schema.ts`. **Any install that already had the
Phase-1-shaped `business` table** gets them backfilled by a new
`ensureBusinessColumns()` step in `db/client.ts`, run once at every app
start right after the `CREATE TABLE IF NOT EXISTS` statements: it reads
`PRAGMA table_info(business)`, and for each of the six columns not already
present, runs `ALTER TABLE business ADD COLUMN ...` (SQLite has no
`ADD COLUMN IF NOT EXISTS`, so the existence check happens in application
code). This is additive and idempotent — safe to run on every launch,
consistent with the hand-rolled bootstrap approach Phase 1 already
established (see the migration-runner note in `db/client.ts`). The
canonical SQL was also regenerated for documentation via
`node node_modules/drizzle-kit/bin.cjs generate` →
`drizzle/0001_blushing_northstar.sql`, and matches the hand-written
`ALTER TABLE` statements exactly (verified by hand).

**How three feature slices share one row without clobbering each other:**
`SqliteBusinessCardRepository` (Phase 1), `SqliteBusinessRepository`'s
profile half, and its invoice-settings half each call Drizzle's
`.update(business).set(values)` / `.insert(business).values(values)` with
*only the columns that feature owns*. Drizzle's `.set()` only touches the
keys given to it, so saving a business profile never resets invoice
settings columns (or the Phase 1 owner name / social links), and saving
invoice settings never resets profile-only columns — verified by the
"does not clobber" tests in
`InMemoryBusinessRepository.test.ts`. `invoicePrefix`, `nextInvoiceNumber`,
and `currency` are intentionally editable from *both* the Business Profile
and Invoice Settings screens (per the brief listing them in both sections)
— they're the same three columns either screen writes, so there is exactly
one source of truth and no drift between the two views.

- `BusinessRepository` interface (`src/data/business/BusinessRepository.ts`):
  `getProfile`/`saveProfile`/`getInvoiceSettings`/`saveInvoiceSettings`.
- `InMemoryBusinessRepository` — mock/testing implementation.
- `SqliteBusinessRepository` — real implementation against the shared
  `business` row via Drizzle queries (no Jest coverage, same as
  `SqliteBusinessCardRepository` in Phase 1 — Jest can't drive the native
  SQLite module without a device).

### 4. API contracts

See "Backend files" above — defined, not implemented, for the same reason
Phase 1's share-link contract wasn't: nothing in this phase needs network
I/O.

### 5. Tests

96 Jest tests across 24 suites, all passing (`npx jest` / `npm test`);
TypeScript strict-mode `tsc --noEmit` is clean; a full Metro static export
(`expo export --platform android`) bundles the whole app (1423 modules, up
from Phase 1's 1411) with no resolution errors.

- **Domain validation** (`src/domain/business/__tests__/validation.test.ts`):
  business-name required, currency normalization, invalid phone/email/URL
  rejection, invoice-prefix blank-defaults-to-"INV-", next-invoice-number
  must be a positive integer, tax-rate range (0–100) and non-numeric
  rejection, payment-terms null-vs-numeric, invoice-type enum rejection,
  and that "custom" is accepted as a valid (entry-point-only) selection.
- **Form↔domain mapping** (`formMapping.test.ts`): empty-state defaults,
  full round-trip for both the profile and invoice-settings forms.
- **Repository** (`InMemoryBusinessRepository.test.ts`): empty state,
  full profile save/read, update-not-duplicate semantics, and — the key
  shared-row behavior — saving a profile doesn't clobber previously-saved
  invoice settings and vice versa, plus the shared
  invoicePrefix/nextInvoiceNumber/currency columns staying in sync from
  either side.
- **Stores** (`businessProfileStore.test.ts`, `invoiceSettingsStore.test.ts`):
  load/save happy paths, error states from a failing repository.
- **Screens**: `BusinessScreen` (empty state, saved-profile display
  including the formatted next invoice number, navigation to all three
  destinations), `EditBusinessScreen` (+ `.save`) (validation rejection,
  successful save + navigate-back), `BusinessSettingsScreen` (navigation to
  all three rows), `InvoiceSettingsScreen` (+ `.save`, `.custom`) (correct
  defaults, tax-rate-over-100 rejection, full save across every field
  including the payment-terms/template/invoice-type chip-pickers, and the
  "Custom" entry-point selection saving correctly). `DigitalCardScreen`
  gained one test for the new "Business" navigation button.
- **Test-file splitting note:** `EditBusinessScreen` and
  `InvoiceSettingsScreen` each have their save-flow test(s) in a separate
  file from their validation/default tests (`*.save.test.tsx`, plus
  `InvoiceSettingsScreen.custom.test.tsx`) — mirroring the reasoning
  already documented in Phase 1's `EditBusinessCardScreen.save.test.tsx`:
  running a full save flow in the same file/describe block as other
  render-heavy tests produced React Testing Library "overlapping act()"
  warnings and flaky `getByTestId` failures. Splitting one save flow per
  file resolved it; this is the same instability class Phase 1 had already
  worked around, just re-encountered and re-applied here.
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as Phase 1 (no device/emulator in this environment). Manual
  verification steps below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → Digital Card screen → tap "Business" → Business screen
   loads (or shows the empty state) — no network call is made anywhere in
   this flow.
3. Tap "Edit business" → fill in business name, phone, email, website,
   address, currency, tax ID, invoice prefix, and next invoice number →
   Save. Writes to local SQLite only.
4. Go back to Business → confirm the summary reflects what was just saved,
   including the formatted next invoice number (e.g. "INV-1").
5. Tap "Business settings" → "Invoice settings" → set a default tax rate,
   pick a payment term, template, and invoice type (try "Custom" too) →
   Save.
6. Close the app fully.
7. Reopen the app (still offline) — Business and Invoice Settings both read
   back everything saved in steps 3 and 5 from SQLite.
8. Confirm the Digital Business Card screens (from Phase 1) still work
   exactly as before — nothing there changed except the added "Business"
   button.

This wasn't run against a physical device/emulator in this environment
(none is available here); the schema, repository, and offline-safe design
were verified as far as this environment allows (unit tests + strict
typecheck + full Metro bundle export), same as Phase 1.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as Phase 1. The
  steps above should be run on a real device/Expo Go before calling
  Phase 2 fully QA'd.
- **No bottom tab bar yet** — Dashboard/Invoices/Customers tabs don't exist
  (Phases 4–8 build them), so Business/Digital-Card navigation stays a
  single stack with cross-links between the two feature areas rather than
  the final tab structure described in `MVP_BUILD_PLAN.md` §7. Revisit once
  enough tabs' content exists to justify the bottom tab bar itself.
- **"Custom" invoice type is an entry point only** — selecting and saving
  it works today; the field-matrix / custom-field-builder screen behind it
  is explicitly Phase 3 (Invoice Type / Domain) scope, per the brief.
- **Invoice templates are a stored selection only** — Classic/Modern/Minimal
  can be chosen and saved; actual PDF template rendering is Phase 9 (PDF
  and Sharing) scope.
- **Default tax rate / payment terms are not yet applied anywhere** — they
  exist in the schema and are settable, but nothing consumes them yet since
  Invoices (Phase 6) don't exist. Same "exists in schema, used later" note
  Phase 1 made about currency/tax ID on the Digital Business Card.
- **No `@react-native-picker/picker` dependency was added** — the four
  enum-style fields (payment terms, template, invoice type) use a small
  hand-built chip picker (`OptionPicker`) instead, per the "no unnecessary
  packages" rule; revisit only if a real native picker/dropdown UX is
  explicitly requested.

### 7. Files modified

New files: `src/domain/business/{types,validation,formMapping}.ts`,
`src/data/business/{BusinessRepository,InMemoryBusinessRepository,
SqliteBusinessRepository}.ts` + `__tests__/InMemoryBusinessRepository.test.ts`,
`src/state/{businessProfileStore,invoiceSettingsStore}.ts` +
`__tests__/*.test.ts`, `src/components/business/{OptionPicker,
SettingsRow}.tsx`, `src/screens/business/{BusinessScreen,
EditBusinessScreen,BusinessSettingsScreen,InvoiceSettingsScreen}.tsx` +
`__tests__/*.test.tsx`, `drizzle/0001_blushing_northstar.sql` (+ updated
`drizzle/meta/`).

Modified files: `src/data/db/schema.ts` (six new `business` columns +
`BUSINESS_COLUMN_UPGRADES`), `src/data/db/client.ts`
(`ensureBusinessColumns()`), `src/data/container.ts`
(`getBusinessRepository()`), `src/navigation/types.ts` (four new routes),
`src/navigation/RootNavigator.tsx` (four new screens registered),
`src/screens/businessCard/DigitalCardScreen.tsx` (one additive "Business"
button; existing behavior/tests untouched),
`src/screens/businessCard/__tests__/DigitalCardScreen.test.tsx` (one new
test for that button), `MVP_BUILD_PLAN.md` (status header only).

### 8. Issues

None outstanding. One instability was hit and resolved during this phase:
save-flow screen tests (`EditBusinessScreen`, `InvoiceSettingsScreen`)
initially shared a file with other tests and intermittently failed with
React Testing Library "overlapping act()" warnings; splitting each save
flow into its own test file (matching the pattern Phase 1's
`EditBusinessCardScreen.save.test.tsx` already used) made the full suite
deterministic — see "Tests" above.

**Next phase:** Phase 3 — Invoice Type / Domain. Complete — see below.

---

## Phase 3 — Invoice Type / Domain

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phase 1 or Phase 2 was deleted or
behaviorally changed except two additive navigation entry points (see
below).

### What was built

- Invoice Type / Domain functionality end-to-end on the frontend, backed by
  the real local SQLite database — same frontend-first sequencing as
  Phases 1–2: every pure domain function and `InMemoryBusinessRepository`'s
  new methods were built and unit-tested first, then
  `SqliteBusinessRepository` was extended behind the same `BusinessRepository`
  interface and wired in at the existing composition root
  (`src/data/container.ts` — no change needed there, since this reuses the
  repository Phase 2 already registered).
- **A configurable field-definition architecture, not per-type hard-coded
  fields.** Every item-line field (Item Name, Description, SKU, Quantity,
  Unit, Weight, Length, Width, Height, Unit Price, Discount, Tax) is one
  entry in a single catalog (`FIELD_DEFINITIONS`); every invoice type (the
  four fixed ones and Custom) is a list of keys into that catalog
  (`INVOICE_TYPE_REGISTRY`). No screen, component, or store switches on an
  invoice-type id to decide which fields to show — everything walks the
  registry/catalog or a resolved `InvoiceFieldConfig`. Adding a sixth
  invoice type later (fixed or configurable) is one new registry entry;
  adding a new field later is one new catalog entry — neither requires
  touching a screen.
- **The Phase 2 `business` entity/table was extended, not duplicated
  again** — same pattern as Phase 2 extending Phase 1's table. The invoice
  type selection reuses the existing `invoice_type` column (Phase 2) and
  adds one new column, `custom_invoice_fields`, for the Custom type's
  chosen field list. See "Database changes" below.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens → `invoiceTypeStore`
  (Zustand) → `BusinessRepository` interface (extended, not replaced) →
  SQLite (Drizzle) / in-memory implementations. Screens never import the
  database, a concrete repository, or a hard-coded field list directly.
- Reused rather than duplicated: `ActionButton`, `SettingsRow`, the `colors`
  theme, and the existing `BusinessRepository`/`invoiceSettingsStore`
  plumbing from Phase 2 — no second repository or second "which invoice
  type is selected" source of truth was introduced.

### 1. Domain layer (the "proper domain model" the brief asks for)

All pure TypeScript, no React/DB/network — `src/domain/invoiceType/`:

- **`fieldCatalog.ts`** — `FieldKey` (the 12 fields from the brief),
  `FieldDefinition` (key, label, input kind, `alwaysIncluded`),
  `FIELD_DEFINITIONS` (the one catalog), `ALL_FIELD_KEYS` (canonical display
  order), `ALWAYS_INCLUDED_FIELD_KEYS` (Item Name + Unit Price — an invoice
  line without a name or a price isn't meaningful, so these are locked "on"
  in the Custom builder rather than freely removable; this is a reasonable
  interpretation, not stated verbatim in the brief, and is called out again
  under "Known limitations").
- **`invoiceTypeRegistry.ts`** — `InvoiceTypeId` (`general` | `quantity` |
  `weight` | `dimension` | `custom`), `InvoiceTypeDefinition` (id, label,
  description, `fields: FieldKey[] | null` — `null` means "configurable"),
  `INVOICE_TYPE_REGISTRY` (the five initial types, field lists matching the
  brief's matrix exactly; `general` and `quantity` are separate registry
  entries that happen to share a field list today, so either can change
  independently later without touching the type union).
- **`types.ts`** — `InvoiceTypeSelection` / `InvoiceTypeSelectionInput` (the
  persisted domain model: which type + which custom fields),
  `InvoiceFieldConfig` (the *resolved* field list, `resolveInvoiceFieldConfig()`
  turns a selection into it — this is what a future invoice-building screen
  or PDF renderer is meant to consume instead of re-deriving field lists
  itself), `normalizeCustomFieldKeys()` (de-dupes, drops unknown keys,
  guarantees the always-included fields are present, restores canonical
  order — the one place a malformed/legacy custom selection gets cleaned
  up).
- **`validation.ts`** — `customFieldSelectionFormSchema`: a Zod schema built
  from `ALL_FIELD_KEYS` (not a hand-written field list), so the Custom
  builder's checkbox form picks up a new catalog entry automatically.
- **`formMapping.ts`** — `selectionToCustomFormDefaults()` (selection ↔ the
  builder's checkbox-record form shape, defaulting to Item/Quantity/Unit
  Price/Tax for a never-configured business),
  `describeSelectionFields()`/`describeFixedTypeFields()` (human-readable
  "Item Name, Quantity, Unit Price, Tax"-style previews used by both new
  screens).
- 5 test files, 33 tests, covering the catalog, the registry, resolution/
  normalization, the Zod schema, and the form-mapping helpers.

### 2. Screens built (per the brief)

1. **Invoice Type Selection** — `src/screens/invoiceType/InvoiceTypeSelectionScreen.tsx`.
   Renders `INVOICE_TYPE_REGISTRY` as selectable cards (label, description,
   a live field-list preview built from the catalog) with the current
   selection highlighted; loading/error states. Tapping a fixed type
   (General/Quantity/Weight/Dimension) saves it immediately and navigates
   back; tapping Custom navigates to the Custom Invoice Type screen instead
   of saving right away, so the field list is chosen before anything is
   persisted as "custom".
2. **Custom Invoice Type** — `src/screens/invoiceType/CustomInvoiceTypeScreen.tsx`.
   A checklist generated by mapping over `ALL_FIELD_KEYS` (Item Name,
   Description, SKU, Quantity, Unit, Weight, Length, Width, Height, Unit
   Price, Discount, Tax) via React Hook Form + the Zod schema above; Item
   Name and Unit Price render checked and disabled (always included); a
   live "Preview" card shows the human-readable field list as it's edited;
   Save persists `{invoiceTypeId: 'custom', customFieldKeys}` and navigates
   back.

Supporting components: `src/components/invoiceType/FieldToggleRow.tsx` (a
dependency-free checkbox row, same "no unnecessary picker/checkbox package"
reasoning as Phase 2's `OptionPicker`) and
`src/components/invoiceType/InvoiceTypeCard.tsx` (the selectable card on the
selection screen).

**Navigation:** `RootStackParamList` gained `InvoiceTypeSelection` and
`CustomInvoiceType`; `RootNavigator` registers both. Two additive entry
points were added, no existing screen behavior/tests changed:
`BusinessSettingsScreen` gained an "Invoice type" `SettingsRow`, and
`InvoiceSettingsScreen` gained a "Configure invoice fields" button (with its
existing hint text updated from "set up in a later update" to point at the
now-built screen — the five-way `invoiceType` chip-picker Phase 2 already
had on that screen is untouched and still works standalone, since it writes
the same `invoice_type` column either screen would).

### 3. Database changes

No new table — the existing `business` table (`src/data/db/schema.ts`,
Phase 1/2) gained one column:

- `custom_invoice_fields TEXT` — nullable; a JSON-encoded array of field
  keys (e.g. `'["itemName","quantity","unitPrice","tax"]'`), only meaningful
  when `invoice_type = 'custom'`; `null` for the four fixed types, whose
  field lists live in `INVOICE_TYPE_REGISTRY` instead of the database.

**Fresh installs** get it from the updated `CREATE_TABLES_SQL`. **Existing
installs** get it backfilled by the same `ensureBusinessColumns()` step
Phase 2 introduced in `db/client.ts` — one more entry in
`BUSINESS_COLUMN_UPGRADES`, same additive/idempotent `ALTER TABLE ... ADD
COLUMN` mechanism, no changes needed to that function itself. Canonical SQL
regenerated via `node node_modules/drizzle-kit/bin.cjs generate` →
`drizzle/0002_dizzy_gravity.sql` (`ALTER TABLE business ADD custom_invoice_fields
text;`), matches the hand-written upgrade exactly.

**`BusinessRepository` was extended, not replaced or duplicated:**
`getInvoiceTypeSelection()` / `saveInvoiceTypeSelection()` were added
alongside the existing `getProfile`/`saveProfile`/`getInvoiceSettings`/
`saveInvoiceSettings`, following the exact pattern Phase 2 already
established for sharing one row across feature slices — each write touches
only the columns it owns (`invoiceType` + `customInvoiceFields`), so saving
an invoice-type selection never clobbers the business profile or the rest
of invoice settings, and vice versa (verified by the "does not clobber"
tests in `InMemoryBusinessRepository.invoiceType.test.ts`, mirroring
Phase 2's equivalent tests). `invoiceType` is intentionally the same column
both `saveInvoiceSettings()` (Phase 2's chip-picker) and
`saveInvoiceTypeSelection()` (this phase's dedicated screen) write — one
source of truth, whichever screen saved last wins, exactly like
`invoicePrefix`/`nextInvoiceNumber`/`currency` already being editable from
two screens in Phase 2.

- `SqliteBusinessRepository`'s new methods parse/serialize
  `custom_invoice_fields` as JSON, tolerating `null`/malformed/legacy values
  by falling back to an empty list rather than throwing (no Jest coverage,
  same as the rest of `SqliteBusinessRepository` — Jest can't drive the
  native SQLite module without a device).

### 4. API contracts

None defined or implemented — nothing in this phase needs network I/O; the
invoice-type selection is local-only config on the same on-device `business`
row everything else in Phases 1–2 uses. If a future remote-backup phase
needs to sync it, it would ride along with whatever `RemoteBusinessRepository`
implements the existing `BusinessRepository` interface — no new contract
shape, since the selection is just two more fields on that same interface.

### 5. Tests

142 Jest tests across 33 suites, all passing (`npx jest` / `npm test`,
up from Phase 2's 96 across 24); TypeScript strict-mode `tsc --noEmit` is
clean; a full Metro static export (`expo export --platform android`) bundles
the whole app (1433 modules, up from Phase 2's 1423) with no resolution
errors.

- **Domain** (`src/domain/invoiceType/__tests__/`): catalog completeness
  and always-included fields (`fieldCatalog.test.ts`), the registry's field
  matrix matching the brief exactly and "custom" staying configurable
  (`invoiceTypeRegistry.test.ts`), normalization/resolution behavior
  including the always-included-fields guarantee (`types.test.ts`), the
  Zod checkbox-form schema restoring locked fields and canonical ordering
  (`validation.test.ts`), and the selection↔form-defaults/description
  helpers (`formMapping.test.ts`).
- **Repository** (`InMemoryBusinessRepository.invoiceType.test.ts`): null
  before anything is saved, saving a fixed type stores an empty custom
  field list, saving "custom" normalizes the chosen fields, switching away
  from "custom" clears the stored custom field list, and — the key
  shared-row behavior — saving an invoice-type selection doesn't clobber
  the profile or invoice settings and vice versa.
- **Store** (`invoiceTypeStore.test.ts`): load/save happy paths for both a
  fixed type and a normalized custom selection, error states from a failing
  repository (load and save) — same shape as `invoiceSettingsStore.test.ts`.
- **Screens**: `InvoiceTypeSelectionScreen` (all five types listed with
  "General" defaulting selected, a fixed type's field preview renders,
  selecting a fixed type saves and navigates back, selecting "Custom"
  navigates without saving yet) and `CustomInvoiceTypeScreen` (correct
  defaults with locked fields disabled, toggling updates the live preview,
  the locked fields can't be unchecked, saving persists the normalized
  selection and navigates back).
- **Existing-suite regression check:** `failingRepository()` test helpers in
  `businessProfileStore.test.ts` and `invoiceSettingsStore.test.ts` were
  updated to implement the two new `BusinessRepository` methods (required
  for `tsc --noEmit` to stay clean now that the interface has grown) — no
  assertions in either file changed. Every other Phase 1/2 test file and
  assertion is untouched; the full suite was re-run after these changes and
  is green.
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as Phases 1–2 (no device/emulator in this environment). Manual
  verification steps below.
- **Cross-suite Jest flakiness note:** running the *entire* suite together
  intermittently timed out one or two unrelated, pre-existing render-heavy
  screen tests (confirmed by re-running those files alone, where they pass
  immediately) — the same instability class Phase 1/2 already documented
  and worked around by splitting save-flow tests into their own files. Not
  something this phase's code introduced; every file the fix above touched
  (`fieldCatalog`, `invoiceTypeRegistry`, `types`, `validation`,
  `formMapping`, the repository, the store, both new screens) also passes
  standalone. Re-running the full suite after fixing the two real test bugs
  found during this phase (an over-narrow `normalizeCustomFieldKeys`
  expectation, and a `toHaveTextContent` exact-match instead of a substring
  regex) came back fully green: 33/33 suites, 142/142 tests.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → Business → Business settings → "Invoice type" (or
   Invoice settings → "Configure invoice fields") → Invoice Type Selection
   screen loads showing "General" selected — no network call anywhere in
   this flow.
3. Tap "Weight" → saves immediately and returns to Invoice Settings/Business
   Settings.
4. Reopen Invoice Type Selection → "Weight" is shown as selected, with its
   field preview (Item Name, Quantity, Weight, Unit Price, Discount, Tax).
5. Tap "Custom" → Custom Invoice Type screen opens with Item Name, Quantity,
   Unit Price, Tax checked (Item Name/Unit Price disabled) → uncheck Tax,
   check SKU and Description → Save.
6. Close the app fully.
7. Reopen the app (still offline) → Invoice Type Selection shows "Custom"
   selected with the preview "Item Name, Description, SKU, Quantity, Unit
   Price" (order per the catalog) → reopening Custom Invoice Type shows the
   same checkboxes restored from SQLite.
8. Confirm Phase 1 (Digital Business Card) and Phase 2 (Business Profile,
   Invoice Settings' existing chip-picker) screens still work exactly as
   before.

This wasn't run against a physical device/emulator in this environment
(none is available here); verified as far as this environment allows (unit
tests + strict typecheck + full Metro bundle export), same as Phases 1–2.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as Phases 1–2.
- **Item Name and Unit Price being non-removable in the Custom builder is
  an interpretation, not a literal brief requirement.** The brief lists
  "Item Name" as just one of twelve selectable fields for Custom. Locking
  it (and Unit Price) "on" was chosen because an invoice line with neither
  isn't a usable line item; revisit if a real use case needs to drop one of
  them (e.g. a quote/estimate line with no price yet).
- **No invoice-building screen consumes `resolveInvoiceFieldConfig()` yet**
  — Phase 3 only builds and persists the *selection*; Phase 6 (Invoices) is
  what will call it to render dynamic item-entry fields on an actual
  invoice. The resolver, catalog, and registry are built now so that later
  phase does not hard-code fields itself, per the brief's explicit
  instruction.
- **`general` and `quantity` remain two separate, identically-fielded
  registry entries** — matches the brief's field matrix (both rows are
  identical) rather than being collapsed into one type, so each can diverge
  independently later without a breaking type-union change.
- **The Phase 2 invoice-type chip-picker on `InvoiceSettingsScreen` was
  kept, not removed** — it still directly sets the same `invoice_type`
  column this phase's dedicated screens use, so both remain valid,
  non-conflicting entry points into the same stored value. Consolidating
  down to a single entry point (likely the new dedicated screen) is a
  reasonable future cleanup but wasn't done here to avoid rewriting
  Phase 2's already-tested screen/form beyond the two additive changes
  described above.
- **No native `Switch`/checkbox component was added** — `FieldToggleRow` is
  a small `Pressable`-based checkbox, per the same "no unnecessary
  packages" rule Phase 2's `OptionPicker` followed.

### 7. Files modified

New files: `src/domain/invoiceType/{fieldCatalog,invoiceTypeRegistry,types,
validation,formMapping}.ts` + `__tests__/*.test.ts` (5 files, 33 tests),
`src/state/invoiceTypeStore.ts` + `__tests__/invoiceTypeStore.test.ts`,
`src/components/invoiceType/{FieldToggleRow,InvoiceTypeCard}.tsx`,
`src/screens/invoiceType/{InvoiceTypeSelectionScreen,CustomInvoiceTypeScreen}.tsx`
+ `__tests__/*.test.tsx`,
`src/data/business/__tests__/InMemoryBusinessRepository.invoiceType.test.ts`,
`drizzle/0002_dizzy_gravity.sql` (+ updated `drizzle/meta/`).

Modified files: `src/data/db/schema.ts` (one new `business` column +
`BUSINESS_COLUMN_UPGRADES` entry), `src/data/business/BusinessRepository.ts`
(two new interface methods), `src/data/business/InMemoryBusinessRepository.ts`
/ `SqliteBusinessRepository.ts` (implementations),
`src/navigation/types.ts` (two new routes), `src/navigation/RootNavigator.tsx`
(two new screens registered), `src/screens/business/BusinessSettingsScreen.tsx`
(one additive `SettingsRow`), `src/screens/business/InvoiceSettingsScreen.tsx`
(one additive button + updated hint text; existing fields/tests untouched),
`src/state/__tests__/businessProfileStore.test.ts` and
`src/state/__tests__/invoiceSettingsStore.test.ts` (`failingRepository()`
helpers extended for the two new interface methods only), `MVP_BUILD_PLAN.md`
(status header only).

### 8. Issues

None outstanding. Two test-authoring mistakes were caught and fixed while
verifying this phase (not shipped): an over-narrow expectation in a
`normalizeCustomFieldKeys` test that didn't account for `unitPrice` also
being always-included, and a `toHaveTextContent('SKU')` exact-match
assertion that needed to be a `/SKU/` substring regex instead. Both were
fixed before considering the phase done; the full suite is green.

**Next phase:** Phase 4 — Items. Complete — see below.

---

## Phase 4 — Item Management

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phases 1–3 was deleted or behaviorally
changed except one additive navigation entry point (see below).

### What was built

- Item Management functionality end-to-end on the frontend, backed by the
  real local SQLite database — same frontend-first sequencing as Phases 1–3:
  `InMemoryItemRepository` and every pure domain function were built and
  unit-tested first, then `SqliteItemRepository` was added behind the same
  `ItemRepository` interface and wired in at the composition root
  (`src/data/container.ts`).
- **A brand-new entity, not an extension of `business`.** Unlike Phases 1–3
  (which all shared the single `business` row), `Item` is the first
  proper multi-row catalog table — its own table, its own repository, its
  own Zustand store holding a *list* plus search/filter state, not a single
  record.
- **Items never carry invoice history, per the brief's explicit rule.** The
  `item` table and `Item` domain type have no `invoiceId`, no "last
  invoiced" field, and no snapshot data — see "Database changes" and
  `domain/item/types.ts`'s doc comment. When Phase 6 (Invoices) is built,
  `InvoiceItem` will copy a *snapshot* of an item's fields onto the invoice
  line at that moment; this phase deliberately does not pre-build that
  table, only guarantees `Item` stays clean for it.
- **"Invoice type / domain" on an item reuses the Phase 3 registry instead
  of duplicating the field matrix.** `domain/item/relevantFields.ts`'s
  `relevantOptionalFieldsForInvoiceType()` walks `INVOICE_TYPE_REGISTRY`
  (Phase 3) to decide which of Weight/Length/Width/Height to show on the
  Create/Edit Item form for a given item's selected type — e.g. a
  "General" item shows none of them, a "Dimension" item shows only
  Length/Width/Height. For "Custom", it further narrows to the business's
  own Phase 3 field selection (fetched via the existing `invoiceTypeStore`),
  so an item's form never shows a physical field the business didn't opt
  into.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens → `itemStore`
  (Zustand) → `ItemRepository` interface → SQLite (Drizzle) / in-memory
  implementations. Screens never import the database, a concrete
  repository, or the field registry's raw data directly.
- Reused rather than duplicated: `ActionButton`, `FormField`, `OptionPicker`
  (Phase 2) for the invoice-type chip picker, the `colors` theme, and the
  existing `invoiceTypeStore` (Phase 3) for the custom-field lookup above.

### 1. Screens built (per the brief)

1. **Items List** — `src/screens/item/ItemListScreen.tsx`. A search box
   (matches name/SKU/description), an invoice-type filter (chip picker: All
   + the five Phase 3 types), a scrollable list of items (name, SKU/unit
   summary or invoice-type label, price, a per-row Delete action with a
   confirmation `Alert`), a "+ New item" action, and loading/error/empty
   states (the empty state distinguishes "no items yet" from "no items match
   your search/filter").
2. **Create Item** — `src/screens/item/CreateItemScreen.tsx`. React Hook
   Form + Zod validation using the shared `ItemFormFields` field set (see
   below); saves through `itemStore.create()`.
3. **Edit Item** — `src/screens/item/EditItemScreen.tsx`. Loads the item by
   id (via `itemStore.getById()`), shows loading/not-found/error states,
   pre-fills the same shared form, and saves through `itemStore.update()`.

Shared field set: `src/components/item/ItemFormFields.tsx` — one
implementation of the field list (Item name, Description, SKU/item code,
Unit, Default price, Tax, Invoice type/domain, then conditionally
Weight/Length/Width/Height) used by both Create and Edit, so the two screens
can never drift apart. `src/components/item/ItemListRow.tsx` is the list row
component (name, SKU/unit or type label, price, Delete button).

**Add item while creating an invoice later (per the brief):** rather than
building a second, near-duplicate item picker for the not-yet-built Invoices
functionality, `ItemListScreen` already supports a "picker" mode: when
opened with `route.params.onSelectItem` (see `navigation/types.ts`), tapping
a row calls it with the chosen item and navigates back instead of opening
Edit Item, and its "+ New item" button forwards that same callback into
`CreateItem`'s `onCreated` param — so creating a brand-new item while picking
one hands the new item straight back to the caller instead of just closing.
Phase 6 (Invoices) can reuse `ItemListScreen`/`CreateItemScreen` unchanged
for its item-selection step; nothing here was speculatively over-built
beyond adding these two optional callback params.

**Navigation:** `RootStackParamList` gained `ItemList`, `CreateItem`
(`{ onCreated?: (item: Item) => void } | undefined`), `EditItem`
(`{ itemId: string }`); `RootNavigator` registers all three. One additive
entry point was added, no existing screen behavior/tests changed:
`BusinessScreen` gained an "Items" `ActionButton` next to "Business card".

### 2. Backend files

No backend service was built — none is required (everything is local
SQLite, exactly like Phases 1–3). Documented future contract, per the "APIs
only where required" instruction:

- **Item list/search** — would be `GET /items?search=&invoiceType=` →
  `Item[]` (`src/domain/item/types.ts`: id, name, description, sku, unit,
  defaultPrice, taxRate, weight, length, width, height, invoiceTypeId,
  createdAt, updatedAt). Would back a future `RemoteItemRepository`
  implementing today's `ItemRepository` interface unchanged.
- **Item create/update/delete** — `POST /items`, `PUT /items/:id`,
  `DELETE /items/:id`, all using the same `ItemInput` shape the repository
  interface already defines. Same interface, no new screen-facing contract.
- Not built now because nothing in Phase 4 needs network I/O.

### 3. Database changes

New table, `item` (`src/data/db/schema.ts`) — the first table in this
codebase that isn't the shared `business` row:

- `id` (text, PK), `name` (text, not null), `description` (text, nullable),
  `sku` (text, nullable — free text, not enforced unique, see Known
  limitations), `unit` (text, nullable), `default_price` (real, not null,
  default 0), `tax_rate` (real, nullable — percentage 0–100), `weight`,
  `length`, `width`, `height` (all real, nullable), `invoice_type` (text
  enum, not null, default `'general'` — reuses the same five Phase 3 values),
  `created_at`, `updated_at` (integer, not null).
- **Indexes for common searches (per the brief):** `item_name_idx` on
  `name` (the list's search box), `item_sku_idx` on `sku` (code/SKU lookup),
  `item_invoice_type_idx` on `invoice_type` (the list's type filter).
- Added to `CREATE_TABLES_SQL` alongside the existing `business`/
  `social_link` statements — since `item` is a brand-new table (not an
  extension of an existing one), it needs no `ensureBusinessColumns()`-style
  backfill migration: `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT
  EXISTS` already handles both fresh and pre-existing installs identically,
  every time the app starts (`db/client.ts` was not modified — it already
  executes the whole `CREATE_TABLES_SQL` block unconditionally).
- Canonical SQL regenerated via
  `node node_modules/drizzle-kit/bin.cjs generate` →
  `drizzle/0003_regular_cannonball.sql`, matches the hand-written
  `CREATE_TABLES_SQL` addition exactly (verified by hand).
- **Never grows an invoice-linkage column** — no `invoiceId`, no "last
  invoiced" timestamp. `InvoiceItem` (Phase 6) will snapshot an item's
  fields onto the invoice line at invoice-creation time; this table and its
  repository intentionally have no way to look up "invoices this item is
  on" so that renaming/re-pricing an item can never retroactively change an
  existing invoice. See `MVP_BUILD_PLAN.md` §6.2 and the doc comment on
  `Item` in `domain/item/types.ts`.

New repository, following the same three-file pattern as `BusinessRepository`:

- `ItemRepository` interface (`src/data/item/ItemRepository.ts`):
  `list(filter?)`, `getById(id)`, `create(input)`, `update(id, input)`,
  `delete(id)`.
- `InMemoryItemRepository` — mock/testing implementation; search/filter
  logic delegates to the pure `domain/item/filtering.ts` functions
  (`itemMatchesFilter`, `sortItems`) rather than re-implementing matching
  inline.
- `SqliteItemRepository` — real implementation against the `item` table via
  Drizzle queries (`like`/`eq`/`and`/`or` for search+filter,
  `.orderBy(item.name)` for the sort). No Jest coverage — Jest can't drive
  the native SQLite module without a device, same as every other Sqlite*
  repository in this codebase; its search/filter semantics are unit-tested
  once, in plain TypeScript, via the same `itemMatchesFilter` function
  `InMemoryItemRepository` runs directly, so both implementations are
  provably matching one definition of "what counts as a match."

### 4. API contracts

See "Backend files" above — defined, not implemented, for the same reason
every prior phase's undecided contract wasn't: nothing in this phase needs
network I/O.

### 5. Tests

197 Jest tests across 46 suites, all passing (`npx jest` / `npm test`, up
from Phase 3's 142 across 33 — run three times in a row to confirm
stability, all green); TypeScript strict-mode `tsc --noEmit` is clean; a
full Metro static export (`expo export --platform android`) bundles the
whole app (1444 modules, up from Phase 3's 1433) with no resolution errors.

- **Domain** (`src/domain/item/__tests__/`): `filtering.test.ts` (search
  text against name/SKU/description, case-insensitivity, null-safe
  SKU/description, invoice-type filtering, both combined, alphabetical sort
  without mutating the input), `relevantFields.test.ts` (no physical fields
  for General/Quantity, weight-only for Weight, length/width/height for
  Dimension, all four for Custom with no business selection yet, narrowed
  to the business's chosen keys when known), `validation.test.ts` (minimal
  valid item, empty name rejected, non-numeric price rejected, tax rate
  over 100 rejected, optional decimal fields accepted and coerced, blank
  optional text fields trimmed to null, unknown invoice-type id rejected,
  the empty-item form defaults).
- **Repository** (`InMemoryItemRepository.test.ts`): empty list initially,
  create returns an id/timestamps, list sorted by name, `getById` hit/miss,
  update keeps id/createdAt, update on a missing id throws, delete removes
  it, deleting an unknown id is a no-op, search+filter together, and a seed
  array isn't shared with the caller.
- **Store** (`itemStore.test.ts`): load empty-then-ready, create/update/
  remove all refresh the list, `getById` doesn't touch the loaded list,
  `setFilter` merges and reloads, and an error state from a failing
  repository — calling the store directly via `store.getState()` rather
  than `renderHook`, matching this codebase's existing store-test
  convention (`invoiceSettingsStore.test.ts` et al.).
- **Screens**: `ItemListScreen` (empty state, lists saved items, navigates
  to Create Item, navigates to Edit Item in normal mode, picker mode calls
  `onSelectItem`+goes back instead of opening Edit Item, picker mode
  forwards the callback as Create Item's `onCreated`, search-text
  filtering, delete-with-confirmation), `CreateItemScreen` (invoice-type-
  driven field visibility for Weight/Dimension, empty-name rejection,
  non-numeric-price rejection, successful create + navigate-back, the
  `onCreated` callback path), `EditItemScreen` (not-found state, pre-fills
  the form from the existing item, saves the edit and keeps the same id).
  `BusinessScreen` gained one additive test for the new "Items" navigation
  button.
- **Test-file splitting note — a new instability class, root-caused (not
  just documented and worked around):** unlike the "overlapping act()"
  flakiness Phases 1–3 saw only under the *full* suite, `CreateItemScreen`'s
  interaction tests failed *deterministically*, even in isolation, whenever
  more than one `fireEvent.press('save-item')`-driven submission happened
  in the same test file (a second `render()` call afterwards, or a second
  `press` in the same test). Root-caused by isolating a minimal repro: an
  update dispatched by `react-hook-form`'s internal subject/observable after
  its async zod-resolver validation runs is **not** wrapped in React's
  `act()`, and if it resolves after the assertion that was waiting for it
  already passed, it lands while a *later* `render()`/interaction is
  in-flight, corrupting that later render (confirmed directly — its
  `view.toJSON()` comes back `null`). The fix is exactly the "one
  resolver-triggered submission per test file" pattern Phases 1–3's
  `EditBusinessScreen.save.test.tsx` already used, just needed applying more
  strictly here: `CreateItemScreen.test.tsx` (field-visibility only, no
  submit), `CreateItemScreen.validation.test.tsx` (empty-name submit),
  `CreateItemScreen.price.test.tsx` (bad-price submit),
  `CreateItemScreen.save.test.tsx` (successful create), and
  `CreateItemScreen.onCreated.test.tsx` (the callback path) — five files,
  each with exactly one submitting test. Verified by running the full suite
  three times in a row with zero failures.
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as Phases 1–3 (no device/emulator in this environment). Manual
  verification steps below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → Business → "Items" → Items List screen loads showing the
   empty state — no network call anywhere in this flow.
3. Tap "+ New item" → fill in name, description, SKU, unit, default price,
   tax, pick "Dimension" as the invoice type → Length/Width/Height fields
   appear → fill them in → Create item. Writes to local SQLite only.
4. Back on the Items List, the new item appears, sorted alphabetically.
5. Search by part of the name, then by the SKU → the list filters
   correctly; filter by invoice type "Dimension" → still shows.
6. Tap the item → Edit Item pre-fills every field, including
   Length/Width/Height → change the name and price → Save changes.
7. Delete the item → confirm in the dialog → it disappears from the list;
   an empty state distinguishing "no items yet" is shown again if it was
   the only one.
8. Close the app fully, reopen it (still offline) → repeat step 4/5 to
   confirm everything was actually persisted to SQLite, not just in memory.
9. Confirm Phases 1–3 screens (Digital Business Card, Business Profile,
   Invoice Settings, Invoice Type Selection) still work exactly as before.

This wasn't run against a physical device/emulator in this environment
(none is available here); the schema, repository, and offline-safe design
were verified as far as this environment allows (unit tests + strict
typecheck + full Metro bundle export), same as Phases 1–3.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as Phases 1–3.
- **SKU is not enforced unique.** The brief lists "SKU/item code" as a field
  but doesn't require uniqueness; a non-unique index was added for search
  performance only. Revisit if real-world usage needs duplicate-SKU
  prevention (a unique index, with a clear conflict-handling UX, would be
  the natural follow-up).
- **Item price/currency formatting is unstyled.** The list row shows
  `defaultPrice.toFixed(2)` with no currency symbol — the business's
  currency (Phase 2) isn't threaded into this screen yet. Proper
  currency-aware formatting is more naturally a Phase 9 (PDF and Sharing) /
  visual-polish (Phase 14) concern once real invoice totals exist to format
  consistently everywhere.
- **No native picker component was added** for the invoice-type field on
  the item form — reuses Phase 2's `OptionPicker` chip picker, per the same
  "no unnecessary packages" rule already established.
- **"Add item while creating an invoice" is a reusable hook, not a built
  invoice screen.** `ItemListScreen`'s picker mode and `CreateItemScreen`'s
  `onCreated` param exist now so Phase 6 doesn't have to touch these
  screens to add item selection to invoice creation, but no invoice screen
  calls them yet — Invoices don't exist until Phase 6.
- **No pagination/virtualization tuning beyond `FlatList`'s defaults** — fine
  for the item counts a small business (~1–20 employees) would realistically
  have; revisit only if a real catalog turns out to be very large.
- **Cross-suite Jest flakiness (the pre-existing, documented class from
  Phases 1–3) still shows a handful of "overlapping act()" /
  "environment not configured to support act()" console warnings** when
  every test file runs together — these are warnings only, not failures,
  the full suite is deterministically green (checked three consecutive
  full runs), and the specific deterministic *failure* variant introduced
  by this phase's screens was root-caused and fixed (see "Tests" above),
  not merely papered over.

### 7. Files modified

New files: `src/domain/item/{types,filtering,relevantFields,validation,
formMapping}.ts` + `__tests__/{filtering,relevantFields,validation}.test.ts`,
`src/data/item/{ItemRepository,InMemoryItemRepository,SqliteItemRepository}.ts`
+ `__tests__/InMemoryItemRepository.test.ts`, `src/state/itemStore.ts` +
`__tests__/itemStore.test.ts`, `src/components/item/{ItemFormFields,
ItemListRow}.tsx`, `src/screens/item/{ItemListScreen,CreateItemScreen,
EditItemScreen}.tsx` + `__tests__/*.test.tsx` (9 files — see the test-file
splitting note above), `drizzle/0003_regular_cannonball.sql` (+ updated
`drizzle/meta/`).

Modified files: `src/data/db/schema.ts` (new `item` table + three indexes),
`src/data/container.ts` (`getItemRepository()`), `src/navigation/types.ts`
(three new routes, two carrying optional callback params),
`src/navigation/RootNavigator.tsx` (three new screens registered),
`src/screens/business/BusinessScreen.tsx` (one additive "Items"
`ActionButton`; existing behavior/tests untouched),
`src/screens/business/__tests__/BusinessScreen.test.tsx` (one new
assertion for that button), `MVP_BUILD_PLAN.md` (status header only).

### 8. Issues

None outstanding. One real, deterministic test-environment bug was found
and fixed during this phase (not shipped as a known limitation): see the
"Test-file splitting note" under "Tests" above for the root cause
(an un-`act()`-wrapped `react-hook-form` resolver update leaking into a
later render/interaction in the same test file) and the fix (one
resolver-triggered submission per test file, verified stable across three
full-suite runs).

**Next phase:** Phase 5 — Customers. Complete — see below.

---

## Phase 5 — Customers

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phases 1–4 was deleted or behaviorally
changed except one additive navigation entry point (see below), and the
Digital Business Card continues to work exactly as before.

### What was built

- Customer functionality end-to-end on the frontend, backed by the real
  local SQLite database — same frontend-first sequencing as Phases 1–4:
  `InMemoryCustomerRepository` and every pure domain function were built and
  unit-tested first, then `SqliteCustomerRepository` was added behind the
  same `CustomerRepository` interface and wired in at the composition root
  (`src/data/container.ts`).
- **`Customer` is a brand-new, contact-only entity — a second multi-row
  table alongside `item` (Phase 4), never sharing the `business` row.** Its
  domain type has no balance/outstanding/overdue column, per the brief's
  explicit "do not create fake permanent balance fields" instruction — see
  the doc comment on `Customer` in `domain/customer/types.ts` and
  `MVP_BUILD_PLAN.md` §6.3.
- **The balance/history requirement is met with a real repository
  abstraction, not a stored number or a hard-coded zero sprinkled through
  the UI.** A new `CustomerActivityRepository` interface
  (`data/customerActivity/`) is the *only* door Customer Detail/History use
  to reach a customer's financial position:
  - `NullCustomerActivityRepository` is what's wired at the composition root
    **today** — an honest implementation that returns a zero summary and
    empty history for every customer, because neither `Invoice` (Phase 6)
    nor `Payment` (Phase 7) exist yet. It is not a stub to delete; it's the
    correct answer for "what is this customer's balance" in a codebase
    state with no invoices.
  - `InMemoryCustomerActivityRepository` is a seedable mock used to build
    and unit-test the summary/history UI against realistic data (not wired
    at the composition root).
  - Both implementations — and the future real one Phase 6/7 will write —
    share one calculation, `domain/customer/activity.ts`'s
    `summarizeActivity()` (+ `filterActivity()`/`sortActivityChronological()`),
    so "what counts as outstanding/overdue" is defined exactly once.
  - When Phase 6/7 add `InvoiceRepository`/`PaymentRepository`, a new
    `CustomerActivityRepository` implementation reading real data and
    reducing it with the same `summarizeActivity()` replaces
    `NullCustomerActivityRepository` at the composition root — no screen,
    store, or interface changes required. See the doc comments on
    `CustomerActivityRepository` and `NullCustomerActivityRepository` for
    the full reasoning.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens → `customerStore`
  / `customerActivityStore` (Zustand) → `CustomerRepository` /
  `CustomerActivityRepository` interfaces → SQLite (Drizzle) / in-memory /
  null implementations. Screens never import the database, a concrete
  repository, or a hard-coded balance value directly.
- Reused rather than duplicated: `ActionButton`, `FormField`, `OptionPicker`
  (history's type filter), the `colors` theme, `isValidPhone` (from
  `domain/businessCard/validation.ts`), and the `openPhone`/`openWhatsApp`/
  `openEmail` linking helpers (`lib/linking.ts`) for the Call/WhatsApp/Email
  actions.

### 1. Screens built (per the brief)

1. **Customer List** — `src/screens/customer/CustomerListScreen.tsx`. A
   search box (matches name/phone/email), a scrollable list of customers
   (name, phone/email summary, a per-row Delete action with a confirmation
   `Alert`), a "+ New customer" action, and loading/error/empty states (the
   empty state distinguishes "no customers yet" from "no customers match
   your search"). Mirrors `ItemListScreen`'s (Phase 4) structure, including
   its **picker mode**: when opened with `route.params.onSelectCustomer`,
   tapping a row calls it with the chosen customer and navigates back
   instead of opening Customer Detail, and "+ New customer" forwards that
   same callback into `CreateCustomer`'s `onCreated` param — the same
   "reusable for a future invoice-creation flow" hook Phase 4 built for
   items, so Phase 6 can reuse this screen for customer selection without
   a second, near-duplicate list.
2. **Create Customer** — `src/screens/customer/CreateCustomerScreen.tsx`.
   React Hook Form + Zod validation using the shared `CustomerFormFields`
   field set; saves through `customerStore.create()`.
3. **Edit Customer** — `src/screens/customer/EditCustomerScreen.tsx`. Loads
   the customer by id, shows loading/not-found/error states, pre-fills the
   same shared form, and saves through `customerStore.update()`.
4. **Customer Detail** — `src/screens/customer/CustomerDetailScreen.tsx`.
   Contact info (name, phone, email, address, notes — each row only
   rendered when set), the calculated `CustomerSummaryCard` (Total billed,
   Total paid, Outstanding, Overdue, Invoice count), and the brief's action
   set: **Call**/**WhatsApp** (phone-gated), **Email** (email-gated),
   **Create invoice** and **Record payment** (Phase 6/7 don't exist yet, so
   these show a "Coming soon" alert instead of navigating into a route that
   doesn't exist — the same non-breaking approach Phase 4 used for its own
   forward-looking hooks), plus **Edit customer** and **History** entry
   points.
5. **Customer History** — `src/screens/customer/CustomerHistoryScreen.tsx`.
   A chronological (newest-first) list of `CustomerActivityEntry` rows via
   `CustomerActivityRow`, filterable All / Invoices / Payments with the
   shared `OptionPicker` chip picker, and loading/error/empty states (the
   empty state names which filter came up empty).

Shared components: `src/components/customer/CustomerFormFields.tsx` (Name,
Phone, Email, Address, Notes — one implementation Create/Edit both use, so
they can never drift apart, mirroring `ItemFormFields`),
`CustomerListRow.tsx` (list row), `CustomerSummaryCard.tsx` (the five
Customer Detail numbers, rendered from a `CustomerBalanceSummary` value —
never from a stored field), `CustomerActivityRow.tsx` (one History row,
badge-styled by invoice/payment type).

**Navigation:** `RootStackParamList` gained `CustomerList`
(`{ onSelectCustomer?: (customer: Customer) => void } | undefined`),
`CreateCustomer` (`{ onCreated?: (customer: Customer) => void } | undefined`),
`EditCustomer` (`{ customerId: string }`), `CustomerDetail`
(`{ customerId: string }`), `CustomerHistory` (`{ customerId: string }`);
`RootNavigator` registers all five. One additive entry point was added, no
existing screen behavior/tests changed: `BusinessScreen` gained a
"Customers" `ActionButton` next to "Items".

### 2. Backend files

No backend service was built — none is required (everything is local
SQLite, exactly like Phases 1–4). Documented future contract, per the "APIs
only where required" instruction:

- **Customer list/search** — would be `GET /customers?search=` →
  `Customer[]` (`src/domain/customer/types.ts`: id, name, phone, email,
  address, notes, createdAt, updatedAt). Would back a future
  `RemoteCustomerRepository` implementing today's `CustomerRepository`
  interface unchanged.
- **Customer create/update/delete** — `POST /customers`,
  `PUT /customers/:id`, `DELETE /customers/:id`, all using the same
  `CustomerInput` shape the repository interface already defines.
- **Customer activity (balance/history)** — would be
  `GET /customers/:id/summary` → `CustomerBalanceSummary` and
  `GET /customers/:id/activity?type=` → `CustomerActivityEntry[]`, behind a
  future `RemoteCustomerActivityRepository` implementing today's
  `CustomerActivityRepository` interface — the natural remote counterpart
  to whatever real (Invoice/Payment-backed) implementation Phase 6/7 write
  locally first.
- Not built now because nothing in Phase 5 needs network I/O.

### 3. Database changes

New table, `customer` (`src/data/db/schema.ts`) — the second table in this
codebase that isn't the shared `business` row (after `item` in Phase 4):

- `id` (text, PK), `name` (text, not null), `phone` (text, nullable),
  `email` (text, nullable), `address` (text, nullable), `notes` (text,
  nullable), `created_at`, `updated_at` (integer, not null).
- **Indexes for name/phone search (per the brief):** `customer_name_idx` on
  `name` (the list's search box and general lookup), `customer_phone_idx`
  on `phone` (phone-number lookup, e.g. a future incoming-call match).
- Added to `CREATE_TABLES_SQL` alongside `business`/`social_link`/`item` —
  since `customer` is a brand-new table (not an extension of an existing
  one), it needs no `ensureBusinessColumns()`-style backfill migration:
  `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` already
  handles both fresh and pre-existing installs identically, every time the
  app starts (`db/client.ts` was not modified — same reasoning Phase 4
  documented for `item`).
- Canonical SQL regenerated via
  `node node_modules/drizzle-kit/bin.cjs generate` →
  `drizzle/0004_broad_randall.sql`, matches the hand-written
  `CREATE_TABLES_SQL` addition exactly (verified by hand — the generator's
  own summary confirms 4 tables, `customer` with 8 columns and 2 indexes).
- **No balance/outstanding column, deliberately** — per the brief's
  explicit instruction and `MVP_BUILD_PLAN.md` §6.3, see "What was built"
  above and the doc comment on the `customer` table in `db/schema.ts`.

New repository, following the same three-file pattern as `ItemRepository`:

- `CustomerRepository` interface (`src/data/customer/CustomerRepository.ts`):
  `list(filter?)`, `getById(id)`, `create(input)`, `update(id, input)`,
  `delete(id)`.
- `InMemoryCustomerRepository` — mock/testing implementation; search logic
  delegates to the pure `domain/customer/filtering.ts` functions
  (`customerMatchesFilter`, `sortCustomers`).
- `SqliteCustomerRepository` — real implementation against the `customer`
  table via Drizzle queries (`like`/`eq`/`or` for search, `.orderBy(customer.name)`
  for the sort). No Jest coverage — Jest can't drive the native SQLite
  module without a device, same as every other Sqlite* repository in this
  codebase.

New activity abstraction (the balance/history requirement), in
`src/data/customerActivity/`:

- `CustomerActivityRepository` interface: `getSummary(customerId)`,
  `getHistory(customerId, filter?)`.
- `NullCustomerActivityRepository` — wired at the composition root today;
  see "What was built" above.
- `InMemoryCustomerActivityRepository` — seedable mock for frontend-first
  UI work and tests; both this and `NullCustomerActivityRepository` are
  implementations of the exact same interface a real Phase 6/7 one will
  also implement.

### 4. API contracts

See "Backend files" above — defined, not implemented, for the same reason
every prior phase's undecided contract wasn't: nothing in this phase needs
network I/O.

### 5. Tests

269 Jest tests across 66 suites, all passing (`npx jest` / `npm test`, up
from Phase 4's 197 across 46 — run three times in a row to confirm
stability, all green); TypeScript strict-mode `tsc --noEmit` is clean; a
full Metro static export (`expo export --platform android`) bundles the
whole app (1460 modules, up from Phase 4's 1444) with no resolution errors.

- **Domain** (`src/domain/customer/__tests__/`): `validation.test.ts`
  (minimal valid customer, empty-name rejection, invalid phone/email
  rejection, fully populated customer), `formMapping.test.ts` (empty-state
  defaults, full round-trip, null-omission), `filtering.test.ts`
  (name/phone/email matching, case-insensitivity, null-safety, alphabetical
  sort without mutating the input), `activity.test.ts` (empty-entries
  summary, totalBilled/totalPaid/invoiceCount sums, outstanding floored at
  0, overdue-only summing, newest-first sort without mutation, all/invoice/
  payment filtering).
- **Repository** (`InMemoryCustomerRepository.test.ts`): empty list
  initially, create returns an id/timestamps, list sorted by name,
  `getById` hit/miss, update keeps id/createdAt, update on a missing id
  throws, delete removes it, deleting an unknown id is a no-op, search
  filtering, a seed array isn't shared with the caller — mirrors
  `InMemoryItemRepository.test.ts`'s coverage shape exactly.
- **Activity repositories**: `NullCustomerActivityRepository.test.ts` (zero
  summary and empty history for any customer id, confirming the "honest
  zero" behavior), `InMemoryCustomerActivityRepository.test.ts` (empty for
  an unseeded customer, correct summary computed only for the matching
  customer id, newest-first history filterable by type, seeded arrays not
  shared with the caller).
- **Stores** (`customerStore.test.ts`, `customerActivityStore.test.ts`):
  load/create/update/remove/getById/setFilter happy paths and error states
  from a failing repository (mirrors `itemStore.test.ts`); the activity
  store additionally covers loading summary+history together, resetting the
  filter to "all" on each new `load()`, and `setFilter` re-fetching only
  history for the currently loaded customer.
- **Screens**: `CustomerListScreen` (empty state, lists saved customers,
  navigates to Create/Detail, picker mode calls `onSelectCustomer` + goes
  back instead of opening Detail, picker mode forwards the callback as
  Create Customer's `onCreated`, search filtering, delete-with-confirmation
  — mirrors `ItemListScreen.test.tsx`), `CreateCustomerScreen` (empty-name
  rejection, successful create + navigate-back, the `onCreated` callback
  path), `EditCustomerScreen` (not-found state, pre-fills the form, saves
  the edit and keeps the same id), `CustomerDetailScreen` (not-found state,
  info + conditional Call/WhatsApp/Email actions + the calculated summary
  rendering, "Coming soon" alerts for Create Invoice/Record Payment,
  navigation to Edit Customer and Customer History), `CustomerHistoryScreen`
  (empty state, newest-first listing, All/Invoices/Payments filtering).
  `BusinessScreen` gained one additive test for the new "Customers"
  navigation button.
- **Test-file splitting, root-caused (not just worked around) —
  `CustomerDetailScreen`:** a second `render()` in the same test file
  intermittently produced "Unable to find an element" failures alongside
  "overlapping act()" console warnings, the same instability class Phase 4
  hit with `CreateItemScreen`. Root-caused this time to the screen's own
  effect, not a library internal: it awaited `getById()` then
  `loadActivity()` in sequence but flipped `status` to `'ready'` **before**
  awaiting the second call, so the activity load's state update could land
  after a `waitFor` had already resolved and the test had moved on —
  exactly the "in-flight update outside any test's `act()` window" pattern.
  Fixed at the source (`CustomerDetailScreen.tsx` now only sets `'ready'`
  after both awaits complete, so any `waitFor` on ready-state UI transitively
  waits for the activity load too) and *additionally* split across four
  files (`CustomerDetailScreen.test.tsx`, `.info.test.tsx`,
  `.comingSoon.test.tsx`, `.navigation.test.tsx`, one render each) to match
  this codebase's established convention. Verified stable across three
  full-suite runs after both changes.
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as Phases 1–4 (no device/emulator in this environment). Manual
  verification steps below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → Business → "Customers" → Customer List loads showing the
   empty state — no network call anywhere in this flow.
3. Tap "+ New customer" → fill in name, phone, email, address, notes →
   Create customer. Writes to local SQLite only.
4. Back on the Customer List, the new customer appears, sorted
   alphabetically.
5. Search by part of the name, then by phone, then by email → the list
   filters correctly each time.
6. Tap the customer → Customer Detail shows the contact info, a summary of
   all zeros (no invoices/payments exist yet — this is correct, not a bug),
   and Call/WhatsApp/Email buttons only for the fields actually set.
7. Tap "Create invoice" / "Record payment" → each shows a "Coming soon"
   alert instead of crashing or navigating anywhere.
8. Tap "History" → Customer History shows the empty state; switching the
   All/Invoices/Payments filter still shows the correctly-worded empty
   state for each.
9. Tap "Edit customer" → change a field → Save → back on Customer Detail,
   the change is reflected.
10. Close the app fully, reopen it (still offline) → repeat steps 4–6 to
    confirm everything was actually persisted to SQLite, not just in
    memory.
11. Confirm Phases 1–4 screens (Digital Business Card, Business Profile,
    Invoice Settings, Invoice Type Selection, Items) still work exactly as
    before.

This wasn't run against a physical device/emulator in this environment
(none is available here); the schema, repository, and offline-safe design
were verified as far as this environment allows (unit tests + strict
typecheck + full Metro bundle export), same as Phases 1–4.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as Phases 1–4.
- **Every Customer Detail/History balance is correctly zero/empty today.**
  This is not a placeholder bug — it's the honest answer given that
  `Invoice` (Phase 6) and `Payment` (Phase 7) don't exist yet. See "What was
  built" above for exactly how `NullCustomerActivityRepository` gets
  replaced once those phases land, without touching any screen or store.
- **"Create invoice" / "Record payment" are alerts, not real actions yet** —
  same "hook built now, screen doesn't exist yet" situation Phase 4
  documented for its own forward-looking additions; Phase 6/7 will replace
  the alert with real navigation.
- **Phone/email are not enforced unique** — the brief doesn't require it; a
  business can have two customers who happen to share a phone number (e.g.
  a shared office line). Revisit only if real-world usage needs duplicate
  prevention.
- **No native picker/checkbox component was added** for the History type
  filter — reuses the existing `OptionPicker` chip picker, per the same
  "no unnecessary packages" rule already established.
- **"Add customer while creating an invoice" is a reusable hook, not a
  built invoice screen** — `CustomerListScreen`'s picker mode and
  `CreateCustomerScreen`'s `onCreated` param exist now so Phase 6 doesn't
  have to touch these screens to add customer selection to invoice
  creation, but no invoice screen calls them yet.
- **No pagination/virtualization tuning beyond `FlatList`'s defaults** —
  same reasoning as Phase 4's `ItemListScreen`.

### 7. Files modified

New files: `src/domain/customer/{types,validation,formMapping,filtering,
activity}.ts` + `__tests__/{validation,formMapping,filtering,activity}.test.ts`,
`src/data/customer/{CustomerRepository,InMemoryCustomerRepository,
SqliteCustomerRepository}.ts` + `__tests__/InMemoryCustomerRepository.test.ts`,
`src/data/customerActivity/{CustomerActivityRepository,
NullCustomerActivityRepository,InMemoryCustomerActivityRepository}.ts` +
`__tests__/{NullCustomerActivityRepository,InMemoryCustomerActivityRepository}.test.ts`,
`src/state/{customerStore,customerActivityStore}.ts` +
`__tests__/{customerStore,customerActivityStore}.test.ts`,
`src/components/customer/{CustomerFormFields,CustomerListRow,
CustomerSummaryCard,CustomerActivityRow}.tsx`,
`src/screens/customer/{CustomerListScreen,CreateCustomerScreen,
EditCustomerScreen,CustomerDetailScreen,CustomerHistoryScreen}.tsx` +
`__tests__/*.test.tsx` (13 files — see the test-file splitting note above),
`drizzle/0004_broad_randall.sql` (+ updated `drizzle/meta/`).

Modified files: `src/data/db/schema.ts` (new `customer` table + two
indexes), `src/data/container.ts` (`getCustomerRepository()`,
`getCustomerActivityRepository()`), `src/navigation/types.ts` (five new
routes, two carrying optional callback params), `src/navigation/RootNavigator.tsx`
(five new screens registered), `src/screens/business/BusinessScreen.tsx`
(one additive "Customers" `ActionButton`; existing behavior/tests
untouched), `src/screens/business/__tests__/BusinessScreen.test.tsx` (one
new assertion for that button), `MVP_BUILD_PLAN.md` (status header only).

### 8. Issues

None outstanding. One real, deterministic test-environment bug was found
and fixed during this phase (not shipped as a known limitation): see the
"Test-file splitting" note under "Tests" above for the root cause (`status`
was set to `'ready'` before the second of two sequential awaited loads
completed, letting its state update land outside a test's `act()`/`waitFor`
window) and the fix (await both loads before flipping to `'ready'`, plus
one render per test file), verified stable across three full-suite runs.

**Next phase:** Phase 6 — Invoices. Complete — see below.

---

## Phase 6 — Invoices

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phases 1–5 was deleted or behaviorally
changed except three additive/upgraded touch points (see below).

### What was built

- Invoice functionality end-to-end on the frontend, backed by the real local
  SQLite database — same frontend-first sequencing as Phases 1–5:
  `InMemoryInvoiceRepository` and every pure domain function were built and
  unit-tested first, then `SqliteInvoiceRepository` was added behind the same
  `InvoiceRepository` interface and wired in at the composition root
  (`src/data/container.ts`).
- **Centralized calculation logic, per the brief's explicit instruction.**
  `domain/invoice/calculations.ts` is the *only* place invoice arithmetic
  exists: `calculateLineTotal` (one line's subtotal/discount/tax/total from
  quantity, unit price, discount %, tax %) and `sumInvoiceTotals` (adds up
  any list of already-computed line numbers into Subtotal/Discount/Tax/Grand
  total — never re-derives a line's numbers, so summing a saved invoice's
  frozen historical lines can never drift from what it showed when created).
  No screen or component performs money arithmetic itself — `InvoiceTotalsSummary`
  and `InvoiceLineRow` are pure display components fed already-computed
  numbers; verified by grepping every invoice screen/component for inline
  arithmetic on total/price/amount-shaped values (only a display-only unary
  sign flip for showing "-10.00" turned up).
- **Fields dynamically follow the selected invoice type, per the brief.**
  Every screen that renders line-item fields (`InvoiceLineFormFields`,
  `CreateInvoiceItemsScreen`, `InvoiceReviewScreen`) resolves the field set
  via Phase 3's `resolveInvoiceFieldConfig()` — nothing hard-codes which of
  Description/SKU/Quantity/Unit/Weight/Length/Width/Height/Discount/Tax
  exists for a given invoice. Changing an invoice's type after lines were
  already entered reconciles every existing line
  (`domain/invoice/snapshot.ts`'s `reconcileInvoiceLineWithFieldConfig`),
  nulling out fields the new type no longer includes rather than leaving a
  stale, invisible value sitting in the draft.
- **The IMPORTANT SNAPSHOT RULE is implemented exactly as specified.**
  `InvoiceItemSnapshot` (`domain/invoice/types.ts`) copies plain values off an
  `Item` at the moment it's added (`domain/invoice/snapshot.ts`'s
  `invoiceLineFromItem`) — never a reference. The `invoice_item.item_id`
  column uses `ON DELETE SET NULL`, so deleting a catalog item (Phase 4)
  can never fail or corrupt an existing invoice; renaming/re-pricing an item
  afterwards never touches invoices that already copied its old values,
  because nothing in this phase ever re-reads `Item` to redraw an existing
  line. Each line's `subtotal`/`discountAmount`/`taxAmount`/`lineTotal` are
  also frozen once, at save time, and stored — not recomputed on read — so a
  future change to the calculation formula can't silently rewrite a
  historical invoice either. Verified by a dedicated test
  (`snapshot.test.ts`: "mutating the item afterwards never changes an
  already-built line").
- **Invoice numbering uses the business's prefix/next-number and guards
  against duplicates, per the brief.** `BusinessRepository` gained
  `reserveNextInvoiceNumber()`: it atomically reads the current
  `invoicePrefix`/`nextInvoiceNumber`, formats the string the new invoice
  will use, and increments the stored counter — called exactly once, by
  `invoiceStore.create()`, right before persisting. If persistence then
  fails, the reserved number is simply not reused (a small gap, never a
  duplicate). The `invoice.invoice_number` column additionally carries a
  **unique index** as a database-level backstop. The invoice number is
  fixed at creation — no screen lets it be hand-edited afterwards, which is
  what makes "prevent accidental duplicates" actually airtight rather than
  advisory.
- **Payments (Phase 7) don't exist yet, so a real, honest zero stands in for
  them — same pattern Phase 5 established for `CustomerActivityRepository`.**
  A new `PaymentTotalsRepository` interface (`data/paymentTotals/`) is the
  only door invoice-status calculation and screens use to find out how much
  of an invoice has been paid; `ZeroPaymentTotalsRepository` (wired at the
  composition root today) always answers `0`. `domain/invoice/status.ts`'s
  `computeInvoiceStatus()` derives paid/partial/unpaid/overdue from grand
  total + amount paid + due date — never a stored column on `Invoice`,
  mirroring `Customer`'s "no fake permanent balance field" rule
  (`MVP_BUILD_PLAN.md` §6.3/§6.5). When Phase 7 adds real `Payment` records,
  a new `PaymentTotalsRepository` implementation replaces
  `ZeroPaymentTotalsRepository` at the composition root — no screen, store,
  or interface changes required.
- **Phase 5's predicted real `CustomerActivityRepository` was built.**
  `InvoiceBackedCustomerActivityRepository` reads a customer's actual
  invoices and reduces them with the exact same `summarizeActivity()` every
  mock implementation already shared, replacing `NullCustomerActivityRepository`
  at the composition root (`NullCustomerActivityRepository` itself is
  untouched and still exists/tested — it's simply no longer wired in, the
  same way `InMemory*` repositories stay in the codebase for tests after
  their `Sqlite*` counterpart ships). Customer Detail's balance/history now
  show real numbers once invoices exist. Payments (Phase 7) still read back
  as zero via `PaymentTotalsRepository`, so "Total paid"/"Outstanding" will
  update fully once that phase lands — not before.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens → `invoiceStore`
  (persisted list/detail) + `invoiceDraftStore` (transient wizard state for
  Create/Edit/Duplicate, pure Zustand UI state per §2 — never itself a
  repository) → `InvoiceRepository`/`BusinessRepository`/`PaymentTotalsRepository`
  interfaces → SQLite (Drizzle) / in-memory implementations. Screens never
  import the database, a concrete repository, or hard-code a total.
- Reused rather than duplicated: `ActionButton`, `FormField`, `OptionPicker`,
  the `colors` theme, Phase 3's `resolveInvoiceFieldConfig`/field catalog,
  Phase 4's `ItemListScreen` picker mode (for "add item to invoice"), and
  Phase 5's `CustomerListScreen` picker mode (for "Create Invoice –
  Customer" — see below).

### 1. Screens built (per the brief's 7 named screens)

1. **Invoice List** — `src/screens/invoice/InvoiceListScreen.tsx`. Search
   (invoice number/customer name), a status filter chip picker (All/Unpaid/
   Partial/Paid/Overdue, computed via `computeInvoiceStatus`, never stored),
   a scrollable list (`InvoiceListRow`: number, customer, date, grand total,
   status badge), "+ New invoice", and loading/error/empty states.
2. **Create Invoice – Customer** — **not a separate screen file.** Starting
   a new invoice seeds `invoiceDraftStore` (`startCreate`, prefilling invoice
   type from Phase 3's business default and due date/terms from Phase 2's
   default payment terms) and opens `CustomerList` in **picker mode** — the
   exact hook Phase 5 built and predicted Phase 6 would reuse
   ("`CustomerList`'s picker mode ... so Phase 6 doesn't have to touch these
   screens to add customer selection to invoice creation"). Selecting a
   customer sets it on the draft and forwards into step 3.
3. **Create Invoice – Items** — `src/screens/invoice/CreateInvoiceItemsScreen.tsx`.
   Shows the selected customer, an invoice-type picker (reconciling existing
   lines on change, see above), the current line items (`InvoiceLineRow`,
   tap to edit, swipe-style Remove with confirmation), "+ Add item" (opens
   Phase 4's `ItemListScreen` picker mode — selecting an item snapshots it
   onto a new, already-sensible-defaults line with **no extra navigation
   hop**, avoiding a React Navigation `navigate`-then-immediate-`goBack`
   ordering hazard that would otherwise undo the forward navigation), "+ Add
   custom line" (a manual line with no catalog item, via step 3b below), a
   live totals preview, and "Continue to review" (blocked with an inline
   alert if zero lines exist). Reused unchanged as the items-editing step for
   Edit Invoice and Duplicate Invoice.
   - **3b. Edit/Add Invoice Line** — `src/screens/invoice/EditInvoiceLineScreen.tsx`.
     One dynamic form (`InvoiceLineFormFields`, mirroring `ItemFormFields`'s
     pattern) for both adding (`lineIndex: null`) and editing
     (`lineIndex: number`) a line, plus a Remove action when editing.
4. **Invoice Review** — `src/screens/invoice/InvoiceReviewScreen.tsx`. Invoice
   number preview (the real next number for create/duplicate via
   `formatNextInvoiceNumber`, the actual existing number for edit), customer,
   invoice type, editable invoice date/due date/notes/terms
   (`InvoiceDetailsFormFields`, `YYYY-MM-DD` text fields — no date-picker
   dependency added, per the "no unnecessary packages" rule already
   established for chip-pickers), a read-only items list with an "Edit
   items" shortcut back to step 3, the calculated totals
   (`InvoiceTotalsSummary`), and Save. Save branches only on
   `invoiceDraftStore.mode`: `create`/`duplicate` call `invoiceStore.create()`
   (which reserves a number first); `edit` calls `invoiceStore.update()`
   (number untouched). Either way, on success the screen pops the whole
   creation stack (`popToTop()`) and lands on Invoice Detail for the
   saved invoice.
5. **Invoice Detail** — `src/screens/invoice/InvoiceDetailScreen.tsx`. Number,
   computed status badge, customer, invoice type, dates, items, calculated
   totals, notes/terms (only rendered when set), and actions: **Edit
   invoice**, **Duplicate**, **Record payment** (Phase 7 — "coming soon"
   alert, same non-breaking approach Phase 4/5 used for their own
   forward-looking hooks), **Share / PDF** (Phase 9 — "coming soon", per the
   brief's explicit "do not implement PDF yet"), and **Delete invoice**
   (confirm, then removes and goes back).
6. **Edit Invoice** — `src/screens/invoice/EditInvoiceScreen.tsx`. A thin
   loader: loads the invoice + its customer (falling back to the invoice's
   own `customerName` snapshot if the contact can no longer be found),
   seeds the draft (`startEdit` — customer and invoice type are fixed;
   dates/notes/terms/items are editable), and `navigation.replace()`s into
   step 3 so the back button from there returns to Invoice Detail, not to
   this loading screen.
7. **Duplicate Invoice** — **not a separate screen file**, by design (see
   "Known limitations"). Invoice Detail's "Duplicate" action loads the
   source invoice's real customer the same way Edit Invoice does, seeds the
   draft (`startDuplicate` — fresh id, fresh dates, `dueDate` reset to null,
   items/notes/terms copied), and opens Invoice Review directly (mode
   `'duplicate'`); "Edit items" from there reaches the same items-editing
   screen as Create/Edit if the copy needs adjusting before saving as a
   brand-new invoice with a freshly reserved number.

Shared components (`src/components/invoice/`): `InvoiceListRow`,
`InvoiceLineRow` (used on Create Items, Review, and Detail — one
implementation for all three so they can't drift apart),
`InvoiceLineFormFields`, `InvoiceDetailsFormFields`, `InvoiceTotalsSummary`
(display-only, see "What was built"), `InvoiceStatusBadge`.

**Navigation:** `RootStackParamList` gained `InvoiceList`, `CreateInvoiceItems`,
`EditInvoiceLine` (`{ lineIndex: number | null }`), `InvoiceReview`,
`InvoiceDetail` (`{ invoiceId: string }`), `EditInvoice` (`{ invoiceId: string }`);
`RootNavigator` registers all six. Additive entry points, no existing
screen behavior/tests changed beyond what's noted: `BusinessScreen` gained
an "Invoices" `ActionButton`; `CustomerDetailScreen`'s "Create invoice"
button now performs real navigation (seeding the draft with that customer
pre-selected and jumping straight to step 3) instead of Phase 5's "coming
soon" alert — exactly the upgrade Phase 5's doc comment predicted Phase 6
would make.

### 2. Backend files

No backend service was built — none is required (everything is local
SQLite, exactly like Phases 1–5). Documented future contract, per the "APIs
only where required" instruction:

- **Invoice list/search** — would be `GET /invoices?search=&status=&customerId=`
  → `Invoice[]` (`src/domain/invoice/types.ts`: id, invoiceNumber, customerId,
  customerName, invoiceTypeId, issueDate, dueDate, notes, terms, items[],
  createdAt, updatedAt — `items` embedding the frozen `InvoiceItemSnapshot[]`).
  Would back a future `RemoteInvoiceRepository` implementing today's
  `InvoiceRepository` interface unchanged; status filtering would stay a
  client-side concern the same way it is today (see "Database changes"),
  since it depends on payment data the invoice endpoint itself doesn't own.
- **Invoice create/update/delete** — `POST /invoices` (server-side reserving
  the next number the same way `BusinessRepository.reserveNextInvoiceNumber()`
  does locally), `PUT /invoices/:id` (dates/notes/terms/items only — customer
  and type stay fixed, see `InvoiceUpdateInput`), `DELETE /invoices/:id`.
  Same interface, no new screen-facing contract.
- **Payment totals** — would be `GET /invoices/:id/paid-total` and a batch
  form, behind a future `RemotePaymentTotalsRepository` implementing today's
  `PaymentTotalsRepository` interface — the natural remote counterpart to
  whatever real (Payment-backed) implementation Phase 7 writes locally
  first.
- Not built now because nothing in Phase 6 needs network I/O.

### 3. Database changes

Two new tables, `invoice` and `invoice_item` (`src/data/db/schema.ts`) — the
third/fourth tables in this codebase that aren't the shared `business` row
(after `item` and `customer`, Phases 4/5):

- **`invoice`**: `id`, `invoice_number` (unique index — see "What was
  built"), `customer_id` (FK → `customer.id`, **no** `onDelete` clause —
  combined with `PRAGMA foreign_keys = ON` already enabled in `db/client.ts`,
  deleting a customer that has invoices now fails with a constraint error
  instead of silently orphaning historical invoices; Phase 5's
  `CustomerListScreen` delete flow already wraps this in a generic
  "couldn't delete" alert, so nothing there needed to change), `customer_name`
  (the light additive snapshot — see "What was built"), `invoice_type`,
  `issue_date`, `due_date`, `notes`, `terms`, `created_at`, `updated_at`.
  Indexes: `invoice_number_idx` (unique), `invoice_customer_idx`,
  `invoice_issue_date_idx`.
- **`invoice_item`**: `id`, `invoice_id` (FK → `invoice.id`, `ON DELETE CASCADE`
  — deleting an invoice cleans up its lines), `item_id` (FK → `item.id`,
  `ON DELETE SET NULL` — see the snapshot-rule note above), `sort_order`,
  `item_name`, `description`, `sku`, `quantity`, `unit`, `weight`, `length`,
  `width`, `height`, `unit_price`, `discount_percent`, `tax_percent`,
  `subtotal`, `discount_amount`, `tax_amount`, `line_total` (the last four
  frozen once at save time — see "What was built"). Indexes:
  `invoice_item_invoice_idx`, `invoice_item_item_idx`.
- Added to `CREATE_TABLES_SQL` alongside the existing tables — brand-new
  tables need no `ensureBusinessColumns()`-style backfill migration, same
  reasoning Phases 4/5 documented for `item`/`customer`. Canonical SQL
  regenerated via `node node_modules/drizzle-kit/bin.cjs generate` →
  `drizzle/0005_plain_joystick.sql`, matches the hand-written
  `CREATE_TABLES_SQL` addition exactly (verified by hand — the generator's
  own summary confirms 6 tables total, `invoice` with 11 columns/3
  indexes/1 FK, `invoice_item` with 20 columns/2 indexes/2 FKs).
- **`business` gained no new columns this phase** — invoice numbering reuses
  the `invoice_prefix`/`next_invoice_number` columns Phase 2 already added;
  only a new repository method (`reserveNextInvoiceNumber()`) was needed, not
  a schema change.

New repositories, following the established three-file pattern:

- `InvoiceRepository` interface (`src/data/invoice/InvoiceRepository.ts`):
  `list(filter?)`, `getById(id)`, `create(invoiceNumber, input)` (the number
  must already be reserved — see "What was built"), `update(id, input)`,
  `delete(id)`. Deliberately has no knowledge of `BusinessRepository` or
  `PaymentTotalsRepository` — status filtering (which needs payment data)
  is applied one layer up, in `invoiceStore`, after the repository returns
  the search/customer-filtered list (see `domain/invoice/filtering.ts`'s doc
  comment for the full reasoning).
- `InMemoryInvoiceRepository` — mock/testing implementation; freezes each
  line's calculated numbers via `domain/invoice/calculations.ts`'s
  `calculateLineTotal` exactly once, at `create`/`update` time.
- `SqliteInvoiceRepository` — real implementation against `invoice`/
  `invoice_item` via Drizzle queries; replaces an invoice's line-item set
  wholesale on update (delete-then-reinsert, same "simpler than diffing for
  this data size" reasoning `SqliteBusinessCardRepository` used for social
  links). No Jest coverage — Jest can't drive the native SQLite module
  without a device, same as every other `Sqlite*` repository in this
  codebase; its line-total math is unit-tested once, in plain TypeScript,
  via the exact same `calculateLineTotal` both implementations call.
- `PaymentTotalsRepository` / `ZeroPaymentTotalsRepository`
  (`src/data/paymentTotals/`) — see "What was built".
- `InvoiceBackedCustomerActivityRepository` (`src/data/customerActivity/`)
  — see "What was built"; `NullCustomerActivityRepository` is no longer
  wired at the composition root but remains in the codebase, tested, as a
  documented reference implementation of "the honest zero case."

### 4. Tests

381 Jest tests across 90 suites, all passing (`npx jest` / `npm test`, up
from Phase 5's 269 across 66 — run three times in a row to confirm
stability, all green); TypeScript strict-mode `tsc --noEmit` is clean; a
full Metro static export (`expo export --platform android`) bundles the
whole app (1484 modules, up from Phase 5's 1460) with no resolution errors.

- **Domain** (`src/domain/invoice/__tests__/`): `calculations.test.ts`
  (quantity × price, null-quantity-treated-as-1, discount-then-tax ordering,
  rounding, summing already-computed lines without recomputation),
  `status.test.ts` (unpaid/overdue/partial/paid transitions, paid-past-due
  still "paid", negative amountPaid never producing a false partial),
  `snapshot.test.ts` (plain-value copying, only-relevant-physical-fields,
  **mutating the source item afterwards never changes an already-built
  line** — the core snapshot-rule guarantee — plus field-set reconciliation
  when the invoice type changes), `filtering.test.ts` (search by number/
  customer name, status filtering via the shared `computeInvoiceStatus`,
  customerId filtering, newest-issue-date-first sort without mutation),
  `validation.test.ts` (line-form and date/notes/terms Zod schemas,
  including calendar-invalid-date rejection and due-before-issue rejection),
  `formMapping.test.ts` (line and details form↔domain round-trips,
  itemId preserved across an edit, `addDaysIso` across month/year
  boundaries).
- **Repository** (`InMemoryInvoiceRepository.test.ts`): empty list, create
  computes line totals and assigns each line its own id, `getById` hit/miss,
  newest-first sort, search+customerId filtering, update replaces items/
  dates/notes/terms while keeping id/number/customer/type, update on a
  missing id throws, delete + no-op on unknown id, seed array not shared.
- **`ZeroPaymentTotalsRepository.test.ts`**: zero for a single invoice, zero
  for a batch, empty map for an empty batch.
- **`InvoiceBackedCustomerActivityRepository.test.ts`**: empty summary/history
  with no invoices, summarizes only the given customer's invoices, an
  overdue unpaid invoice reflected in both `overdueAmount` and the raw
  `'overdue'` history status (matching `InMemoryCustomerActivityRepository`'s
  existing lowercase-keyword convention, not a display label), history
  filtering by type staying newest-first.
- **`BusinessRepository` extension** (`InMemoryBusinessRepository.test.ts`):
  `reserveNextInvoiceNumber` formats and atomically increments, works before
  any profile was ever saved, and never clobbers other business fields.
  `failingRepository()` test helpers in `businessProfileStore.test.ts`,
  `invoiceSettingsStore.test.ts`, and `invoiceTypeStore.test.ts` were
  extended with the new interface method (required for `tsc --noEmit` to
  stay clean) — no existing assertions changed.
- **Stores**: `invoiceStore.test.ts` (idle→ready empty load, create reserves
  a number from the business repository then creates, status computed and
  filtered using real payment totals, `getDetail` null-vs-found, update/
  remove both reload, error states from a failing repository surfaced
  without throwing and rejecting `create()`'s promise), `invoiceDraftStore.test.ts`
  (`startCreate`/`startEdit`/`startDuplicate` seeding correctly — including
  edit stripping a snapshot's calculated fields back to editable input, and
  duplicate resetting dates/clearing the editing id — plus `addLine`/
  `updateLine`/`removeLine`/`setDetails`).
- **Screens** (`src/screens/invoice/__tests__/`, 13 files — see the
  test-file splitting note below): `InvoiceListScreen` (empty state, listing,
  search filtering, starting a new invoice seeds the draft and opens the
  customer picker, row tap → Invoice Detail), `CreateInvoiceItemsScreen`
  (no-customer fallback, customer/empty-items display, adding a catalog item
  via the picker callback with **no** extra navigation, "+ Add custom line"
  → `EditInvoiceLine` with a null index, tapping a line → its index, remove
  with confirmation, blocking Continue at zero items, continuing to Review,
  **switching invoice type reconciles existing lines** — the dynamic-fields
  guarantee verified end-to-end), `EditInvoiceLineScreen` (+ `.save`,
  `.editSave`, `.remove`) (blank-for-add vs pre-filled-for-edit, Weight-type
  showing only Weight not Length/Width/Height, add appends with `itemId:
  null`, editing an existing catalog-sourced line keeps its `itemId`, remove
  with confirmation), `InvoiceReviewScreen` (+ `.createSave`, `.editSave`)
  (customer/type/items/totals/number-preview display, "Edit items"
  navigation, create-mode save reserves a number and lands on Invoice
  Detail, edit-mode save updates in place keeping the same number),
  `InvoiceDetailScreen` (+ `.duplicate`, `.delete`) (not-found, full display
  including notes/terms, Edit navigation, "coming soon" for Record
  Payment/Share, duplicate seeding the draft from the invoice's **real**
  customer record — with a snapshot-name fallback when that customer can no
  longer be found — and delete-with-confirmation), `EditInvoiceScreen`
  (loads invoice + customer, seeds the draft, `replace()`s into the items
  screen; not-found state). `BusinessScreen` gained one additive test for
  the new "Invoices" button; `CustomerDetailScreen.comingSoon.test.tsx` was
  split into a genuine "still coming soon" (Record Payment) test and a new
  "now navigates for real" (Create Invoice) test, replacing the one
  assertion Phase 5 made that Phase 6 was explicitly meant to invalidate.
- **Test-file splitting, applied proactively this time (not discovered via a
  flake):** every screen with a `react-hook-form` + zod-resolver submit
  action (`EditInvoiceLineScreen`, `InvoiceReviewScreen`) was split so each
  test file contains at most one resolver-triggered submission, per the
  root-caused pattern Phase 4 (`CreateItemScreen`) and Phase 5
  (`CustomerDetailScreen`) already documented and fixed reactively — applying
  it up front here avoided reproducing that instability class a third time.
  Verified stable across three consecutive full-suite runs (381/381, zero
  failures each time).
- **De-duplicated calculation note (a correctness/consistency pass, not a
  bug fix):** `domain/invoice/filtering.ts` and
  `InvoiceBackedCustomerActivityRepository.ts` initially each summed a
  line's `lineTotal` inline (`items.reduce((sum, item) => sum + item.lineTotal, 0)`)
  to get an invoice's grand total for status computation. Since
  `domain/invoice/calculations.ts`'s `sumInvoiceTotals` already exists to do
  exactly this, both call sites were switched to use it instead — per
  `MVP_BUILD_PLAN.md` §11's "No duplicate ... calculations" rule — before
  considering the phase done. Grepped the entire `src/screens/invoice` and
  `src/components/invoice` trees for any remaining inline arithmetic on
  total/price/amount-shaped values to confirm none exists outside
  `domain/invoice/calculations.ts` and the two data-layer call sites that
  now delegate to it.
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as Phases 1–5 (no device/emulator in this environment). Manual
  verification steps below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → Business → "Invoices" → Invoice List loads showing the
   empty state — no network call anywhere in this flow.
3. Tap "+ New invoice" → the Customer List picker opens → pick an existing
   customer (or tap "+ New customer" to create one inline, per Phase 5's
   picker hook) → Create Invoice – Items opens with that customer shown.
4. Pick an invoice type (try "Dimension") → tap "+ Add item" → pick a
   catalog item from the Item List picker → it appears immediately as a
   line with sensible defaults (quantity 1, catalog price, catalog tax) →
   tap the line → adjust quantity/length/width/height → Save line.
5. Tap "+ Add custom line" → fill in a manual line with no catalog item →
   Save line → confirm the running totals update.
6. Switch the invoice type to "General" → confirm the Dimension-only fields
   (Length/Width/Height) silently drop off the line without crashing or
   showing stale data.
7. Tap "Continue to review" → set the invoice date/due date/notes/terms →
   confirm the previewed invoice number (e.g. "INV-1") and the Subtotal/
   Discount/Tax/Grand total breakdown → tap "Save invoice". Writes to local
   SQLite only (`invoice` + `invoice_item` rows, and the business's
   `next_invoice_number` incremented) — lands on Invoice Detail.
8. From Invoice Detail: tap "Edit invoice" → change a line's quantity and
   the due date → Save → confirm Detail reflects the new totals/date and
   the invoice number is unchanged.
9. Tap "Duplicate" → confirm Review opens pre-filled with the same customer
   and items, a blank due date, and today's invoice date → Save → confirm a
   **second**, separate invoice now exists with its own new number, and the
   original is untouched.
10. Go to that customer's Customer Detail screen → confirm "Total billed"/
    "Invoice count"/"Outstanding" now reflect the real invoices just
    created (no longer all zero, as Phase 5 correctly left them) → tap
    "History" → confirm both invoices appear, newest first.
11. Delete one of the two invoices from its Detail screen (confirm in the
    dialog) → confirm it disappears from Invoice List and from the
    customer's History.
12. Close the app fully, reopen it (still offline) → repeat steps 2/10 to
    confirm everything was actually persisted to SQLite, not just in
    memory.
13. Confirm Phases 1–5 screens (Digital Business Card, Business Profile,
    Invoice Settings, Invoice Type Selection, Items, Customers) still work
    exactly as before.

This wasn't run against a physical device/emulator in this environment
(none is available here); the schema, repository, and offline-safe design
were verified as far as this environment allows (unit tests + strict
typecheck + full Metro bundle export), same as Phases 1–5.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as Phases 1–5.
- **"Create Invoice – Customer" and "Duplicate Invoice" are not separate
  screen files.** The brief names seven screens; two of them are existing
  reusable screens/flows entered in a particular mode rather than new files
  — "Customer" is Phase 5's `CustomerListScreen` picker mode (built and
  explicitly earmarked for this in Phase 5), and "Duplicate" is Invoice
  Detail's action opening Invoice Review in `'duplicate'` mode. This is a
  deliberate "reuse, don't duplicate" choice consistent with how Phase 4/5
  built their own item/customer pickers for exactly this reuse; the
  functionality described for both named screens is fully present, just not
  as a dedicated component.
- **Discount is modelled as a percentage (0–100), not a flat currency
  amount.** The brief lists "Discount" as an item-line field without
  specifying its unit; percentage was chosen for symmetry with how Tax is
  already modelled everywhere else in this codebase (`Item.taxRate`,
  `InvoiceSettings.defaultTaxRate`). A flat-amount discount mode would be a
  reasonable future enhancement if real usage needs it, but would require a
  visible per-line "type" toggle not requested here.
- **Invoice number and invoice type are fixed at creation — neither is
  editable from Edit Invoice.** Changing either after items exist risks
  orphaning already-entered per-line fields (type) or reintroducing the
  duplicate-number risk the brief explicitly asks to prevent (number); both
  are intentional simplifications, not oversights. Duplicating an invoice
  is the supported path to "start a similar invoice with a different type."
- **Customer is also fixed at creation for Edit Invoice** (changeable for
  Duplicate, since that produces a brand-new invoice) — real-world invoicing
  practice is to correct a wrong customer by cancelling/duplicating rather
  than silently reassigning an issued invoice's "bill to."
- **`invoice.customer_name` is a light, additive snapshot beyond the
  brief's literal ask** (which only mandates snapshotting *items*) — added
  so Invoice List/Detail can render the "bill to" name without a customer
  join and so a later customer rename doesn't rewrite an invoice's header,
  the same reasoning applied narrowly. Phone/email/address are **not**
  snapshotted onto the invoice; Invoice Detail doesn't display them, and
  Duplicate/Edit look the live contact up via `CustomerRepository` (falling
  back to the name snapshot only if that contact is gone).
- **Deleting a customer that has invoices now fails** (a behavior change
  from Phase 5's world, where no invoices could exist yet) — enforced by the
  `invoice.customer_id` foreign key with `PRAGMA foreign_keys = ON`, not
  application code. Phase 5's `CustomerListScreen` delete flow already shows
  a generic "couldn't delete" alert on any repository failure, so this
  degrades gracefully without a code change, but the message doesn't yet
  say *why* specifically. A clearer "this customer has N invoices" message
  would be a reasonable follow-up.
- **No PDF, no sharing** — per the explicit instruction not to build PDF
  yet; Invoice Detail's "Share / PDF" button is a "coming soon" alert,
  Phase 9 scope.
- **Payments read back as zero everywhere** (status, customer balance,
  invoice list filtering) — correct and honest given `Payment` (Phase 7)
  doesn't exist yet; see `PaymentTotalsRepository`'s doc comment for exactly
  how Phase 7 replaces `ZeroPaymentTotalsRepository` without touching any
  screen, store, or interface.
- **No native date-picker component was added** — `issueDate`/`dueDate` are
  validated `YYYY-MM-DD` text fields, per the same "no unnecessary packages"
  rule already established for chip-pickers; revisit only if a real
  calendar-picker UX is explicitly requested.
- **No pagination/virtualization tuning beyond `FlatList`'s defaults** on
  Invoice List — same reasoning as Phases 4/5's list screens.
- **Line-item update on Edit Invoice replaces the whole set** (delete then
  reinsert) rather than diffing — fine at the line counts a small business
  invoice realistically has, same reasoning `SqliteBusinessCardRepository`
  already used for social links.
- **Invoice number reservation isn't wrapped in an explicit SQL transaction**
  in `SqliteBusinessRepository.reserveNextInvoiceNumber()` — consistent with
  every other `Sqlite*` repository in this codebase (none use explicit
  transactions), and low-risk for a single-user, single-device, offline app;
  the unique index on `invoice_number` is the actual backstop if this ever
  matters.

### 7. Files modified

New files: `src/domain/invoice/{types,calculations,status,snapshot,
filtering,validation,formMapping}.ts` + `__tests__/{calculations,status,
snapshot,filtering,validation,formMapping}.test.ts` (7 impl + 6 test files),
`src/data/invoice/{InvoiceRepository,InMemoryInvoiceRepository,
SqliteInvoiceRepository}.ts` + `__tests__/InMemoryInvoiceRepository.test.ts`,
`src/data/paymentTotals/{PaymentTotalsRepository,ZeroPaymentTotalsRepository}.ts`
+ `__tests__/ZeroPaymentTotalsRepository.test.ts`,
`src/data/customerActivity/InvoiceBackedCustomerActivityRepository.ts` +
`__tests__/InvoiceBackedCustomerActivityRepository.test.ts`,
`src/state/{invoiceStore,invoiceDraftStore}.ts` +
`__tests__/{invoiceStore,invoiceDraftStore}.test.ts`,
`src/components/invoice/{InvoiceStatusBadge,InvoiceTotalsSummary,
InvoiceLineRow,InvoiceLineFormFields,InvoiceDetailsFormFields,
InvoiceListRow}.tsx`, `src/screens/invoice/{InvoiceListScreen,
CreateInvoiceItemsScreen,EditInvoiceLineScreen,InvoiceReviewScreen,
InvoiceDetailScreen,EditInvoiceScreen}.tsx` + `__tests__/*.test.tsx`
(13 files — see the test-file splitting note above),
`drizzle/0005_plain_joystick.sql` (+ updated `drizzle/meta/`).

Modified files: `src/data/business/BusinessRepository.ts`
(`reserveNextInvoiceNumber()`), `InMemoryBusinessRepository.ts` /
`SqliteBusinessRepository.ts` (implementations),
`src/data/business/__tests__/InMemoryBusinessRepository.test.ts` (three new
tests), `src/data/db/schema.ts` (new `invoice`/`invoice_item` tables + five
indexes), `src/data/container.ts` (`getInvoiceRepository()`,
`getPaymentTotalsRepository()`, `getCustomerActivityRepository()` swapped to
the real invoice-backed implementation), `src/navigation/types.ts` (six new
routes), `src/navigation/RootNavigator.tsx` (six new screens registered),
`src/screens/business/BusinessScreen.tsx` (one additive "Invoices"
`ActionButton`), `src/screens/business/__tests__/BusinessScreen.test.tsx`
(one new assertion), `src/screens/customer/CustomerDetailScreen.tsx`
("Create invoice" now real navigation, per Phase 5's own prediction),
`src/screens/customer/__tests__/CustomerDetailScreen.comingSoon.test.tsx`
(split as described above), `src/state/__tests__/{businessProfileStore,
invoiceSettingsStore,invoiceTypeStore}.test.ts` (`failingRepository()`
helpers extended for the one new interface method only), `MVP_BUILD_PLAN.md`
(status header only).

### 8. Issues

None outstanding. One correctness/consistency issue was found and fixed
while verifying this phase (not shipped): two call sites summed a line's
`lineTotal` inline instead of calling the already-existing
`sumInvoiceTotals` — see the "De-duplicated calculation note" under "Tests"
above. Full suite re-run and green after the fix (381/381, three consecutive
runs).

**Next phase:** Phase 7 — Payments. Complete — see below.

---

## Phase 7 — Payments

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phases 1–6 was deleted or behaviorally
changed except the touch points listed below (all additive/upgraded, same
pattern every prior phase followed for its own forward-looking hooks).

### What was built

- Payment functionality end-to-end on the frontend, backed by the real local
  SQLite database — same frontend-first sequencing as Phases 1–6:
  `InMemoryPaymentRepository` and every pure domain function were built and
  unit-tested first, then `SqlitePaymentRepository` was added behind the same
  `PaymentRepository` interface and wired in at the composition root
  (`src/data/container.ts`).
- **Payments are separate, additive records, exactly as `MVP_BUILD_PLAN.md`
  §6.3 specifies — never a mutable `amountPaid` field on `Invoice`.** The
  worked example from the brief (Invoice $1,000, Payment 1 $300, Payment 2
  $200 ⇒ Paid $500, Remaining $500) is a literal test case in three places:
  `domain/payment/__tests__/calculations.test.ts`,
  `InMemoryPaymentRepository.test.ts`, and
  `RecordPaymentScreen.save.test.tsx`.
- **Centralized payment calculation logic, per the brief's explicit
  instruction.** `domain/payment/calculations.ts` is the *only* place payment
  arithmetic exists: `sumPayments` (adds up any list of payments — never
  recomputes a payment's own amount), `remainingBalance` (`grandTotal -
  amountPaid`, floored at 0), `overpaidAmount` (the excess when payments
  exceed the total), and `summarizeInvoicePayments` (the convenience wrapper
  every payment-summary screen calls). No screen sums a payments array
  itself — verified by grepping every non-test file under `src/` for a
  `.reduce` over an `amount`-shaped field; the only production call sites are
  `domain/payment/calculations.ts` itself and `domain/customer/activity.ts`
  (the pre-existing, Phase-5-established customer-outstanding calculation —
  see below). `PaymentBackedPaymentTotalsRepository` (invoice-level "how much
  has been paid") and `InvoiceBackedCustomerActivityRepository`
  (customer-level "total paid"/"outstanding") both delegate to this same
  module rather than re-deriving sums their own way.
- **Customer outstanding is exactly "total invoice amounts minus total
  payments," computed once.** `domain/customer/activity.ts`'s
  `summarizeActivity()` (built in Phase 5, honest-zero until now) already
  computed `outstanding = totalBilled - totalPaid` (floored at 0) from
  whatever activity entries it's handed; this phase's only change there was
  supplying it *real* payment entries for the first time — the formula
  itself was not touched, and was not duplicated anywhere else.
- **`PaymentTotalsRepository`'s predicted real implementation shipped.**
  `PaymentBackedPaymentTotalsRepository` (`data/paymentTotals/`) sums actual
  `Payment` rows per invoice via `sumPayments`, replacing
  `ZeroPaymentTotalsRepository` at the composition root exactly as that
  class's own doc comment predicted in Phase 6 — no screen, store, or the
  `PaymentTotalsRepository` interface itself needed to change.
  `ZeroPaymentTotalsRepository` itself is untouched and remains in the
  codebase, tested, as the documented "no payments exist" reference
  implementation (same treatment `NullCustomerActivityRepository` got after
  Phase 6 superseded it).
- **`InvoiceBackedCustomerActivityRepository` (Phase 6) was extended, not
  replaced, to fold in real payments.** It now takes a third constructor
  argument, `PaymentRepository`, and its `buildEntries()` appends real
  `'payment'`-type `CustomerActivityEntry` rows (scoped by the payment's own
  `customerId` snapshot) alongside the existing invoice entries — this is
  what makes Customer History (Phase 5's screen) show real payments for the
  first time, and what makes Customer Detail's "Total paid"/"Outstanding"
  finally move off zero.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens → `paymentStore`
  (Zustand, list/CRUD) → `PaymentRepository` interface → SQLite (Drizzle) /
  in-memory implementation. Screens never import the database, a concrete
  repository, or hard-code a payment total.
- Reused rather than duplicated: `ActionButton`, `FormField`, `OptionPicker`,
  the `colors` theme, the `react-hook-form` + Zod + `Controller` form pattern
  every other Create/Edit screen already uses, and Phase 6's
  `InvoiceListScreen`/`invoiceStore.getDetail` (for loading the invoice a
  payment applies to).

### 1. Screens built (per the brief's 4 named screens)

1. **Record Payment** — `src/screens/payment/RecordPaymentScreen.tsx`.
   Reached from Invoice Detail's "Record payment" action (`invoiceId` fixed,
   already known) or from Customer Detail's "Record payment" action (which
   opens `InvoiceList` in the new invoice-picker mode, scoped to that
   customer, first — see below). Shows the invoice number/customer header,
   the current `PaymentSummaryCard` (Invoice total / Paid / Remaining, or
   Overpaid), and the form (Amount, Payment date, Payment method, Reference,
   Notes). The amount field prefills with the invoice's current remaining
   balance (computed via `summarizeInvoicePayments` from this invoice's own
   real payment rows, so it's never stale) but is freely editable and **not**
   capped at that balance — overpayment is allowed, not blocked. Saving
   builds the `Payment` from the loaded invoice's own id/number/customer
   snapshot, then does `navigation.popToTop(); navigation.navigate('InvoiceDetail', …)`
   — the same "force a fresh mount so it reloads updated totals" pattern
   `InvoiceReviewScreen` (Phase 6) already established, not a focus listener.
2. **Payment History** — `src/screens/payment/PaymentHistoryScreen.tsx`.
   Every payment recorded, across every invoice/customer: search (invoice
   number, customer name, or reference) + a method filter chip
   (All/Cash/Bank transfer/Card/PayPal/Other), newest payment date first,
   tapping a row opens Edit Payment; loading/error/empty states (the empty
   state distinguishes "no payments yet" from "no payments match your
   search/filter"). Reached from a new "Payments" button on the Business
   screen, alongside Items/Customers/Invoices.
3. **Customer payment history** — **not a separate screen file.** Phase 5's
   `CustomerHistoryScreen` (All/Invoices/Payments, newest-first) already
   builds exactly this; this phase's only change is that
   `InvoiceBackedCustomerActivityRepository` now feeds it real payment
   entries instead of an always-empty list (see "What was built"). The
   brief's four named screens map onto three screen files plus this
   already-built one for exactly the reason Phase 6 gave for "Create Invoice
   – Customer"/"Duplicate Invoice": reuse over a near-duplicate list.
4. **Invoice payment summary** — **not a separate screen file**, folded into
   Invoice Detail (`src/screens/invoice/InvoiceDetailScreen.tsx`) as a new
   section: a `PaymentSummaryCard` (Invoice total / Paid / Remaining-or-
   Overpaid) plus every individual payment against this invoice
   (`PaymentListRow`, tap to edit), between the invoice totals and the
   notes/terms. "Record payment" now navigates for real instead of showing
   "coming soon."

Also built, not separately named in the brief but required to make the
above work end-to-end:

- **Edit Payment** — `src/screens/payment/EditPaymentScreen.tsx`. The
  invoice a payment belongs to is fixed (mirrors Edit Invoice's fixed
  customer/type) — amount/date/method/reference/notes are editable, plus a
  **Delete payment** action (confirm, then the same
  `popToTop()`+navigate-to-Invoice-Detail pattern). Reached from Payment
  History rows and from Invoice Detail's payment rows.
- **Invoice-picker mode on `InvoiceListScreen`** (Phase 6's screen,
  extended). `route.params.onSelectInvoice`/`customerId` put it in the same
  kind of picker mode Phase 4/5 built for `ItemList`/`CustomerList` — Customer
  Detail's "Record payment" needs the customer's own invoice picked first
  (a payment always belongs to one invoice), so it reuses this screen instead
  of a second, near-duplicate list. `customerId` scopes the list for exactly
  the lifetime of that screen instance: applied via `setFilter` on mount,
  cleared again via the effect's cleanup on unmount, so it never leaks into
  the global filter the plain "Invoices" tab shares — verified by a
  dedicated test that asserts the store's `filter.customerId` is back to
  `undefined` after unmounting.

Shared components (`src/components/payment/`): `PaymentFormFields` (the
field set Record/Edit Payment both use — Amount, Payment date, Payment
method via `OptionPicker`, Reference, Notes), `PaymentListRow` (used on
Payment History, Customer History's rows already existed from Phase 5 and
were untouched, and Invoice Detail's payment summary — one implementation so
they can't drift apart), `PaymentSummaryCard` (display-only, mirrors
`InvoiceTotalsSummary`'s "never sums, only renders what it's handed" rule).

**Navigation:** `RootStackParamList` gained `RecordPayment
({ invoiceId: string })`, `EditPayment ({ paymentId: string })`,
`PaymentHistory (undefined)`; `InvoiceList`'s params grew
`onSelectInvoice`/`customerId` (both optional, additive). `RootNavigator`
registers all three new screens. Additive/upgraded entry points, no existing
screen behavior changed beyond what's noted: `BusinessScreen` gained a
"Payments" `ActionButton`; `InvoiceDetailScreen`'s "Record payment" button
now performs real navigation instead of a "coming soon" alert;
`CustomerDetailScreen`'s "Record payment" button now opens the invoice
picker instead of alerting — the exact upgrade Phase 5's doc comment
predicted Phase 7 would make, mirroring the "Create invoice" upgrade Phase 6
already made on the same screen.

### 2. Backend files

No backend service was built — none is required (everything is local
SQLite, exactly like Phases 1–6). Documented future contract, per the "APIs
only where required" instruction:

- **Payment list/search** — would be
  `GET /payments?search=&method=&customerId=&invoiceId=` → `Payment[]`
  (`src/domain/payment/types.ts`: id, invoiceId, invoiceNumber, customerId,
  customerName, amount, paymentDate, method, reference, notes, createdAt,
  updatedAt). Would back a future `RemotePaymentRepository` implementing
  today's `PaymentRepository` interface unchanged.
- **Payment create/update/delete** — `POST /payments`, `PUT /payments/:id`
  (amount/date/method/reference/notes only — the invoice is fixed, see
  `PaymentUpdateInput`), `DELETE /payments/:id`. Same interface, no new
  screen-facing contract.
- **Payment totals** — would be `GET /invoices/:id/paid-total` and a batch
  form, behind a future `RemotePaymentTotalsRepository` implementing today's
  `PaymentTotalsRepository` interface — the exact remote counterpart
  `ZeroPaymentTotalsRepository`'s Phase 6 doc comment already described,
  except the local implementation is now `PaymentBackedPaymentTotalsRepository`
  rather than the honest zero.
- Not built now because nothing in Phase 7 needs network I/O.

### 3. Database changes

One new table, `payment` (`src/data/db/schema.ts`) — the fifth table in this
codebase that isn't the shared `business` row (after `item`, `customer`,
`invoice`, `invoice_item`):

- `id`, `invoice_id` (FK → `invoice.id`, `ON DELETE CASCADE` — deleting an
  invoice deletes its payment history with it, since there's nothing left to
  have paid), `invoice_number` (snapshot, same reasoning as
  `invoice.customer_name`), `customer_id` (FK → `customer.id`, no `onDelete`
  clause — mirrors `invoice.customer_id`; safe because a customer with
  payments necessarily has invoices, which already block deletion via their
  own FK), `customer_name` (snapshot), `amount`, `payment_date`, `method`
  (enum: cash/bank_transfer/card/paypal/other), `reference`, `notes`,
  `created_at`, `updated_at`. Indexes: `payment_invoice_idx`,
  `payment_customer_idx`, `payment_date_idx`.
- Added to `CREATE_TABLES_SQL` alongside the existing tables — a brand-new
  table needs no `ensureBusinessColumns()`-style backfill migration, same
  reasoning Phases 4–6 documented for `item`/`customer`/`invoice`. Canonical
  SQL regenerated via `node node_modules/drizzle-kit/bin.cjs generate` →
  `drizzle/0006_dashing_umar.sql`, matches the hand-written
  `CREATE_TABLES_SQL` addition exactly (verified by hand — the generator's
  own summary confirms 7 tables total, `payment` with 12 columns/3
  indexes/2 FKs).
- **No `amountPaid`/balance column was added to `invoice` or `customer`,
  deliberately** — per the brief's explicit payment rule and
  `MVP_BUILD_PLAN.md` §6.3, both stay derived-only (see "What was built").

New repository, following the established three-file pattern:

- `PaymentRepository` interface (`src/data/payment/PaymentRepository.ts`):
  `list(filter?)`, `listByInvoice(invoiceId)`, `getById(id)`, `create(input)`,
  `update(id, input)`, `delete(id)`. Deliberately has no knowledge of
  `InvoiceRepository`/`CustomerRepository` — the caller (`paymentStore`/the
  screens) already has the invoice/customer snapshot fields from loading the
  invoice being paid, exactly like `InvoiceRepository` knows nothing about
  `BusinessRepository`'s numbering.
- `InMemoryPaymentRepository` — mock/testing implementation; search
  delegates to `domain/payment/filtering.ts`'s `paymentMatchesFilter`/
  `sortPayments`.
- `SqlitePaymentRepository` — real implementation against the `payment`
  table via Drizzle queries (SQL `LIKE`/`=`/`AND` for method/customerId/
  invoiceId/search-text filtering, `ORDER BY payment_date DESC`). No Jest
  coverage — Jest can't drive the native SQLite module without a device,
  same as every other `Sqlite*` repository in this codebase; its filter
  semantics are unit-tested once, in plain TypeScript, via
  `domain/payment/filtering.ts`, which `InMemoryPaymentRepository` also runs
  directly.
- `PaymentBackedPaymentTotalsRepository` (`src/data/paymentTotals/`) — see
  "What was built".
- `InvoiceBackedCustomerActivityRepository` — extended, not replaced, to
  also depend on `PaymentRepository` (see "What was built").

### 4. Tests

468 Jest tests across 105 suites, all passing (`npx jest` / `npm test`, up
from Phase 6's 381 across 90 — run three times in a row to confirm
stability, all green); TypeScript strict-mode `tsc --noEmit` is clean; a full
Metro static export (`expo export --platform android`) bundles the whole app
(1497 modules, up from Phase 6's 1484) with no resolution errors.

- **Domain** (`src/domain/payment/__tests__/`): `calculations.test.ts`
  (the brief's exact worked example — $1,000 invoice, $300 + $200 payments ⇒
  $500 paid / $500 remaining — plus fully-paid, unpaid, and overpaid cases,
  and rounding), `validation.test.ts` (positive-amount requirement, rejecting
  zero/negative/non-numeric amounts, **not** capping the amount at any
  balance, calendar-date validation, every payment method accepted, blank
  reference/notes normalized to null), `formMapping.test.ts` (blank-vs-
  remaining-balance-prefill defaults, an existing payment's own amount always
  winning over any prefill, form↔update-input round-trip),
  `filtering.test.ts` (search by invoice number/customer name/reference,
  method/customerId/invoiceId filtering, newest-payment-date-first sort with
  a same-date tiebreaker, no input mutation).
- **Repository** (`InMemoryPaymentRepository.test.ts`): empty list, create
  returns an id/timestamps, **the brief's worked example** (two payments
  against one invoice summing to $500 via `listByInvoice`), `listByInvoice`
  scoping, update keeps the invoice/customer snapshot and id, update on a
  missing id throws, delete + no-op on unknown id, search/method/customerId
  filtering, newest-date sort, a seed array not shared with the caller.
- **`PaymentBackedPaymentTotalsRepository.test.ts`**: zero for an untouched
  invoice, the brief's worked example, never mixing another invoice's
  payments into a total, a batch computed in one call with untouched
  invoices defaulting to 0, an empty batch.
- **`InvoiceBackedCustomerActivityRepository.test.ts`** (extended from Phase
  6, all prior assertions untouched aside from the new constructor
  argument): two new tests — folding real payments into both the summary
  (`totalPaid`/`outstanding`) and the history (a real `'payment'`-type entry,
  `getHistory(..., {type:'payment'})` returning it, an invoice correctly
  showing `'partial'` once a payment exists) — plus a test confirming another
  customer's payments never leak into this customer's history.
- **Store** (`paymentStore.test.ts`): load/create/update/remove/getById/
  listByInvoice/setFilter happy paths (including the brief's worked example
  and an explicit overpayment case), error states from a failing repository
  — mirrors `itemStore.test.ts`'s coverage shape.
- **Screens**: `RecordPaymentScreen` (not-found, header + payment-summary
  display with zero payments, amount field prefilled from a real partial
  payment's remaining balance) + `.save` (records a payment, matching the
  brief's example, in its own file per the established "one resolver-
  triggered submission per file" rule) + `.overpayment` (a payment larger
  than the remaining balance is accepted, not rejected — its own file for
  the same reason); `EditPaymentScreen` (not-found, pre-fills from the
  existing payment's own values) + `.save` (corrects a mistaken amount,
  invoice stays fixed) + `.delete` (confirm, removes, returns to Invoice
  Detail); `PaymentHistoryScreen` (empty state, listing, search filtering,
  row tap → Edit Payment); `InvoiceListScreen` gained two new tests (picker
  mode calling `onSelectInvoice` + going back instead of opening Invoice
  Detail, and `customerId` scoping the list with the scope verified cleared
  after unmount — flushed via `act()` since passive-effect cleanups in this
  RN Testing Library setup don't resolve synchronously on `.unmount()`, the
  same class of async-timing subtlety Phases 4/5 already worked around for
  different reasons); `InvoiceDetailScreen` gained
  `InvoiceDetailScreen.payments.test.tsx` (Paid/Remaining reflecting two real
  partial payments — the brief's example — an Overpaid line replacing a
  negative Remaining, and tapping a payment row navigating to Edit Payment)
  plus two additive tests in the main file (Record Payment now navigates for
  real; the payment-summary section renders with zero payments) replacing
  the one Phase 6 test that Phase 7 was explicitly meant to invalidate
  (`InvoiceDetailScreen.test.tsx`'s combined Record-Payment-and-Share
  "coming soon" test was split — Share/PDF's assertion kept, Record
  Payment's rewritten as real navigation — mirroring exactly how Phase 6
  split `CustomerDetailScreen.comingSoon.test.tsx` for "Create invoice").
  `CustomerDetailScreen.comingSoon.test.tsx` similarly had its one remaining
  "coming soon" assertion (Record Payment) rewritten to assert the new
  invoice-picker navigation, since no coming-soon action is left on that
  screen after this phase. `BusinessScreen` gained one additive assertion
  for the new "Payments" button.
- **De-duplicated calculation, verified, not fixed (no bug found):**
  grepped every non-test file under `src/` for a `.reduce` over an
  `amount`-shaped value; the only production call sites are
  `domain/payment/calculations.ts` itself and `domain/customer/activity.ts`'s
  pre-existing (Phase 5) `summarizeActivity()` — confirming the brief's "do
  not duplicate this calculation across screens" instruction was met by
  construction, not needing a later cleanup pass the way Phase 6 needed one
  for invoice totals.
- **Test-timing note, root-caused:** the `InvoiceListScreen` `customerId`-
  scope-clears-on-unmount test initially failed even though the cleanup
  effect demonstrably ran (confirmed with a temporary debug log) — React's
  passive-effect cleanup for a component being unmounted doesn't flush
  synchronously within `@testing-library/react-native`'s `.unmount()` in
  this setup; it flushes on the next `act()`/scheduler tick. Fixed by
  wrapping `.unmount()` in `await act(async () => { … })` and asserting via
  `waitFor` afterward, rather than asserting synchronously right after
  `.unmount()`. This is a test-only timing fix — the production cleanup
  logic in `InvoiceListScreen.tsx` was correct as first written and was not
  changed.
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as Phases 1–6 (no device/emulator in this environment). Manual
  verification steps below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → an invoice with a $1,000 grand total → Invoice Detail →
   "Invoice payment summary" shows Paid $0.00, Remaining $1,000.00, no
   payments listed — no network call anywhere in this flow.
3. Tap "Record payment" → the amount field is prefilled with $1,000.00 (the
   full remaining balance) → change it to $300, set the payment date, pick
   "Cash" → Save. Writes to local SQLite only (`payment` row) — lands back on
   Invoice Detail showing Paid $300.00, Remaining $700.00, status "Partial",
   and the new payment listed.
4. Tap "Record payment" again → prefilled with $700.00 → change to $200, pick
   "Bank transfer" → Save → confirm Paid $500.00, Remaining $500.00 — the
   brief's exact worked example.
5. Tap the $200 payment row → Edit Payment → change the amount to $250 →
   Save → confirm Invoice Detail now shows Paid $550.00, Remaining $450.00.
6. Record a third payment of $1,000 (far more than the $450 remaining) →
   confirm it's accepted, not rejected → Invoice Detail now shows an
   "Overpaid" line (not a negative "Remaining") and status "Paid".
7. Delete the $1,000 overpayment from its Edit Payment screen (confirm in
   the dialog) → confirm Invoice Detail returns to Paid $550.00, Remaining
   $450.00, status "Partial".
8. Go to Business → "Payments" → Payment History lists all three remaining
   payments across every invoice, newest first; search by invoice
   number/customer/reference and filter by method both narrow the list.
9. Go to that customer's Customer Detail screen → confirm "Total paid" and
   "Outstanding" now reflect the real payments (no longer zero, as Phase 6
   correctly left "Total paid" before this phase) → tap "History" → confirm
   both invoices and payments appear together, newest first, filterable to
   just one or the other.
10. From Customer Detail, tap "Record payment" → confirm the customer's own
    Invoice List (picker mode) opens showing only that customer's invoices →
    pick one → confirm Record Payment opens with that invoice fixed → Save →
    confirm it lands back on that invoice's Detail screen, not the picker.
11. Close the app fully, reopen it (still offline) → repeat steps 3/8/9 to
    confirm every payment was actually persisted to SQLite, not just in
    memory.
12. Delete an invoice that has payments recorded against it (from its Detail
    screen) → confirm its payment history is gone too (no orphaned rows) and
    it no longer appears in Payment History.
13. Confirm Phases 1–6 screens (Digital Business Card, Business Profile,
    Invoice Settings, Invoice Type Selection, Items, Customers, Invoices)
    still work exactly as before.

This wasn't run against a physical device/emulator in this environment (none
is available here); the schema, repository, and offline-safe design were
verified as far as this environment allows (unit tests + strict typecheck +
full Metro bundle export), same as Phases 1–6.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as Phases 1–6.
- **Overpayment is allowed everywhere, not just at the form level** — per
  the explicit "test overpayment handling" instruction, no screen or
  validation rule blocks recording more than an invoice's remaining balance.
  The UI surfaces it as a distinct "Overpaid" amount (never a negative
  "Remaining") and the invoice's computed status is still "paid" (`amountPaid
  >= grandTotal`, from Phase 6's `computeInvoiceStatus`) — there is no
  "credit balance" or refund/carry-forward concept, since that's explicitly
  outside this phase's scope.
- **No online payment processing** — per the explicit instruction not to
  build it. Every payment method (Cash, Bank transfer, Card, PayPal, Other)
  is a manually-recorded label; none of them trigger a real transaction,
  gateway call, or card capture. "Card"/"PayPal" here mean "the customer paid
  by card/PayPal and I'm recording that fact," not "charge a card."
  `expo-auth-session`/any payment SDK is not part of the approved stack for
  this phase.
- **A payment's invoice (and its customer/invoice-number snapshot) is fixed
  at creation** — correcting a payment recorded against the wrong invoice is
  delete-and-re-record, the same "cancel/duplicate rather than silently
  reassign" reasoning Phase 6 applied to an invoice's customer.
- **"Customer payment history" and "Invoice payment summary" are not
  separate screen files** — both fold into screens Phases 5/6 already built
  (`CustomerHistoryScreen`, `InvoiceDetailScreen`), per the same "reuse over
  near-duplicate" reasoning Phase 6 documented for two of its own four named
  screens. The functionality described for both is fully present.
- **No pagination/virtualization tuning beyond `FlatList`'s defaults** on
  Payment History — same reasoning as every other list screen in this
  codebase.
- **`PaymentBackedPaymentTotalsRepository.getTotalPaidForInvoices` fetches
  every payment once and groups in JS**, rather than one query per invoice or
  a SQL `GROUP BY` — fine at the data volumes a small-business, single-
  device, offline app realistically has, consistent with `SqliteInvoiceRepository.list()`
  and others already doing the same "no premature optimization" thing.
- **No explicit SQL transaction wraps a payment create/update** — consistent
  with every other `Sqlite*` repository in this codebase (none use explicit
  transactions), and low-risk for a single-user, single-device, offline app.
- **No native date-picker component was added** — `paymentDate` is a
  validated `YYYY-MM-DD` text field, per the same "no unnecessary packages"
  rule already established for every other date field in this codebase.

### 7. Files modified

New files: `src/domain/payment/{types,calculations,validation,formMapping,
filtering}.ts` + `__tests__/{calculations,validation,formMapping,filtering}.test.ts`,
`src/data/payment/{PaymentRepository,InMemoryPaymentRepository,
SqlitePaymentRepository}.ts` + `__tests__/InMemoryPaymentRepository.test.ts`,
`src/data/paymentTotals/PaymentBackedPaymentTotalsRepository.ts` +
`__tests__/PaymentBackedPaymentTotalsRepository.test.ts`,
`src/state/paymentStore.ts` + `__tests__/paymentStore.test.ts`,
`src/components/payment/{PaymentFormFields,PaymentListRow,
PaymentSummaryCard}.tsx`, `src/screens/payment/{RecordPaymentScreen,
EditPaymentScreen,PaymentHistoryScreen}.tsx` + `__tests__/*.test.tsx` (7
files — see the test-file splitting note above),
`src/screens/invoice/__tests__/InvoiceDetailScreen.payments.test.tsx`,
`drizzle/0006_dashing_umar.sql` (+ updated `drizzle/meta/`).

Modified files: `src/data/db/schema.ts` (new `payment` table + three
indexes), `src/data/container.ts` (`getPaymentRepository()`,
`getPaymentTotalsRepository()` swapped to the real payment-backed
implementation, `getCustomerActivityRepository()` passing the payment
repository through), `src/data/customerActivity/InvoiceBackedCustomerActivityRepository.ts`
(third constructor argument + real payment entries) +
`__tests__/InvoiceBackedCustomerActivityRepository.test.ts` (updated
constructor calls + two new tests), `src/navigation/types.ts` (three new
routes + `InvoiceList`'s picker-mode params), `src/navigation/RootNavigator.tsx`
(three new screens registered), `src/screens/business/BusinessScreen.tsx`
(one additive "Payments" `ActionButton`) +
`__tests__/BusinessScreen.test.tsx` (one new assertion),
`src/screens/invoice/InvoiceListScreen.tsx` (picker mode + `customerId`
scoping) + `__tests__/InvoiceListScreen.test.tsx` (two new tests),
`src/screens/invoice/InvoiceDetailScreen.tsx` (payment summary section,
"Record payment" real navigation) + `__tests__/{InvoiceDetailScreen,
InvoiceDetailScreen.delete,InvoiceDetailScreen.duplicate}.test.tsx` (mocked
`usePaymentStore`; the first file's combined "coming soon" test split as
described above), `src/screens/customer/CustomerDetailScreen.tsx` ("Record
payment" now opens the invoice picker) +
`__tests__/CustomerDetailScreen.comingSoon.test.tsx` (rewritten assertion),
`MVP_BUILD_PLAN.md` (status header only).

### 8. Issues

None outstanding. One real, deterministic test-environment bug was found and
fixed during this phase (not shipped as a known limitation): see the
"Test-timing note, root-caused" entry under "Tests" above — a passive-effect
cleanup assertion timing issue in the new `InvoiceListScreen` scoping test,
fixed in the test (`act()` + `waitFor`), not in the production code, which
was correct from the start (confirmed with a temporary debug log before
concluding it was a test-only issue). Also caught and fixed before
considering the phase done: two `toHaveTextContent(...)` assertions in
`InvoiceDetailScreen.payments.test.tsx` needed to be regex
(`toHaveTextContent(/1000\.00/)`) instead of exact-string matches, since this
project's `toHaveTextContent` requires an exact match on plain strings — the
same lesson Phase 3 already documented for `toHaveTextContent('SKU')`. Full
suite re-run and green after both fixes (468/468, three consecutive runs).

**Next phase:** Phase 8 — Dashboard. Complete — see below.

---

## Phase 8 — Dashboard

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phases 1–7 was deleted or behaviorally
changed except the touch points listed below (all additive/upgraded, plus one
navigation default — see "What was built").

### What was built

- Dashboard functionality end-to-end on the frontend, backed by the real
  local SQLite database — same frontend-first sequencing as Phases 1–7:
  `InMemoryDashboardRepository` and `domain/dashboard/calculations.ts` were
  built and unit-tested first, then `SqliteDashboardRepository` was added
  behind the same `DashboardRepository` interface and wired in at the
  composition root (`src/data/container.ts`).
- **Total Sales, Paid, Outstanding, Overdue, invoice count, and recent
  invoices — every number calculated, none hard-coded.** Per the brief's
  explicit "create centralized dashboard calculation/query logic; do not use
  hard-coded dashboard numbers" instruction,
  `domain/dashboard/calculations.ts`'s `summarizeDashboard()` is the *only*
  place dashboard arithmetic exists — it never re-derives an invoice's own
  grand total or amount paid (those already came from the existing
  centralized `domain/invoice/calculations.ts` /
  `domain/payment/calculations.ts` modules by the time they reach it), it
  only *combines* them into the five figures plus the recent-invoices list.
  `DashboardScreen` and `dashboardStore` never sum an invoice or a payment
  themselves.
- **Outstanding/Overdue are each a sum of per-invoice remaining balances**
  (every one individually floored at 0 via the existing
  `domain/payment/calculations.ts#remainingBalance`), never a raw
  `totalSales - totalPaid` computed globally — the two only agree when no
  invoice is ever overpaid, and per `MVP_BUILD_PLAN.md` §6.3 overpayment is
  allowed (Phase 7), so an overpaid invoice's excess must never silently
  cancel out another invoice's genuine outstanding balance. This exact case
  is a dedicated test in `domain/dashboard/__tests__/calculations.test.ts`.
- **Optimized queries so the dashboard stays fast with many invoices — the
  brief's explicit "optimize queries" instruction.** `DashboardRepository` is
  deliberately narrower than `InvoiceRepository`/`PaymentRepository`: it
  returns one lightweight `DashboardInvoiceEntry` per invoice (id, number,
  customer name, dates, grand total, amount paid), never a full `Invoice`
  (with its line items) or raw `Payment` rows. `SqliteDashboardRepository`
  answers "what does the dashboard show" with **two grouped SQL aggregate
  queries** (`SUM(...) ... GROUP BY`, each backed by an existing index —
  `invoice_item_invoice_idx`, `payment_invoice_idx`) instead of
  `InvoiceRepository.list()`'s approach of loading every `invoice` row *and*
  every `invoice_item` row into JS and summing there. A business with
  thousands of invoices and tens of thousands of line items/payments still
  only round-trips one row per invoice across the JS/SQLite bridge, not one
  row per line item or payment. The two aggregate queries are kept
  deliberately separate (not one query joining both `invoice_item` and
  `payment`) because joining both onto `invoice` in a single query would fan
  out — an invoice with 3 line items and 2 payments would produce 6 joined
  rows — and silently overcount both sums; see the class's own doc comment.
- **Works offline, same as every other functionality in this codebase** —
  the dashboard reads only from local SQLite; no network call anywhere in
  this flow (see "Manual offline verification" below).
- **No charts, no trends, no accounting analytics** — per the brief's
  explicit exclusion. `DashboardSummaryCard` is a plain stat-tile grid
  (mirrors `CustomerSummaryCard`'s layout from Phase 5) and "Recent invoices"
  is a short, capped, non-virtualized list — nothing plots a value over time
  or computes a derived accounting metric (margin, growth rate, forecasts,
  etc.).
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screen → `dashboardStore`
  (Zustand) → `DashboardRepository` interface → SQLite (Drizzle) / in-memory
  implementation. The screen never imports the database, a concrete
  repository, or sums an invoice/payment directly.
- Reused rather than duplicated: `ActionButton`, `InvoiceStatusBadge`, the
  `colors` theme, the "stat tile" layout `CustomerSummaryCard` established,
  the "Create invoice"/"Record payment" quick-action flows already built on
  `InvoiceListScreen`/`CustomerDetailScreen` (seed `invoiceDraftStore` → open
  `CustomerList`/`InvoiceList` in picker mode), and `domain/invoice/status.ts`
  /`domain/payment/calculations.ts`'s existing centralized functions.
- **The Dashboard is now the app's initial route**, matching
  `MVP_BUILD_PLAN.md` §7's primary-navigation intent (Dashboard first, then
  Invoices/Customers/Business). `RootNavigator`'s `initialRouteName` changed
  from `DigitalCard` to `Dashboard` — the only behavioral change to existing
  navigation; no bottom tab bar was introduced (still out of this phase's
  scope — see "Known limitations"). Reachability of every existing screen is
  preserved: the Dashboard's own secondary row links to Invoices, Customers,
  and Business, and `BusinessScreen` gained one additive "Dashboard" button
  back, mirroring the reciprocal-link pattern every earlier phase used (e.g.
  Phase 7's "Payments" button on `BusinessScreen`).

### 1. Screen built (per the brief)

**Dashboard** — `src/screens/dashboard/DashboardScreen.tsx`. A single
`ScrollView` (recent invoices is capped at a handful of rows, so it's a plain
`.map()`, not a nested `FlatList` inside a scroll view of the same
orientation — see the screen's own doc comment):

- `DashboardSummaryCard` — Total Sales, Paid, Outstanding (emphasized when
  non-zero), Overdue (in the danger color when non-zero), and invoice count.
- Quick actions: **Create invoice** (seeds `invoiceDraftStore.startCreate()`
  then opens `CustomerList` in picker mode — identical to
  `InvoiceListScreen`/`CustomerDetailScreen`'s existing "Create invoice"
  flow), **Add customer** (`navigate('CreateCustomer')`), **Record payment**
  (opens `InvoiceList` in picker mode with no `customerId` — the same
  picker Phase 7 built for Customer Detail, just unscoped to one customer,
  since the Dashboard isn't tied to a single customer).
- A secondary row: **Invoices**, **Customers**, **Business** — direct links
  into the three other primary areas, preserving full app reachability now
  that Dashboard (not Digital Card) is the initial route.
- **Recent invoices** — up to `DEFAULT_RECENT_INVOICES_LIMIT` (5) rows,
  newest issue date first, via `RecentInvoiceRow` (mirrors
  `InvoiceListRow`'s layout against the lighter `DashboardRecentInvoice`
  shape); tapping one opens Invoice Detail. Empty state distinguishes "no
  invoices yet" from the loaded-with-data case.
- Loading/error states mirror every other screen in this codebase
  (`ActivityIndicator`, error text + "Try again").
- **Refreshes on every focus, not just on mount** — `navigation.addListener('focus', load)`
  alongside the mount-time `load()`. Every other screen in this codebase
  only reloads on mount, which is fine for screens re-reached by a fresh
  navigation push; the Dashboard is different because Record
  Payment/Invoice Review's existing `popToTop()`-then-navigate-forward
  pattern (Phases 6–7) pops back through the Dashboard (now the stack root)
  without unmounting it, so a mount-only `load()` would keep showing stale
  totals (e.g. yesterday's Outstanding figure) after recording a payment and
  navigating back here. This is the one new pattern this phase introduces
  and is exercised by its own test file (see "Tests" — split out to avoid
  the "overlapping act()" instability this codebase has already documented
  in Phases 1–3).

Supporting components (`src/components/dashboard/`): `DashboardSummaryCard`
(display-only, mirrors `CustomerSummaryCard`'s "never sums, only renders what
it's handed" tile grid) and `RecentInvoiceRow` (display-only, mirrors
`InvoiceListRow`).

**Navigation:** `RootStackParamList` gained `Dashboard: undefined`;
`RootNavigator` registers it and its `initialRouteName` changed from
`DigitalCard` to `Dashboard` (see "What was built"). `BusinessScreen` gained
one additive "Dashboard" `ActionButton`.

### 2. Backend files

No backend service was built — none is required (everything is local
SQLite, exactly like Phases 1–7). Documented future contract, per the "APIs
only where required" instruction:

- **Dashboard summary** — would be `GET /dashboard/summary` →
  `DashboardSummary` (`src/domain/dashboard/types.ts`: totalSales, totalPaid,
  totalOutstanding, totalOverdue, invoiceCount, recentInvoices[]). Would back
  a future `RemoteDashboardRepository` implementing today's
  `DashboardRepository` interface unchanged — the same "one interface, swap
  the implementation at `data/container.ts`" pattern every prior phase used.
- Not built now because nothing in Phase 8 needs network I/O.

### 3. Database changes

**None.** No new table, no new column — the Dashboard is answered entirely
from the existing `invoice`, `invoice_item`, and `payment` tables (Phases
1–7). No migration was generated this phase.

New repository, following the established three-file pattern:

- `DashboardRepository` interface (`src/data/dashboard/DashboardRepository.ts`):
  one method, `getInvoiceEntries()` → `DashboardInvoiceEntry[]` — see "What
  was built" for why it's this narrow.
- `InMemoryDashboardRepository` — mock/testing implementation; builds
  entries from plain `Invoice[]`/`Payment[]` arrays via the existing
  `sumInvoiceTotals`/`sumPayments` functions, so it can never disagree with
  the real implementation on a number for the same data.
- `SqliteDashboardRepository` — the real, optimized implementation (see
  "What was built"). No Jest coverage — Jest can't drive the native SQLite
  module without a device, same as every other `Sqlite*` repository in this
  codebase; its arithmetic is unit-tested once, in plain TypeScript, via
  `domain/dashboard/calculations.ts`, which `InMemoryDashboardRepository`
  also feeds directly.

### 4. Tests

493 Jest tests across 110 suites, all passing (`npx jest` / `npm test`, up
from Phase 7's 468 across 105 — run three times in a row to confirm
stability, all green); TypeScript strict-mode `tsc --noEmit` is clean; a full
Metro static export (`expo export --platform android`) bundles the whole app
(1504 modules, up from Phase 7's 1497) with no resolution errors.

- **Domain** (`domain/dashboard/__tests__/calculations.test.ts`): empty
  input → all zeros; sums total sales/paid/outstanding across several
  invoices; **an overpaid invoice's remaining is floored at 0 instead of
  cancelling out another invoice's genuine outstanding balance** (the
  dedicated "never a raw totalSales − totalPaid" regression test); only
  overdue invoices contribute to `totalOverdue`, using each one's own
  remaining balance, and a fully-paid invoice past its due date is correctly
  never counted (mirrors `computeInvoiceStatus`'s existing rule);
  `recentInvoices` ordering (newest issue date first, `createdAt` tiebreaker)
  and the configurable/default recent-limit cap, with `invoiceCount` never
  capped by that limit.
- **Repository** (`InMemoryDashboardRepository.test.ts`): empty list;
  computes grand total from line items and amount paid from the invoice's
  own payments (the brief's $1,000/$300+$200 shape); never mixes another
  invoice's payments into this invoice's amount paid; an invoice with no
  payments is `0`, not `undefined`; seed arrays aren't shared with the
  caller.
- **Store** (`dashboardStore.test.ts`): idle → ready with an empty summary;
  the brief's worked example end-to-end through the store; error state from
  a failing repository; recovery after a failure.
- **Screens** (`DashboardScreen.test.tsx` + `DashboardScreen.focus.test.tsx`,
  split for the "overlapping act()" reason noted above): empty summary +
  empty-state prompt; error state with retry; the worked example rendering
  correctly in the summary tiles and the recent-invoices list; tapping a
  recent invoice navigates to Invoice Detail; all three quick actions
  (Create invoice seeds the draft and opens the customer picker; Add
  customer navigates to Create Customer; Record payment opens the invoice
  picker unscoped to any customer); the Invoices/Customers/Business
  secondary links; the focus-listener registration (its own file).
  `BusinessScreen` gained one additive assertion for the new "Dashboard"
  button.
- **De-duplicated calculation, verified, not fixed (no bug found):** grepped
  `src/screens/dashboard` and `src/components/dashboard` for `.reduce`/manual
  summing over invoice or payment amounts — none found; every number comes
  from `summarizeDashboard()`.
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as Phases 1–7 (no device/emulator in this environment). Manual
  verification steps below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → it now opens directly on the Dashboard (no longer the
   Digital Business Card) — no network call anywhere in this flow.
3. With no invoices yet, confirm every figure reads 0.00/0 and "Recent
   invoices" shows "You haven't created any invoices yet."
4. Tap "Create invoice" → pick/create a customer → add a $1,000 line item →
   save → confirm the Dashboard now shows Total Sales $1,000.00, Paid $0.00,
   Outstanding $1,000.00, Overdue $0.00, invoice count 1, and the new invoice
   listed under Recent invoices.
5. Tap "Record payment" → pick that invoice → record $300, Cash → confirm
   Paid $300.00, Outstanding $700.00.
6. Record a second payment of $200 → confirm Paid $500.00, Outstanding
   $500.00 — the brief's exact worked example, now visible on the Dashboard.
7. Create a second invoice with a due date in the past and leave it unpaid →
   confirm Overdue now reflects that invoice's full remaining balance (added
   to Outstanding, not replacing it).
8. Tap "Add customer" → create one → confirm it lands back on the Dashboard.
9. Tap the recent invoice row → confirm it opens that invoice's Detail
   screen.
10. Tap "Invoices"/"Customers"/"Business" → confirm each opens the expected
    existing screen, and that Business → "Dashboard" returns here.
11. From Invoice Detail, tap "Record payment", save a payment, and confirm
    that after landing back on Invoice Detail, pressing back returns to the
    Dashboard **with the totals already refreshed** (not the pre-payment
    numbers) — this is the focus-refresh behavior this phase adds.
12. Close the app fully, reopen it (still offline) → confirm every figure
    matches what was left in step 6/7 (read back from SQLite, not memory).
13. Confirm Phases 1–7 screens (Digital Business Card, Business Profile,
    Invoice Settings, Invoice Type Selection, Items, Customers, Invoices,
    Payments) still work exactly as before.

This wasn't run against a physical device/emulator in this environment (none
is available here); the schema, repository, and offline-safe design were
verified as far as this environment allows (unit tests + strict typecheck +
full Metro bundle export), same as Phases 1–7.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as Phases 1–7.
- **No bottom tab bar** — `MVP_BUILD_PLAN.md` §7 describes bottom tabs
  (Dashboard, Invoices, Customers, Business); this phase makes Dashboard the
  initial route and gives it direct links to the other three areas, but the
  actual tab-bar navigator component was out of this phase's explicit scope
  ("implement PHASE 8 only: dashboard functionality") and wasn't introduced.
  Revisit as a dedicated navigation-polish pass if/when it's asked for.
- **Recent invoices is fixed at `DEFAULT_RECENT_INVOICES_LIMIT` (5), not
  user-configurable** — matches the brief's plain "recent invoices" wording;
  Invoice List already exists for anything beyond a glance.
- **No pagination/virtualization tuning beyond a fixed-size list** — moot
  here since `recentInvoices` is capped at 5 by `summarizeDashboard()`
  itself; the aggregate totals are what the "optimize queries" work targets
  (see "What was built"), not the recent list's row count.
- **`SqliteDashboardRepository` still scans every invoice/payment row once**
  to compute the aggregate totals (there's no way to get "total sales across
  all invoices" without summing all invoices) — the optimization this phase
  makes is doing that summing in SQL (`SUM ... GROUP BY`, two queries total)
  instead of transferring every line-item/payment row across the JS/SQLite
  bridge and reducing in JS, not eliminating the need to look at every
  invoice at least once. Fine at the data volumes a small-business, single-
  device, offline app realistically has, and meaningfully cheaper than
  before at any volume.
- **No explicit SQL transaction/caching layer** — consistent with every
  other `Sqlite*` repository in this codebase; the Dashboard also has no
  push-based cache invalidation, relying instead on `load()` at mount and on
  every focus (see "What was built").
- **No currency symbol formatting** — plain `.toFixed(2)` numbers, matching
  every other money figure in this codebase (`PaymentSummaryCard`,
  `CustomerSummaryCard`, `InvoiceListRow`, etc.).

### 7. Files modified

New files: `src/domain/dashboard/{types,calculations}.ts` +
`__tests__/calculations.test.ts`,
`src/data/dashboard/{DashboardRepository,InMemoryDashboardRepository,
SqliteDashboardRepository}.ts` + `__tests__/InMemoryDashboardRepository.test.ts`,
`src/state/dashboardStore.ts` + `__tests__/dashboardStore.test.ts`,
`src/components/dashboard/{DashboardSummaryCard,RecentInvoiceRow}.tsx`,
`src/screens/dashboard/DashboardScreen.tsx` +
`__tests__/{DashboardScreen,DashboardScreen.focus}.test.tsx`.

Modified files: `src/data/container.ts` (`getDashboardRepository()`),
`src/navigation/types.ts` (`Dashboard` route + a doc-comment note on
`InvoiceList`'s picker mode), `src/navigation/RootNavigator.tsx` (`Dashboard`
screen registered, `initialRouteName` changed from `DigitalCard` to
`Dashboard`), `src/screens/business/BusinessScreen.tsx` (one additive
"Dashboard" `ActionButton`) + `__tests__/BusinessScreen.test.tsx` (one new
assertion), `MVP_BUILD_PLAN.md` (status header only).

### 8. Issues

None outstanding. One environment-specific pitfall was hit and resolved
while writing this phase's screen tests (not a production bug): the
installed `@testing-library/react-native` (14.0.1) has an **async** `render()`
— every call must be `await`ed to get the query-bound result object, or the
returned (unresolved) Promise silently lacks `getByTestId`/etc. and every
query throws "is not a function". Fixed by awaiting every `render()` call in
the new test files (all pre-existing test files in this codebase already did
this correctly). Also re-encountered the "overlapping act()" instability
Phases 1–3 already documented: the new focus-listener test was flaky when
run alongside `DashboardScreen.test.tsx`'s other render-heavy tests in the
same file, fixed the same way Phase 1–3 fixed it — split into its own file
(`DashboardScreen.focus.test.tsx`). Full suite re-run three times after both
fixes, green each time (520/520).

**Next phase:** Phase 9 — PDF and Sharing. Complete — see below.

---

## Phase 9 — PDF and Sharing

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phases 1–8 was deleted or behaviorally
changed except the touch points listed below (all additive/upgraded — one
existing action button's behavior was upgraded from a "coming soon" alert to
real navigation, the same kind of upgrade every prior phase made to its own
predecessor's placeholder).

### What was built

- Invoice PDF generation + sharing end-to-end, entirely on-device: HTML
  templating is pure TypeScript (frontend-first, exactly like every prior
  phase's mock-then-real sequencing, except here the "mock" and the "real"
  domain logic are the same code — there's no server-side equivalent to
  swap in), and the one native step (`expo-print` rendering that HTML to a
  PDF file) is isolated behind a `PdfService` interface with a `FakePdfService`
  Jest double, the same "interface + in-memory double, real implementation
  gets no Jest coverage" pattern every `Sqlite*Repository` in this codebase
  already follows.
- **PDF generation uses the invoice's own frozen `InvoiceItemSnapshot[]`,
  never the live `Item`/`Customer` catalog rows** — per the explicit "PDF
  generation must use historical InvoiceItem snapshot data" instruction and
  `MVP_BUILD_PLAN.md` §6.2. `buildInvoicePdfData()` passes `invoice.items`
  straight through (a dedicated test asserts referential equality, not just
  a deep-equal, to prove nothing re-derives or re-fetches it), and the
  customer section falls back to the invoice's own `customerName` snapshot
  (the same `customerFromInvoiceSnapshot` reasoning `InvoiceDetailScreen`
  already established in Phase 6) if the contact was since deleted.
- **Works fully offline, with no backend dependency.** `expo-print`'s
  `printToFileAsync` renders the given HTML entirely on-device; the business
  logo is read from local storage and embedded as a base64 `data:` URI
  (`resolveLogoDataUri`, via `expo-file-system`) rather than referenced as a
  bare `file://` path, so PDF generation never depends on the print engine
  being able to resolve a local path and never makes a network call. No
  screen, store, or service in this phase's code path calls `fetch`/an HTTP
  client. The one explicit exception, by design and out of scope per the
  brief: actually *transmitting* a WhatsApp message or email obviously needs
  connectivity once the user hits send in that native app — exactly like
  Phase 1's `openWhatsApp`/`openEmail` helpers already did, not a new
  backend dependency this phase introduces.
- **Sharing uses native mobile sharing capabilities, not custom
  infrastructure.** "Share PDF" opens the OS's own share sheet
  (`expo-sharing`), which is how WhatsApp/Mail/Drive/etc. actually appear as
  targets on a real device; "Share via Email" opens the native mail
  composer (`expo-mail-composer`) with the PDF attached; "Share via
  WhatsApp" opens a `wa.me`/`whatsapp://` deep link (the same mechanism
  `lib/linking.ts`'s existing `openWhatsApp` helper already uses for the
  Digital Business Card); "Share link" reuses the core React Native `Share`
  API, mirroring `ShareCardScreen` (Phase 1) exactly.
- **No complex online payment links** — per the explicit instruction, none
  of the five sharing actions above touch payments; "Share link" is a local
  `invora://invoice/<id>` deep link (see `LocalInvoiceShareLinkService`
  below), not a hosted payment page.
- **No hosted redirect service was built for share links**, resolving
  `MVP_BUILD_PLAN.md` §10's "server-hosted share links... to confirm before
  Phase 9" open decision the way Phase 1 already resolved it for the
  Digital Business Card: `LocalInvoiceShareLinkService` builds an
  `invora://invoice/<id>` deep link via `expo-linking`, exactly mirroring
  Phase 1's `LocalShareLinkService`. A future `RemoteInvoiceShareLinkService`
  implementing the same `InvoiceShareLinkService` interface remains a
  one-line swap at `data/container.ts` if a hosted service is ever
  confirmed — no screen or store change.
- **Three initial invoice templates — Classic, Modern, Compact** (per the
  brief's exact naming). This is a rename, not a new feature: Phase 2 had
  already built a `defaultInvoiceTemplate` selection
  (Classic/Modern/**Minimal**) with no rendering behind it yet ("stored
  selection only" was explicitly called out as a Phase 2 known limitation,
  to be resolved in Phase 9). This phase renames the third option to
  **Compact** everywhere (`domain/business/types.ts`'s `InvoiceTemplate`
  union and `INVOICE_TEMPLATE_OPTIONS` label, the Zod enum, the schema's
  Drizzle-level enum annotation) and gives it — and the other two — real
  HTML rendering for the first time via `renderInvoiceHtml()`. **No
  migration was needed**: the `enum` on `default_invoice_template` is a
  Drizzle/TypeScript-level annotation only, the column itself is plain
  SQLite `TEXT`. A pre-Phase-9 install that already saved `'minimal'` is
  normalized to `'compact'` on read (`SqliteBusinessRepository`'s
  `toInvoiceTemplate()`) instead of requiring a migration or silently
  breaking — the same "tolerate a legacy persisted value" care Phase 3
  already took for `custom_invoice_fields`.
- **One shared HTML document/CSS structure serves all three templates**
  (`renderInvoiceHtml.ts`), styled via a `tpl-classic`/`tpl-modern`/
  `tpl-compact` class and that template's own CSS block, instead of three
  near-duplicate HTML builders — per the "no duplicate models/calculations"
  code-quality rule. Classic is a plain bordered black-and-white layout,
  Modern adds a colored header band and accent-colored totals, Compact
  tightens every spacing/font-size value for a denser, shorter document.
  Every template still shows the exact same *content* (see the PDF-content
  checklist below) — only the visual treatment differs.
- **Every PDF-content field the brief lists is rendered**, and only the
  ones that actually apply to a given invoice: business info + logo,
  customer, invoice number, issue date, due date, items (item name,
  quantity, unit, weight, dimensions, price, discount, tax), totals, paid,
  remaining (or a distinct "Overpaid" line — never a negative remaining,
  the same rule `PaymentSummaryCard` already established in Phase 7), notes,
  and terms. "Weight when applicable" / "Dimensions when applicable" is
  driven by the same `resolveInvoiceFieldConfig()` registry Phase 3 already
  built for invoice-entry screens (`getPdfItemColumns()`, Phase 9's own new
  function) — a Weight/Length/Width/Height column is rendered only when
  that invoice's own field set actually includes it, never hard-coded per
  invoice type. `Description` renders as a sub-line under the item name
  (a real invoice's usual layout) rather than its own column; `Total` is
  always appended last — neither is a selectable field in the Phase 3
  catalog, both are structural to every line.
- **The in-app "PDF Preview" screen is a real, functioning preview, not a
  re-implementation of a PDF renderer.** It shows the exact same
  `InvoicePdfData` the real PDF is built from — reusing `InvoiceTotalsSummary`
  and `PaymentSummaryCard` verbatim (Phase 6/7 components; both already
  "never sum, only render what they're handed", so there's no second totals
  calculation for the PDF path) plus a new `PdfLineItemRow` driven by the
  same resolved column list `renderInvoiceHtml()` uses — so the preview can
  never show a field the generated PDF wouldn't. It does *not* attempt to
  pixel-match each template's PDF styling (no `react-native-webview`/PDF-
  rendering dependency was added, per "no unnecessary packages" — see Known
  limitations); a "Preview PDF" button additionally opens the OS's own
  native print/preview UI (`expo-print`'s `printAsync({ uri })`) showing the
  *exact* rendered file, with the OS's own Share/Print actions available
  from inside it.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screen → `pdfStore`
  (Zustand) → `PdfService`/`InvoiceShareLinkService` interfaces (+ the
  existing `InvoiceRepository`/`CustomerRepository`/`BusinessRepository`/
  `PaymentRepository`) → `expo-print`/`expo-sharing`/`expo-mail-composer` /
  SQLite. The screen never imports a native module, a concrete repository,
  or renders HTML itself.
- Reused rather than duplicated: `ActionButton`, `OptionPicker` (the
  template picker), `InvoiceTotalsSummary`, `PaymentSummaryCard`, the
  `colors` theme, `computeInvoiceStatus`/`sumInvoiceTotals`/`sumPayments`/
  `summarizeInvoicePayments` (all pre-existing centralized calculations —
  this phase adds zero new arithmetic, only formatting/rendering), the
  Phase 3 `resolveInvoiceFieldConfig` registry, and `expo-linking`'s
  `createURL()` pattern from Phase 1's `LocalShareLinkService`.

### 1. Screen built (per the brief)

**Invoice PDF Preview** — `src/screens/pdf/InvoicePdfPreviewScreen.tsx`.
Reached from Invoice Detail's "Share / PDF" action (previously a "coming
soon" alert — the one behavior upgrade this phase makes to an existing
screen, exactly the kind of upgrade every prior phase made to its own
predecessor's placeholder, e.g. Phase 7 upgrading "Record payment").
Folds the brief's "Invoice PDF Preview" and "Invoice Sharing" screens into
one (the same "reuse over near-duplicate screens" reasoning Phase 6/7 used
for their own named-screen consolidations):

- A template picker (`OptionPicker`, Classic/Modern/Compact) — switching
  regenerates the PDF file immediately so every action below always shares
  the currently-selected template.
- The in-app preview: business header + logo, customer, invoice
  number/date/due date/status, the items table (via `PdfLineItemRow`,
  driven by the resolved field columns), `InvoiceTotalsSummary`,
  `PaymentSummaryCard`, and notes/terms cards.
- Five actions: **Preview PDF** (native print/preview UI), **Share PDF**
  (native share sheet), **Share via WhatsApp**, **Share via Email** (hidden
  when no mail app is configured — checked via `isEmailAvailable()` rather
  than showing a dead-end button), **Share link**.
- Loading/not-found/error states mirror every other detail-style screen in
  this codebase (`ActivityIndicator`, "Go back" on failure).

### 2. Backend files

No backend service was built — none is required (everything is local:
HTML generation, PDF rendering, and every share action all happen
on-device). Documented future contract, per the "APIs only where required"
instruction and per this phase's explicit "do not make PDF generation
dependent on your backend":

- **Invoice share-link resolution** — if `MVP_BUILD_PLAN.md`'s "server-hosted
  share links" open decision is ever confirmed, it would be
  `POST /invoices/:id/share-link` → `{url}` and `GET /share/invoice/:token`
  → a hosted invoice-view/PDF-download page, behind a future
  `RemoteInvoiceShareLinkService` implementing today's
  `InvoiceShareLinkService` interface unchanged. Not built now because
  nothing in Phase 9 needs it — sharing is fully local (see "What was
  built").

### 3. Database changes

**None.** No new table, no new column. The one schema-adjacent change is a
rename, not a shape change: `business.default_invoice_template`'s Drizzle
`enum` annotation changed from `['classic','modern','minimal']` to
`['classic','modern','compact']` — this is a TypeScript-level annotation
only (the SQLite column is plain `TEXT`), so no migration was generated.
A pre-existing `'minimal'` value already saved on a device is normalized to
`'compact'` on read (see "What was built" above) rather than requiring a
migration or crashing on an unrecognized value.

### 4. New modules

**Domain** (`src/domain/pdf/`) — pure TypeScript, no React/DB/network,
fully unit-tested without a device (unlike every `Sqlite*Repository` in
this codebase, HTML-string generation has no native dependency, so it gets
full Jest coverage):

- `types.ts` — `InvoicePdfData` (and its narrower `InvoicePdfBusiness`/
  `InvoicePdfCustomer` views), the one shape every template-rendering path
  consumes.
- `buildInvoicePdfData.ts` — assembles an `InvoicePdfData` from an invoice
  (with its frozen items), its totals, its payments, the business profile,
  the customer, a resolved field config, and a pre-resolved logo data URI.
  Delegates to the existing `summarizeInvoicePayments`/`INVOICE_STATUS_LABELS`
  rather than re-deriving anything.
- `itemColumns.ts` — `getPdfItemColumns(fieldConfig)`: turns a resolved
  `InvoiceFieldConfig` into the concrete, ordered list of PDF table columns
  — the "Weight/Dimensions when applicable" logic (see "What was built").
- `renderInvoiceHtml.ts` — the one place invoice-PDF HTML is generated (see
  "What was built" for the shared-structure-per-template design).
- `escapeHtml.ts` — HTML-escapes every user-entered field before
  interpolation (business/customer/item names, notes, terms, ...) so a
  value containing `<`/`&`/etc. can never corrupt the generated markup.
- `money.ts` — `formatMoney()`, a plain `"USD 1,000.00"`-style formatter
  (not `Intl.NumberFormat`, for the same "don't depend on the runtime's ICU
  locale data" reasoning already documented for every other money figure in
  this codebase — see Phase 8's "no currency symbol formatting" known
  limitation, which this phase resolves for the PDF specifically, though
  not for every in-app screen — see Known limitations).

**Data/services** (`src/data/pdf/`, `src/data/shareLink/`):

- `PdfService` interface + `ExpoPdfService` (real, `expo-print`/
  `expo-sharing`/`expo-mail-composer`-backed — no Jest coverage, same as
  every `Sqlite*Repository`) + `FakePdfService` (the Jest-safe double every
  store/screen test injects — records every call instead of touching a
  native module).
- `InvoiceShareLinkService` interface + `LocalInvoiceShareLinkService` (see
  "What was built").
- `src/lib/fileToDataUri.ts` — `resolveLogoDataUri()`, reads a local logo
  file via `expo-file-system` and returns a base64 `data:` URI, or `null`
  on any failure (missing file, no logo set, unreadable) — never throws,
  so a broken logo path can never block PDF generation.

**State** (`src/state/pdfStore.ts`) — `createPdfStore(overrides)` +
`usePdfStore`, following the exact "dependencies resolved lazily, tests
inject via the factory" pattern every other store in this codebase uses.
Assembles an invoice's `InvoicePdfData` from the existing `InvoiceRepository`/
`CustomerRepository`/`BusinessRepository`/`PaymentRepository`, renders it
via `renderInvoiceHtml`, and generates/regenerates the PDF file via
`PdfService` whenever the invoice loads or the template changes. Exposes
`previewPdf`/`sharePdf`/`shareViaEmail`/`shareViaWhatsApp`/`shareLink`/
`getShareLink`/`isEmailAvailable`. Note: the field config used for
rendering follows the invoice's own fixed `invoiceTypeId` plus the
business's *current* custom-field selection — the exact same lookup
`CreateInvoiceItemsScreen` (Phase 6) already uses to redraw an existing
invoice's line fields; a custom field selection isn't itself snapshotted
per invoice today (a pre-existing characteristic of this codebase, not a
new limitation introduced here — see Known limitations).

**Components** (`src/components/pdf/PdfLineItemRow.tsx`) — one line of the
in-app preview's item table, rendering exactly the columns
`getPdfItemColumns()` resolved.

### 5. Tests

527 Jest tests across 118 suites, all passing (`npx jest` / `npm test`, up
from Phase 8's 493 across 110); TypeScript strict-mode `tsc --noEmit` is
clean; a full Metro static export (`expo export --platform android`)
bundles the whole app (1529 modules, up from Phase 8's 1504) with no
resolution errors.

- **Domain** (`src/domain/pdf/__tests__/`): `escapeHtml.test.ts` (every
  HTML-significant character, newline-to-`<br>`), `money.test.ts`
  (formatting, thousands grouping, zero, negative amounts),
  `itemColumns.test.ts` (Item/Unit price/Total always present; Weight only
  appears for a Weight-type invoice; Length/Width/Height only for
  Dimension; a Custom selection only shows the subset it actually picked;
  each column's `render()` against a real item snapshot),
  `buildInvoicePdfData.test.ts` (**the brief's worked example** — $1,000
  invoice, $300 + $200 paid ⇒ $500 remaining — a business-profile-missing/
  customer-deleted fallback case, and a referential-equality check proving
  `invoice.items` passes through untouched, per the historical-snapshot
  requirement), `renderInvoiceHtml.test.ts` (every required content field
  present for the Classic template including an HTML-escaped business/
  customer name; the Overpaid-not-negative-Remaining case; the logo `<img>`
  only rendering when a data URI is provided; a genuinely distinct
  style block per template).
- **Services**: `LocalInvoiceShareLinkService.test.ts` (mirrors Phase 1's
  `LocalShareLinkService.test.ts` — builds from the invoice id via
  `expo-linking`, never a hard-coded `https://` URL). `ExpoPdfService`/
  `FakePdfService` have no dedicated test file — the fake's correctness is
  exercised indirectly through every `pdfStore`/screen test that uses it,
  and the real implementation gets no Jest coverage for the same reason
  every `Sqlite*Repository` doesn't (native module, no device in this
  environment).
- **Store** (`pdfStore.test.ts`): loads an invoice and generates a PDF
  using the business's own default template; `not-found` for a missing
  invoice; regenerating the PDF on a template switch; **the brief's worked
  example** end-to-end through the store; `previewPdf`/`sharePdf`
  delegating to the injected `PdfService` with the actually-generated file
  URI; `shareViaEmail` attaching the PDF and addressing the customer's own
  email; `shareViaWhatsApp` building a `wa.me` link addressed to the
  customer's own number with a summary message; `shareLink` sharing the
  plain-text share link via the injected `shareText` function.
- **Screen** (`InvoicePdfPreviewScreen.test.tsx`): not-found state;
  business/customer/items/totals/notes/terms all rendering; picking a
  different template regenerates the PDF (asserted via the injected
  `FakePdfService`'s call count); "Preview PDF" and "Share PDF" each
  delegate to the injected service.
- **Existing-suite regression check**: `InvoiceDetailScreen.test.tsx`'s one
  "still shows coming soon for Share/PDF" test (written in Phase 6/7,
  explicitly expected to be replaced once this phase shipped) was rewritten
  to assert the real `navigation.navigate('InvoicePdfPreview', { invoiceId })`
  call instead — the exact "coming-soon assertion gets replaced, not
  deleted-and-forgotten" pattern Phase 6/7 already established for their
  own upgrades. Every other Phase 1–8 test file and assertion is untouched;
  the full suite was re-run after this phase's changes and is green.
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as Phases 1–8 (no device/emulator in this environment). Manual
  verification steps below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open an existing invoice with at least one line item → Invoice Detail →
   tap "Share / PDF" → the Invoice PDF Preview screen opens showing the
   business header (+ logo, if one is set), customer, invoice number/date,
   items, totals, payment summary, and notes/terms — no network call
   anywhere in this flow.
3. Switch the template between Classic/Modern/Compact → confirm the PDF
   regenerates each time (no visible error) — the in-app preview's content
   doesn't change (it's template-structure-agnostic, see Known
   limitations) but the underlying file does.
4. Tap "Preview PDF" → confirm the OS's own native print/preview UI opens
   showing the actual rendered PDF, with the chosen template's visual style
   (bordered black-and-white for Classic, a colored header band for
   Modern, a dense single-page layout for Compact) — still fully offline.
5. Tap "Share PDF" → confirm the native OS share sheet opens with the PDF
   file attached, listing WhatsApp/Mail/Drive/etc. as targets (whichever
   are installed) — this step alone needs no network to *open*; actually
   sending through a chosen app does, exactly like sending any message.
6. Tap "Share via Email" (only shown if a mail app is configured) → confirm
   the native mail composer opens with the PDF attached, the subject
   pre-filled with the invoice number, and the recipient pre-filled from
   the customer's own email (when set).
7. Tap "Share via WhatsApp" → confirm WhatsApp opens (if installed) with a
   pre-filled text message containing the invoice number, total, and
   remaining balance, addressed to the customer's own number when known.
8. Tap "Share link" → confirm the native `Share.share` sheet opens with the
   local `invora://invoice/<id>` deep link as plain text — never an
   `https://` production URL that doesn't exist.
9. Change the invoice's item weight/dimension fields (create a Weight- or
   Dimension-type invoice) → confirm those columns appear in both the
   in-app preview and the generated PDF only for that invoice, not for a
   plain General-type invoice ("when applicable").
10. Record a partial payment against the invoice, reopen Invoice PDF
    Preview → confirm Paid/Remaining reflect it; overpay it → confirm the
    PDF shows "Overpaid", never a negative Remaining.
11. Close the app fully, reopen it (still offline) → repeat step 2 to
    confirm nothing in this flow ever depended on a live network
    connection or a backend call.
12. Confirm Phases 1–8 screens still work exactly as before.

This wasn't run against a physical device/emulator in this environment
(none is available here); the domain logic, service boundary, and
offline-safe design were verified as far as this environment allows (unit
tests + strict typecheck + full Metro bundle export), same as every prior
phase.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as Phases 1–8.
  `expo-print`/`expo-sharing`/`expo-mail-composer`/`expo-file-system`'s
  actual native behavior (real PDF rendering, the real share sheet, the
  real mail composer, real base64 file reads) has not been exercised on a
  physical device — only the pure HTML-generation/data-assembly logic
  feeding into them is unit-tested, exactly like every `Sqlite*Repository`
  in this codebase already documents.
- **The in-app preview doesn't pixel-match each template's PDF styling** —
  it shows the same *content* (reusing `InvoiceTotalsSummary`/
  `PaymentSummaryCard`/`PdfLineItemRow`) regardless of which template is
  selected; only the actually-generated PDF (viewed via "Preview PDF" or
  after sharing) shows Classic/Modern/Compact's distinct visual treatment.
  Adding a true pixel-accurate in-app preview would need a PDF-rendering
  dependency (e.g. `react-native-webview` pointed at the generated file, or
  a PDF-to-image renderer) not currently in the approved stack, per "no
  unnecessary packages" — revisit only if a WYSIWYG in-app preview is
  explicitly requested.
- **WhatsApp sharing is a text summary + link, not a file attachment** —
  Expo's managed workflow has no API to hand a specific file to a specific
  app via a URL scheme; "Share via WhatsApp" opens a `wa.me`/`whatsapp://`
  deep link with a pre-filled text message (invoice number, total,
  remaining balance, and the share link) instead. Attaching the actual PDF
  to a WhatsApp message goes through the generic "Share PDF" native share
  sheet, picking WhatsApp there (which does support document attachments
  through the OS's own share mechanism) — these are two distinct, real
  actions, not a duplicate of each other.
- **The custom invoice-type field selection isn't itself snapshotted per
  invoice** — `pdfStore` resolves a "custom"-type invoice's PDF columns
  from the business's *current* custom-field selection
  (`BusinessRepository.getInvoiceTypeSelection()`), the exact same lookup
  `CreateInvoiceItemsScreen` (Phase 6) already uses to redraw an existing
  invoice's line-entry fields. This is a pre-existing characteristic of
  this codebase (not introduced by this phase): if the business later
  changes its Custom field selection, older Custom-type invoices' PDFs
  will follow the new selection rather than what was chosen when they were
  created. `itemName`/`unitPrice`/`discount`/`tax`/etc. *values* on each
  line are still the frozen historical snapshot either way — only which
  *columns* are displayed could drift. Revisit only if per-invoice custom
  field snapshotting is explicitly requested.
- **`formatMoney()`'s currency-code-prefixed formatting is used only for
  the PDF** (and its in-app preview) — every other in-app money figure
  (Invoice Detail, Payment History, Dashboard, ...) still uses the plain
  `.toFixed(2)` every prior phase already used (Phase 8's "no currency
  symbol formatting" known limitation). Extending currency-aware formatting
  app-wide was out of this phase's scope.
- **No PDF file-size/page-count limits or multi-page layout tuning** — for
  an invoice with a very large number of line items, `expo-print` paginates
  automatically (standard HTML print pagination), but no template
  specifically optimizes for many lines beyond Compact's smaller
  spacing/font sizes.
- **Generated PDF files are written to `expo-print`'s own temp/cache
  location** (whatever `printToFileAsync` returns) — there is no dedicated
  "Invoices" folder, retention policy, or cleanup of previously-generated
  files; each Share/Preview/Email action operates on the most recently
  generated file for the currently-open invoice. Revisit if a persistent,
  user-browsable "generated PDFs" list is ever requested (that would be
  closer to Phase 10/11 (Settings/Backup) territory than Phase 9's scope).

### 7. Files modified

New files: `src/domain/pdf/{types,buildInvoicePdfData,itemColumns,
renderInvoiceHtml,escapeHtml,money}.ts` + `__tests__/{buildInvoicePdfData,
itemColumns,renderInvoiceHtml,escapeHtml,money}.test.ts`,
`src/data/pdf/{PdfService,ExpoPdfService,FakePdfService}.ts`,
`src/data/shareLink/{InvoiceShareLinkService,LocalInvoiceShareLinkService}.ts`
+ `__tests__/LocalInvoiceShareLinkService.test.ts`, `src/lib/fileToDataUri.ts`,
`src/state/pdfStore.ts` + `__tests__/pdfStore.test.ts`,
`src/components/pdf/PdfLineItemRow.tsx`,
`src/screens/pdf/InvoicePdfPreviewScreen.tsx` +
`__tests__/InvoicePdfPreviewScreen.test.tsx`.

Modified files: `package.json`/`package-lock.json` (added `expo-print`,
`expo-mail-composer`, and an explicit direct dependency on the
already-transitively-installed `expo-file-system`), `app.json` (registered
the `expo-mail-composer` config plugin, needed only for a future native/EAS
build — no effect on Expo Go), `src/domain/business/types.ts`
(`InvoiceTemplate`'s third option renamed `'minimal'` → `'compact'`,
`INVOICE_TEMPLATE_OPTIONS` label updated), `src/domain/business/validation.ts`
(Zod enum updated to match), `src/data/db/schema.ts` (the same rename in
the Drizzle `enum` annotation, plus a doc comment explaining no migration
is needed), `src/data/business/SqliteBusinessRepository.ts`
(`toInvoiceTemplate()` normalizes a legacy `'minimal'` value on read),
`src/data/container.ts` (`getInvoiceShareLinkService()`, `getPdfService()`),
`src/navigation/types.ts` (`InvoicePdfPreview` route),
`src/navigation/RootNavigator.tsx` (screen registered),
`src/screens/invoice/InvoiceDetailScreen.tsx` ("Share / PDF" now navigates
for real; the now-unused `notBuiltYet()` helper was removed) +
`__tests__/InvoiceDetailScreen.test.tsx` (the "coming soon" test rewritten
to assert real navigation), `MVP_BUILD_PLAN.md` (status header only).

### 8. Issues

None outstanding.

**Next phase:** Phase 10 — Settings. Complete — see below.

---

## Phase 10 — Settings

**Status:** Complete for the scope defined below. Built on explicit
instruction, scoped to exactly the four related screens named in the brief
(Settings, Invoice Templates, Security, Account/Subscription placeholder) and
the five settings groups (Business, Invoice, Backup, Security, Account).
Working tree was re-inspected first (see the file lists at the top of this
document); nothing in Phases 1–9 was deleted or behaviorally changed except
the additive navigation touch points listed below.

### What was built

- A **Settings hub** that routes into screens Phases 1–3/9 already built,
  per "use the existing architecture" — no business-profile, invoice-prefix,
  currency, tax, or payment-terms field is re-implemented a second time.
  Four of the Invoice section's six named items (Invoice Numbering,
  Currency, Tax, Payment Terms) intentionally land on the same
  `InvoiceSettingsScreen` (Phase 2) that already edits all four together —
  see the doc comment on `SettingsScreen` for why four near-duplicate
  single-field screens would violate "no duplicate models/screens" for no
  real benefit, while every field the brief names is still one tap away.
- **A dedicated Invoice Templates screen** (Classic/Modern/Compact, each
  with a short, accurate description of what `renderInvoiceHtml()` (Phase 9)
  actually renders) — the same "two entry points, one source of truth"
  convention Phase 3 established for Invoice Type: `InvoiceSettingsScreen`'s
  existing template chip-picker still works exactly as before, and both
  write the same `defaultInvoiceTemplate` column via the same
  `BusinessRepository.saveInvoiceSettings()`. No second repository method or
  store was added for this — `settingsWithTemplate()` (a new pure function in
  `domain/business/formMapping.ts`) merges the chosen template into the
  *current* invoice settings (or the empty-state defaults, if nothing was
  ever saved) so the screen can save just the one field it owns without
  touching prefix/numbering/currency/tax/terms.
- **A real App Lock / Biometric Unlock feature**, not just a stored
  preference — per the brief's explicit "Security: App Lock, Biometric
  Unlock where supported" (this is real functionality the brief asked for,
  unlike the account/payment features it explicitly said not to build).
  `AppLockGate` wraps the whole app (`App.tsx`) and shows a full-screen lock
  prompt instead of the app's content on first launch and every time the app
  returns to the foreground after being backgrounded, whenever App Lock is
  on. Authentication goes through the device's own OS-native biometric/
  passcode prompt via the new `expo-local-authentication` dependency — no
  custom PIN-entry screen or app-level password was built, per "do not
  implement unnecessary account features" and because the OS prompt already
  supports a device-passcode fallback with no account/password-reset system
  needed behind it (see `ExpoBiometricService`'s doc comment on
  `disableDeviceFallback`).
- **"Biometric Unlock" is a distinct, real behavioral toggle, not just
  cosmetic labelling of App Lock.** `expo-local-authentication`'s
  `authenticateAsync()` always tries biometrics first when available with no
  way to force "passcode-only" — so instead of pretending to gate *which*
  credential the OS accepts, the toggle controls *whether the lock screen
  auto-prompts* the OS's biometric/passcode UI the instant it appears
  (Biometric Unlock on + supported) versus waiting for the user to tap a
  manual "Unlock" button (off, or unsupported) — both paths call the exact
  same `BiometricService.authenticate()`, so a device with no biometrics
  enrolled still unlocks via its passcode either way. This interpretation is
  documented explicitly (see the doc comment on `AppLockGate` and "Known
  limitations" below) rather than left implicit, the same way Phase 3
  documented its "Item Name/Unit Price can't be unchecked" interpretation.
- **Never locks a user out of their own offline data.** There is no backend,
  account, or password-reset system behind App Lock (per
  `MVP_BUILD_PLAN.md` §4 — everything is local), so `ExpoBiometricService`
  always leaves the OS's device-passcode fallback enabled
  (`disableDeviceFallback: false`), and a failed/cancelled authentication
  attempt simply leaves the app locked with the same "Unlock" button
  available again — never a lockout, retry limit, or wipe.
- **`AppLockGate` never re-locks a screen the user is already on.**
  `appLockStore`'s `applyInitialState()` only sets the starting
  locked/unlocked state once (guarded by `hasInitialized`); saving a new App
  Lock setting from the Security screen (which is only reachable once
  already unlocked) updates `securityStore`'s `settings` without yanking the
  user back to a lock screen mid-edit. The next background→foreground
  transition is what actually applies a newly-turned-on App Lock.
- **An honest Account/Subscription placeholder**, per the explicit
  "RELATED SCREENS: ... Account/Subscription placeholder" and "do not
  implement unnecessary account features" / "do not implement payment
  processing" instructions. Invora has no cloud account, login, or checkout
  system, so `AccountScreen` says exactly that instead of faking a sign-in
  flow — "Logout" is a real, working button (per the brief naming it) that
  honestly reports there's nothing to log out of, rather than a silent
  no-op or a hidden dead end.
- **Backup & Restore is a Settings row, not a fifth built screen** — the
  brief's four "RELATED SCREENS" don't include one, and real Google Drive
  backup is explicitly Phase 11 scope (`MVP_BUILD_PLAN.md` §9). Tapping it
  shows an alert naming that plainly instead of a dead link or a
  half-built feature.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens → `securityStore`
  / `appLockStore` (Zustand) → `SecurityRepository` / `BiometricService`
  interfaces → SQLite (Drizzle) / `expo-local-authentication` /
  in-memory-and-fake implementations. Screens never import the database, a
  concrete repository, or `expo-local-authentication` directly.
- Reused rather than duplicated: `SettingsRow`, `ActionButton`,
  `FieldToggleRow` (extended with an optional `disabledHint` prop, default
  unchanged, so Phase 3's Custom Invoice Type builder is unaffected), the
  `colors` theme, `INVOICE_TEMPLATE_OPTIONS` (extended with a `description`
  field the existing chip-picker simply ignores), and the
  `invoiceSettingsStore`/`BusinessRepository` plumbing Phase 2 already built.

### 1. Screens built (per the brief's four "RELATED SCREENS")

1. **Settings** — `src/screens/settings/SettingsScreen.tsx`. The hub:
   Business (Business Profile, Digital Business Card), Invoice (Invoice
   Type, Invoice Numbering, Currency, Tax, Payment Terms, Invoice Template),
   Backup (Backup & Restore), Security (Security), Account (Account) —
   exactly the brief's five groups and every named item, each a
   `SettingsRow` under a section header.
2. **Invoice Templates** — `src/screens/settings/InvoiceTemplatesScreen.tsx`.
   Classic/Modern/Compact as selectable `TemplateCard`s (a new, minimal
   component mirroring `InvoiceTypeCard`'s layout without its "Fields:"
   line) with a real description of each; tapping one saves immediately,
   mirroring `InvoiceTypeSelectionScreen`'s fixed-type tap-to-save behavior.
3. **Security** — `src/screens/settings/SecurityScreen.tsx`. Two
   `FieldToggleRow`s (App Lock, Biometric Unlock — the latter disabled with
   a "Not supported on this device" hint when `BiometricService.isSupported()`
   is false), each saving immediately on toggle.
4. **Account** — `src/screens/settings/AccountScreen.tsx`. Account and
   Subscription placeholder cards + a working "Log out" button — see "What
   was built".

**Navigation:** `RootStackParamList` gained `Settings`, `InvoiceTemplates`,
`Security`, `Account` (all `undefined` params); `RootNavigator` registers all
four. Two additive entry points were added so the hub is reachable without
any existing screen's behavior changing: `DashboardScreen` gained a
"Settings" button in its secondary link row (Invoices/Customers/Business/
**Settings**), and `BusinessScreen` gained a "Settings" `ActionButton`
alongside its existing action row — the same reciprocal-link convention
Phase 8 used when it added a "Dashboard" button to `BusinessScreen`.

### 2. Backend files

No backend service was built — none is required (everything is local:
settings live in SQLite, authentication happens entirely on-device via
`expo-local-authentication`). Documented future contract, per "APIs only
where required":

- **Security settings sync** — if a future cloud-backup/account phase needs
  to sync App Lock/Biometric Unlock preferences, it would be
  `GET /settings/security` → `SecuritySettings`
  (`src/domain/security/types.ts`: appLockEnabled, biometricUnlockEnabled,
  updatedAt) and `PUT /settings/security` with a `SecuritySettingsInput`
  body, behind a future `RemoteSecurityRepository` implementing today's
  `SecurityRepository` interface unchanged. Not built now — nothing in
  Phase 10 needs network I/O.
- **Account / Subscription** — deliberately not designed at all yet, per
  "do not implement unnecessary account features" / "do not implement
  payment processing". No contract is proposed here because there is no
  account or billing system to design one against; that's explicitly future
  scope (`MVP_BUILD_PLAN.md` §10's "subscription/payment provider" open
  decision, flagged for Phase 12).

### 3. Database changes

**One new table**, following the same singleton-per-device-row convention
`business` (Phase 1) already established — `app_settings`
(`src/data/db/schema.ts`): `id` (`'default'`), `app_lock_enabled` /
`biometric_unlock_enabled` (`INTEGER`, `0`/`1`), `created_at`, `updated_at`.
Kept as its own table rather than more columns on `business` because these
are device/app settings (whether *this installed app* requires unlocking),
not business data — `MVP_BUILD_PLAN.md` §6.1 lists `AppSettings` as its own
entity for exactly this reason, and it was the one entity from that list not
yet built by any prior phase.

Being a brand-new table, no `ALTER TABLE`/backfill step was needed (unlike
`business`'s column additions in Phases 2/3): `CREATE TABLE IF NOT EXISTS`
in `CREATE_TABLES_SQL` handles both a fresh install and an existing install
identically — `db/client.ts` needed no changes. Canonical SQL generated for
documentation via `node node_modules/drizzle-kit/bin.cjs generate` →
`drizzle/0007_clear_spencer_smythe.sql`, matches the hand-written
`CREATE_TABLES_SQL` exactly (verified by hand).

New repository, following the established three-file pattern:

- `SecurityRepository` interface (`src/data/security/SecurityRepository.ts`):
  `getSettings()` / `saveSettings()`.
- `InMemorySecurityRepository` — mock/testing implementation.
- `SqliteSecurityRepository` — real implementation against `app_settings`
  via Drizzle queries. No Jest coverage — Jest can't drive the native SQLite
  module without a device, same as every other `Sqlite*Repository` in this
  codebase.

### 4. New modules

**Domain** (`src/domain/security/types.ts`) — `SecuritySettings` /
`SecuritySettingsInput` / `EMPTY_SECURITY_SETTINGS_INPUT`. No Zod schema was
needed (two plain booleans, toggled directly — not a text form).

**Data/services** (`src/data/security/`):

- `BiometricService` interface + `ExpoBiometricService` (real,
  `expo-local-authentication`-backed — no Jest coverage, same as
  `ExpoPdfService`) + `FakeBiometricService` (the Jest-safe double every
  store/screen/component test injects — configurable `supported`/
  `nextAuthenticateResult`, records every `authenticate()` call).
- `data/container.ts` gained `getSecurityRepository()` and
  `getBiometricService()`, following the exact composition-root pattern
  every prior phase's services used.

**State**:

- `src/state/securityStore.ts` — `createSecurityStore(repository,
  biometricService)` + `useSecurityStore`. Backs both the Security screen's
  toggles and `AppLockGate` (which reads this same singleton's `settings`/
  `biometricSupported` rather than re-reading `SecurityRepository` itself —
  see its doc comment for why).
- `src/state/appLockStore.ts` — `createAppLockStore(biometricService)` +
  `useAppLockStore`. Deliberately holds **no repository of its own** — it
  only tracks the runtime `'checking' | 'unlocked' | 'locked'` state and
  calls `BiometricService.authenticate()`; `AppLockGate` is what feeds it
  the persisted setting (via `securityStore`) at the two moments that
  matter (initial launch, foreground resume). Keeping the persisted-setting
  read and the runtime lock state in two separate, narrowly-scoped stores
  is what let `applyInitialState()`'s "only once" guard be a simple boolean
  instead of needing to reconcile a live settings subscription against
  in-progress unlock state.

**Components**:

- `src/components/security/AppLockGate.tsx` — the runtime enforcement
  described under "What was built". Uses React Native's `AppState` listener
  to detect background→foreground transitions; renders a checking spinner,
  the full-screen lock prompt, or `children`, per `appLockStore.status`.
- `src/components/settings/TemplateCard.tsx` — see "Screens built".
- `src/components/invoiceType/FieldToggleRow.tsx` (Phase 3, extended) —
  added an optional `disabledHint` prop (default `'Always included'`,
  matching its existing behavior exactly) so the Security screen can reuse
  it with `"Not supported on this device"` instead of duplicating a near-
  identical checkbox-row component.

**App wiring**: `App.tsx` now renders `<AppLockGate><RootNavigator /></AppLockGate>`
inside `NavigationContainer`. With App Lock off (the default, and the only
state any existing install can be in before this phase), `AppLockGate`
resolves to `'unlocked'` as soon as `securityStore.load()` finishes and
renders `children` immediately — no behavior change for anyone who hasn't
opted in.

**Dependency added**: `expo-local-authentication` (`~57.0.2`, installed via
`npx expo install` for an SDK-57-compatible version). `app.json` registers
its config plugin with a `faceIDPermission` string (iOS Face ID usage
description — the same pattern `expo-image-picker`'s
`photosPermission` already established), needed for a future native/EAS
build; no effect on Expo Go/JS-only testing.

### 5. Tests

559 Jest tests across 129 suites, all passing (`npx jest` / `npm test`, up
from Phase 9's 527 across 118 — run twice in a row to confirm stability,
green both times); TypeScript strict-mode `tsc --noEmit` is clean; a full
Metro static export (`expo export --platform android`) bundles the whole
app (1543 modules, up from Phase 9's 1529) with no resolution errors.

- **Domain** (`domain/business/__tests__/formMapping.test.ts`, extended):
  `settingsWithTemplate()` falling back to the empty-state defaults for a
  never-saved business, and changing only the template while carrying every
  other saved field through untouched.
- **Repository** (`InMemorySecurityRepository.test.ts`): null before
  anything is saved, save/read-back of both toggles, updating in place
  rather than creating a second row.
- **Stores**:
  - `securityStore.test.ts`: defaults (both off, unsupported) for a
    never-saved device, reporting biometric support from the injected
    service, save reflecting immediately, error states from a failing
    repository (load and save, the latter rethrowing).
  - `appLockStore.test.ts`: starts `'checking'`; `applyInitialState(false/true)`
    resolves to unlocked/locked; **the "only once" guard** — a second
    `applyInitialState` call after the first is a no-op, so a later settings
    save can't yank an already-unlocked screen back to locked;
    `lockIfEnabled` only re-locks when its argument is true; `unlock()`
    transitioning to `'unlocked'` on a successful `authenticate()` call
    (asserting the exact prompt text `'Unlock Invora'`) and staying
    `'locked'` on a failed/cancelled one.
- **Component** (`AppLockGate.test.tsx`, one render per test — see the
  file-splitting note below): renders `children` immediately when App Lock
  has never been turned on; shows the lock screen (children hidden) when
  App Lock is on, with a manual "Unlock" button that calls the biometric
  service and reveals `children` on success — and confirms **no** automatic
  biometric prompt fires when Biometric Unlock is off; a third test confirms
  the automatic-prompt-on-appearance behavior *does* fire when Biometric
  Unlock is on and the device supports it.
- **Screens**:
  - `SettingsScreen` — split across four files
    (`SettingsScreen.test.tsx`/`.invoice.test.tsx`/`.backup.test.tsx`/
    `.other.test.tsx`, one test per file; see the note below): every
    Business/Invoice/Backup/Security/Account row navigates (or, for Backup,
    alerts) to the right destination.
  - `InvoiceTemplatesScreen`: all three templates listed with Classic
    defaulting selected; selecting a template saves immediately **without
    clobbering** the business's other invoice settings (prefix/currency/
    invoice type asserted unchanged); "Done" navigates back without
    requiring a selection change.
  - `SecurityScreen`: both toggles default off for a never-configured
    device; Biometric Unlock is disabled with the "Not supported on this
    device" hint when the injected service reports no support; toggling
    either row saves immediately.
  - `AccountScreen`: Account/Subscription placeholder text renders; "Log
    out" shows the honest "you're not signed in" alert.
- **Regression check**: `BusinessScreen.test.tsx` and `DashboardScreen.test.tsx`
  each gained one assertion for their new "Settings" button navigating to
  `'Settings'` — every other Phase 1–9 assertion in both files is untouched.
  The full suite was re-run after every change in this phase and stayed
  green.
- **Test-file splitting note (re-encountered, same fix as Phases 1–8):**
  `SettingsScreen`'s four navigation-assertion tests, originally in one
  file/describe block, intermittently tripped React Testing Library's
  "overlapping act()" warning and lost previously-found `testID`s on the
  second/third/fourth test — the exact instability class this codebase has
  documented and worked around (by splitting one flow per file) in every
  phase from 1 through 8. Splitting into four files fixed it immediately;
  confirmed by running the full suite twice in a row afterward (559/559
  both times).
- **Offline mode / app restart**: not exercised by an automated test — same
  limitation as every prior phase (no device/emulator in this environment).
  Manual verification steps below.

### Manual offline verification (steps, to run on a device/simulator)

1. Enable Airplane Mode.
2. Open the app → it opens directly to the Dashboard exactly as before (App
   Lock is off by default) → tap "Settings" (or Business → "Settings") →
   the Settings hub opens showing all five sections — no network call
   anywhere in this flow.
3. Tap "Business profile" / "Digital business card" → confirm each opens
   the exact same screens Phases 1–2 already built.
4. Tap "Invoice type" → confirms it opens Invoice Type Selection (Phase 3).
   Tap "Invoice numbering" / "Currency" / "Tax" / "Payment terms" → confirm
   each opens the same Invoice Settings form (Phase 2) with all four fields
   editable together.
5. Tap "Invoice template" → Invoice Templates screen opens with Classic/
   Modern/Compact cards and Classic selected by default (or whatever was
   last saved) → tap "Modern" → confirm it saves immediately (no separate
   Save tap needed) → go back to Invoice Settings and confirm its own
   template chip-picker now shows "Modern" selected too (same underlying
   field).
6. Tap "Backup & restore" → confirm an alert explains it's coming in a
   future update, with no navigation.
7. Tap "Security" → toggle "App Lock" on → close the Settings/Security
   screens back to the Dashboard → put the app in the background (switch to
   another app or the home screen) → return to it → confirm the app now
   shows the lock screen instead of the Dashboard, with an "Unlock" button
   that opens the device's biometric/passcode prompt and reveals the app
   again on success.
8. Back in Security, toggle "Biometric unlock" on (only interactable on a
   device with biometrics enrolled) → background and foreground the app
   again → confirm the biometric prompt now fires automatically the instant
   the lock screen appears, instead of waiting for a manual "Unlock" tap.
9. Force-close the app entirely and reopen it (still offline) → confirm it
   opens straight to the lock screen (App Lock persisted across a full
   restart, read from SQLite) and unlocking still works.
10. Turn App Lock back off → confirm the app no longer locks on background/
    foreground or restart.
11. Tap "Account" from Settings → confirm the Account/Subscription
    placeholder text renders and "Log out" shows the "you're not signed in"
    alert rather than doing nothing or crashing.
12. Confirm every Phase 1–9 screen/flow still works exactly as before.

This wasn't run against a physical device/emulator in this environment
(none is available here) — in particular, `expo-local-authentication`'s
actual native behavior (the real biometric prompt, real hardware/enrollment
detection) has not been exercised on a physical device, only the pure
store/component logic feeding into it (see "Tests"), exactly like every
other native-backed module in this codebase (`expo-print`, `expo-sqlite`,
...). The schema, repository, and offline-safe design were verified as far
as this environment allows (unit tests + strict typecheck + full Metro
bundle export), same as every prior phase.

### 6. Known limitations

- **No device/emulator in this environment** — same caveat as every prior
  phase, and particularly relevant here since biometric hardware can only be
  truly exercised on a real device.
- **"Biometric Unlock" changes *when* the OS prompt auto-fires, not *which*
  credential it accepts** — `expo-local-authentication`'s `authenticateAsync()`
  has no "biometric-only, no passcode fallback" mode and no "passcode-only,
  skip biometric" mode; see "What was built" for the documented
  interpretation this phase settled on (auto-prompt-on-appearance vs.
  manual-tap-to-prompt), rather than silently pretending the two toggles
  independently gate different credential types when the underlying API
  doesn't support that.
- **No custom in-app PIN/passcode system** — App Lock's only unlock
  mechanism is the device's own OS-native biometric/passcode UI, per "do not
  implement unnecessary account features" and to avoid maintaining a second,
  app-level credential store with its own reset/recovery story. A device
  with no passcode/biometric configured at all cannot use App Lock
  meaningfully — that's an OS-level limitation, not something this app
  works around.
- **Biometric Unlock has no effect while App Lock is off** — it's stored
  and toggleable either way (no interdependent-disable logic was added, to
  keep the two settings simple and orthogonal to reason about), but only
  matters once App Lock is also on. Documented here rather than added as
  UI-level cross-field validation for two independent booleans.
- **No lock-screen retry limit, lockout timer, or "wipe after N failures"**
  — deliberately not built; there is no backend/account to protect beyond
  the same local SQLite database the device's own lock screen already
  guards, and Phase 15 (security audit) is a more appropriate place to
  revisit whether this app-level lock needs to be stricter than the OS's.
- **Account/Subscription remains entirely unbuilt beyond the honest
  placeholder text** — no login, no cloud account, no billing/subscription
  provider (Stripe/RevenueCat/etc.) integration, per the explicit "do not
  implement unnecessary account features" / "do not implement payment
  processing" instructions and `MVP_BUILD_PLAN.md` §10's still-open
  "subscription/payment provider" decision (flagged for Phase 12).
- **Backup & Restore has no functionality behind it yet** — Phase 11
  (Google Drive backup) is what builds it; this phase only adds the
  Settings row and an honest "coming in a future update" alert, per the
  brief's "RELATED SCREENS" not naming a Backup & Restore screen for Phase
  10 to build.
- **`InvoiceSettingsScreen`'s own template chip-picker was kept, not
  removed** — same "two non-conflicting entry points, one source of truth"
  reasoning Phase 3 already documented for its own dedicated-screen-plus-
  chip-picker coexistence.
- **No native `Switch` component was added** — App Lock/Biometric Unlock
  reuse `FieldToggleRow`'s checkbox-style toggle, per the same "no
  unnecessary packages" rule `OptionPicker`/`FieldToggleRow` already
  established, rather than introducing a platform `Switch` for two rows.

### 7. Files modified

New files: `src/domain/security/types.ts`,
`src/data/security/{SecurityRepository,InMemorySecurityRepository,
SqliteSecurityRepository,BiometricService,ExpoBiometricService,
FakeBiometricService}.ts` + `__tests__/InMemorySecurityRepository.test.ts`,
`src/state/{securityStore,appLockStore}.ts` +
`__tests__/{securityStore,appLockStore}.test.ts`,
`src/components/security/AppLockGate.tsx` +
`__tests__/AppLockGate.test.tsx`, `src/components/settings/TemplateCard.tsx`,
`src/screens/settings/{SettingsScreen,InvoiceTemplatesScreen,SecurityScreen,
AccountScreen}.tsx` + `__tests__/{SettingsScreen,SettingsScreen.invoice,
SettingsScreen.backup,SettingsScreen.other,InvoiceTemplatesScreen,
SecurityScreen,AccountScreen}.test.tsx`,
`drizzle/0007_clear_spencer_smythe.sql` (+ updated `drizzle/meta/`).

Modified files: `package.json`/`package-lock.json` (added
`expo-local-authentication`), `app.json` (registered its config plugin),
`App.tsx` (`AppLockGate` wraps `RootNavigator`), `src/data/db/schema.ts`
(new `app_settings` table + `CREATE_TABLES_SQL` entry), `src/data/container.ts`
(`getSecurityRepository()`, `getBiometricService()`),
`src/domain/business/types.ts` (`INVOICE_TEMPLATE_OPTIONS` gained a
`description` field per entry — additive, existing chip-picker usage
unaffected), `src/domain/business/formMapping.ts` (`settingsWithTemplate()`)
+ `__tests__/formMapping.test.ts` (two new tests),
`src/components/invoiceType/FieldToggleRow.tsx` (additive `disabledHint`
prop, default unchanged), `src/navigation/types.ts` (four new routes),
`src/navigation/RootNavigator.tsx` (four new screens registered),
`src/screens/dashboard/DashboardScreen.tsx` (one additive "Settings"
`ActionButton`) + `__tests__/DashboardScreen.test.tsx` (one new assertion),
`src/screens/business/BusinessScreen.tsx` (one additive "Settings"
`ActionButton`) + `__tests__/BusinessScreen.test.tsx` (one new assertion),
`MVP_BUILD_PLAN.md` (status header only).

### 8. Issues

None outstanding. One environment-specific instability was hit and resolved
while writing this phase's screen tests (not a production bug): the same
"overlapping act()" class Phases 1–8 already documented resurfaced in
`SettingsScreen`'s original single-file test suite and was fixed the same
way — splitting into one test per file (see "Tests" above). Full suite
re-run twice after the fix, green both times (559/559).

**Next phase:** Phase 11 — Google Drive Backup. Complete — see below.

---

## Phase 11 — Google Drive Backup

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phases 1–10 was deleted or behaviorally
changed except the Settings screen's Backup row (now routes to a real
screen instead of a "coming in a future update" alert — see below) and one
additive wrapper around `RootNavigator` in `App.tsx`.

### Architecture rule this phase enforces

Per the explicit instruction: **SQLite remains the sole live, primary
database.** Google Drive is used only as a backup destination — nothing in
this phase ever reads Drive to answer a screen's data, and no repository
outside `data/backup/` was changed. `BackupService.backupNow()` only *reads*
the local database (via `BackupRepository.exportAll()`) and *writes* to
Drive; `BackupService.restoreBackup()` only *reads* from Drive and, once
validated, *writes* to the local database. There is no path where Drive
data reaches a screen except through a full local restore.

### What was built

- Google Drive backup/restore end-to-end, on the real Google Drive REST API
  (Drive v3, App Data folder) and real OAuth via `expo-auth-session` — not a
  mock-only phase, because there's no separate "frontend behavior" to
  validate first the way earlier phases had a UI-only concern to mock; the
  brief's own "Test: ... Offline state, Google Drive unavailable" list is
  itself a set of network/service failure modes, so the mock
  (`FakeGoogleDriveBackupService`) and real
  (`ExpoGoogleDriveBackupService`) implementations were built together
  behind one interface from the start, exactly like `BiometricService` in
  Phase 10 — every test in this phase runs against the fake; the real
  implementation has the same "no Jest coverage, no device in this
  environment" limitation every other native/network-backed service here
  already has.
- **A versioned, checksummed backup format** (`domain/backup/types.ts`,
  `BACKUP_FORMAT_VERSION = 1`): one JSON file containing every raw row of
  `business`, `social_link`, `item`, `customer`, `invoice`, `invoice_item`,
  `payment`, and `app_settings` — the full "BACKUP CONTENT" list from the
  brief — plus a version number and a checksum computed over the table data
  (`domain/backup/checksum.ts`, a dependency-free FNV-1a hash). This is a
  data-layer concern, not a domain-use-case one: `BackupRepository` talks to
  Drizzle directly instead of composing eight feature repositories, so
  columns no domain type re-exposes (e.g. `InvoiceItem`'s frozen snapshot
  fields) still round-trip exactly.
- **Every "PROTECT AGAINST" case from the brief has a concrete mechanism**,
  not just a mention:
  - *Corrupted backup* — `validateBackupPayload()` recomputes the checksum
    over the downloaded file's `tables` and rejects a mismatch before
    anything is restored.
  - *Partial/interrupted backup* — the same checksum catches a
    truncated/partially-written file (a corrupted JSON parse also fails
    immediately); on the *write* side, old remote backups are only pruned
    (`BackupService`'s retention step, keeps the newest 10) **after** a new
    upload is confirmed, so an interrupted backup attempt never costs an
    existing good one.
  - *Incompatible version* — `SUPPORTED_BACKUP_FORMAT_VERSIONS` is checked
    before the checksum; a too-new or too-old `formatVersion` is rejected
    with a specific, honest message ("made by a newer version of Invora" /
    "no longer supported") instead of attempting a restore that could
    corrupt the schema.
  - *Restore failure* — see the safety rule below.
- **IMPORTANT SAFETY RULE, implemented as an actual SQLite transaction, not
  just a written promise**: `SqliteBackupRepository.restoreAll()` wraps the
  entire delete-everything-then-insert-everything sequence in one
  `drizzle-orm/expo-sqlite` `db.transaction()`. If *anything* inside throws
  — a schema mismatch, a constraint violation, the device running out of
  storage mid-write — SQLite rolls the whole transaction back and the local
  database ends up exactly as it was before the restore attempt, never
  partially replaced. Critically, `BackupService.restoreBackup()` never
  calls `restoreAll()` until `validateBackupPayload()` has already proven
  the file is structurally sound, version-compatible, and checksum-intact —
  so a corrupted/incompatible backup is rejected *before* the database is
  touched at all, and a failure *during* the write is rolled back by SQLite
  itself. Both halves are unit-tested: validation rejection via
  `domain/backup/__tests__/validation.test.ts`, and the rollback guarantee
  via `InMemoryBackupRepository`'s equivalent snapshot/rollback behavior
  (see its doc comment) exercised by `BackupService.test.ts`'s "a failed
  restore ... leaves existing data intact" case.
- **Automatic backup, manual Backup Now, manual Restore, and Backup
  History** — exactly the four brief-named features:
  - *Enable/disable* — a `FieldToggleRow` on the new `BackupScreen`, backed
    by `BackupSettingsRepository` (see below).
  - *Last backup time* / *Backup success/failure* — shown on the same
    screen, from the same repository's `lastBackupAt` / `lastBackupStatus` /
    `lastBackupError` fields, which are only ever written by
    `BackupService` after every single attempt (success or failure),
    manual or automatic.
  - *Backup Now* / *Restore Backup* — buttons on `BackupScreen`; Restore
    navigates into `BackupHistoryScreen`, which lists every backup currently
    on Drive with a per-file "Restore" action (with a destructive
    confirmation dialog naming exactly what will happen) — see "Screens
    built" for why this is two screens, matching
    `MVP_BUILD_PLAN.md` §7's "Backup & Restore, Backup History" pair
    exactly rather than inventing a third screen.
  - *Backup history* — the same `BackupHistoryScreen` also lists every
    logged attempt (`backup_log`, both backups and restores, success and
    failure, with the failure reason) — kept even on failure, so history
    shows *why* something didn't work, not just the successes.
- **No true OS background job was added.** "Automatic backup" runs
  opportunistically via `AutoBackupRunner` (wraps the app, alongside
  `AppLockGate`) — once when the app finishes loading backup settings, and
  again on every background→foreground transition (the same trigger points
  `AppLockGate` already uses) — rather than adding
  `expo-task-manager`/`expo-background-fetch` and the native/EAS build step
  they'd require to actually run while the app is closed. This is a
  deliberate, documented interpretation (see "Known limitations"), not a
  silent gap: it satisfies "Enable/disable, Last backup time, Backup
  success/failure" for a user who opens the app periodically, which is the
  realistic usage pattern for a small-business invoicing app, without
  adding a dependency this environment has no device to verify.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens → `backupStore`
  (Zustand) → `BackupService` (use-case layer) →
  `BackupRepository`/`BackupLogRepository`/`BackupSettingsRepository`/
  `GoogleDriveBackupService` interfaces → SQLite (Drizzle) / Google Drive
  REST API / in-memory-and-fake implementations. Screens never import the
  database, a concrete repository, or the Drive REST API directly.
- Reused rather than duplicated: `ActionButton`, `FieldToggleRow`,
  `SettingsRow`, the `colors` theme, and the existing `app_settings`
  singleton-row convention (`BackupSettingsRepository` shares the exact row
  `SecurityRepository` uses, each writing only the columns it owns — the
  same pattern Phase 2 established for `business`).

### 1. Screens built (matching `MVP_BUILD_PLAN.md` §7's "Backup & Restore, Backup History" exactly)

1. **Backup & Restore** — `src/screens/backup/BackupScreen.tsx`. Google
   sign-in/sign-out card; Automatic Backup toggle (disabled with a hint
   until signed in); a status card showing "Last successful backup" and
   "Last attempt" (Succeeded/Failed/Never attempted), with the failure
   reason shown inline when the last attempt failed; "Backup now" (disabled
   while signed out or already running); "Restore backup" and "Backup
   history" (both navigate into `BackupHistoryScreen` — see "What was
   built" for why one destination serves both actions).
2. **Backup History** — `src/screens/backup/BackupHistoryScreen.tsx`. Two
   sections: every backup currently on Google Drive (with a per-file
   "Restore" button behind a destructive confirmation dialog), and the full
   local `backup_log` history (direction, trigger, status, timestamp, row
   count/size on success, error message on failure) — empty states for
   "not signed in yet" and "no backups on Drive yet" are both handled
   explicitly rather than showing a blank list.

**Navigation:** `RootStackParamList` gained `Backup` and `BackupHistory`;
`RootNavigator` registers both. The Settings hub's existing "Backup &
restore" row (Phase 10) now navigates to `Backup` instead of showing the
"coming in a future update" alert — the only behavioral change to a Phase
10 screen, and it was already explicitly documented in Phase 10's "Known
limitations" as this phase's job to fill in.

### 2. Backend files

No custom backend service was built — the "backend" here is Google's own
Drive v3 REST API, called directly:

- `src/data/backup/googleDrive/GoogleDriveBackupService.ts` — the interface
  (`isSignedIn`, `signIn`, `signOut`, `uploadBackup`, `listBackups`,
  `downloadBackup`, `deleteBackup`) plus three typed errors
  (`OfflineError`, `DriveUnavailableError`, `NotSignedInError`) every method
  can throw, so `BackupService` can classify a failure precisely instead of
  guessing from a generic exception.
- `src/data/backup/googleDrive/ExpoGoogleDriveBackupService.ts` — the real
  implementation: OAuth 2.0 + PKCE authorization-code flow via
  `expo-auth-session`'s `AuthRequest`/`exchangeCodeAsync`/`refreshAsync`/
  `revokeAsync` (Google's `accounts.google.com` / `oauth2.googleapis.com`
  endpoints), tokens persisted via `expo-secure-store` (not plain SQLite —
  these are credentials, not app data), and the Drive v3 REST API called
  directly with `fetch` (multipart upload, `alt=media` download, `files`
  list/delete) scoped to `drive.appdata` — the hidden **App Data folder**
  only this app can see, per `MVP_BUILD_PLAN.md` §2's "Google Drive backup
  ... (App Data folder)". A network-state check (`expo-network`) and 401→
  refresh-and-retry-once logic classify failures into the three typed
  errors above rather than letting a raw `fetch` rejection bubble up.
- `src/data/backup/googleDrive/FakeGoogleDriveBackupService.ts` — the
  Jest-safe double every test in this phase runs against (same role
  `FakeBiometricService` plays for `BiometricService`), with
  `simulateOffline`/`simulateUnavailable` flags covering the brief's
  offline/unavailable test scenarios without a device or real network.
- `src/data/backup/BackupService.ts` — the use-case layer `backupStore` and
  the screens actually call (`backupNow(trigger)`,
  `restoreBackup(fileId, trigger)`, `listRemoteBackups()`). Owns: exporting
  + enveloping + uploading, validating + restoring, retention pruning
  (after success only), and logging every attempt (success and failure) via
  `BackupLogRepository` and `BackupSettingsRepository`. See "What was
  built" for the safety guarantees this class is responsible for composing
  correctly.

### 3. Database changes

**One new table, one extended table** — same additive/idempotent pattern
every prior schema change in this codebase used:

- **`backup_log`** (new) — `id`, `direction` (`backup`/`restore`),
  `trigger` (`manual`/`automatic`), `status` (`success`/`failure`),
  `destination` (`'google_drive'`, kept as free text rather than a
  single-value enum so a future second destination —
  `MVP_BUILD_PLAN.md`'s optional paid cloud backup, Phase 12 — is
  additive), `started_at`, `finished_at`, `format_version`, `size_bytes`,
  `item_counts` (JSON-encoded per-table row counts), `error_message`.
  Indexed on `started_at` for the history list's ordering. Being a
  brand-new table, no backfill was needed — `CREATE TABLE IF NOT EXISTS` in
  `CREATE_TABLES_SQL` handles both a fresh install and an existing one.
- **`app_settings`** (extended, not duplicated — same table Phase 10's
  App Lock/Biometric Unlock already live on) gained four columns:
  `auto_backup_enabled`, `last_backup_at`, `last_backup_status`,
  `last_backup_error`. **Existing installs** (anyone who already has the
  Phase-10-shaped `app_settings` table) get these backfilled by a new
  `ensureAppSettingsColumns()` step in `db/client.ts`, run once at every app
  start right after `ensureBusinessColumns()` — the exact same
  `PRAGMA table_info` / `ALTER TABLE ... ADD COLUMN` mechanism Phase 2
  established for `business`, just applied to a second table for the first
  time. `BackupSettingsRepository`'s reads/writes only ever touch these four
  columns (never `app_lock_enabled`/`biometric_unlock_enabled`), the same
  "share one row without clobbering" guarantee Phase 2 proved for
  `business` and Phase 10 already relied on for this exact row.

Canonical SQL regenerated via
`node node_modules/drizzle-kit/bin.cjs generate` →
`drizzle/0008_milky_maggott.sql`, matches the hand-written
`CREATE_TABLES_SQL`/`APP_SETTINGS_COLUMN_UPGRADES` exactly (verified by
hand — same `CREATE TABLE backup_log` + four `ALTER TABLE app_settings ADD`
statements).

New repositories, following the established three-file pattern:

- `BackupRepository` (`exportAll`/`restoreAll`) — `InMemoryBackupRepository`
  (mock, with a `simulateFailureOnRestore` hook that snapshots-and-rolls-back
  exactly like a real SQL transaction, for testing the safety guarantee
  without a device) and `SqliteBackupRepository` (real, transactional — see
  "What was built"). No Jest coverage for the Sqlite one, same reason as
  every other `Sqlite*Repository` in this codebase.
- `BackupLogRepository` (`list`/`add`) — `InMemoryBackupLogRepository` +
  `SqliteBackupLogRepository`.
- `BackupSettingsRepository` (`getSettings`/`saveSettings`/`recordAttempt`)
  — `InMemoryBackupSettingsRepository` + `SqliteBackupSettingsRepository`
  (shares `app_settings` with `SqliteSecurityRepository` — see above).

### 4. API contracts

None defined or implemented against a custom backend — this phase's only
external calls are to Google's own OAuth and Drive v3 REST APIs (documented
in "Backend files" above), which are the actual, real contract this phase
integrates against, not a placeholder for a future one. The optional paid
cloud backup (Phase 12, `MVP_BUILD_PLAN.md` §10) is still the phase that
will define a custom backend contract, if/when it's confirmed; nothing here
assumes its shape.

### 5. Tests

638 Jest tests across 141 suites, all passing (`npx jest`, up from Phase
10's 559 across 129); TypeScript strict-mode `tsc --noEmit` is clean; a full
Metro static export (`expo export --platform android`) bundles the whole
app (1588 modules, up from Phase 10's 1543) with no resolution errors.

- **Domain** (`domain/backup/__tests__/`): `checksum.test.ts` (deterministic,
  changes on any single-character corruption or truncation);
  `validation.test.ts` (round-trips a backup with no data and a backup with
  500 customers/2000 invoices — "Test: backup with no data" / "large data";
  rejects malformed JSON, a checksum mismatch — "Test: corrupted backup";
  a truncated/interrupted file; a too-new and a too-old `formatVersion` —
  "Test: incompatible version"); `types.test.ts` (`countBackupTables` over
  empty and mixed tables); `formatting.test.ts` (size/timestamp
  formatting, including "Never" for null/invalid input).
- **Repositories** (`data/backup/__tests__/`):
  `InMemoryBackupRepository.test.ts` (empty export — "Test: backup with no
  data"; a 300-row export — "large data"; `restoreAll` replacing existing
  data — "Test: existing local data"; **the key safety test** — a
  simulated mid-restore failure rolling back to the pre-restore snapshot
  — "Test: failed restore"); `InMemoryBackupLogRepository.test.ts` and
  `InMemoryBackupSettingsRepository.test.ts` (basic CRUD + the "recording a
  failure never overwrites the last successful `lastBackupAt`" rule).
- **Google Drive service** (`data/backup/googleDrive/__tests__/`):
  `FakeGoogleDriveBackupService.test.ts` — sign-in/out, requiring sign-in
  before every operation, upload/list/download/delete round-tripping, and
  both `simulateOffline` ("Test: offline state") and `simulateUnavailable`
  ("Test: Google Drive unavailable") throwing the right typed error.
- **Use-case layer** (`data/backup/__tests__/BackupService.test.ts`, 16
  tests) — every brief-named test scenario by name: backup with no data,
  backup with large data (1000 customers / 5000 invoices / 20,000 invoice
  lines), restore (success, replacing existing local data), failed restore
  (repository throws mid-write → data left intact), corrupted backup,
  incompatible version, not-signed-in, offline state, Google Drive
  unavailable — plus retention pruning only after a successful upload, and
  every attempt (success or failure) landing in `backup_log`.
- **Store** (`state/__tests__/backupStore.test.ts`, 13 tests): load,
  sign-in/out (including remote-backup refresh), the Automatic Backup
  toggle, `backupNow()`/`restore()` success and failure paths (status/error
  reflected immediately), and `runAutomaticBackupIfDue()`'s four branches
  (disabled → no-op; not signed in → no-op; never backed up → runs; backed
  up recently → no-op; backed up >24h ago → runs again), using an
  injectable clock so these don't depend on real wall-clock time.
- **Screens**: `BackupScreen.test.tsx` (sign-in prompt with disabled
  actions while signed out; signing in reveals the signed-in state;
  toggling Automatic Backup saves immediately; "Backup now" shows a success
  alert and updates status; a failed attempt's reason is shown inline) and
  `BackupHistoryScreen.test.tsx` (signed-out empty state; signed-in-with-
  nothing-on-Drive empty state; listing a remote backup and restoring it
  after confirming updates history; a failed history row shows its error
  message) — same store-injection pattern (`jest.mock` + a per-test
  `createBackupStore(...)` instance) `SecurityScreen.test.tsx` established
  in Phase 10.
- **Regression check**: `SettingsScreen.backup.test.tsx` was rewritten (the
  row now navigates to `'Backup'` instead of showing Phase 10's placeholder
  alert) — every other Phase 1–10 test file and assertion is untouched; the
  full suite was re-run after every change in this phase and stayed green.
- **Offline mode / app restart**: the *local* half (SQLite persistence,
  transaction rollback logic) is proven exactly as thoroughly as every
  other phase's local persistence (unit tests against the in-memory
  double + the real `Sqlite*` implementation's identical shape). The
  *network* half (real Google sign-in, real Drive upload/download,
  real airplane-mode/outage behavior) has **not** been exercised against a
  real device or a real Google Cloud OAuth client — see "Known
  limitations".

### Manual verification (steps, to run on a device/simulator once a Google Cloud OAuth client id is configured)

1. Create a Google Cloud project, enable the Drive API, create an OAuth
   2.0 client ID (Android/iOS type, matching this app's package
   name/bundle id and SHA-1 for Android), and set it as
   `expo.extra.googleDriveClientId` in `app.json` (currently `""` — see
   "Known limitations"). This step cannot be completed in this environment
   (no Google Cloud account/credentials available here).
2. Enable Airplane Mode, open the app → Settings → "Backup & restore" →
   confirm the screen loads with "Sign in with Google" and every action
   disabled — no network call is attempted while offline for anything but
   the sign-in button itself.
3. Disable Airplane Mode → tap "Sign in with Google" → complete the OAuth
   consent screen in the system browser → confirm the screen now shows
   "Signed in" and "Sign out".
4. Toggle "Back up automatically" on → confirm it saves immediately (no
   separate Save step).
5. Tap "Backup now" → confirm a success alert appears, "Last successful
   backup" updates to the current time, and "Last attempt" shows
   "Succeeded".
6. Enable Airplane Mode → tap "Backup now" again → confirm a clear
   "you're offline" failure message, and that "Last successful backup"
   still shows the previous (step 5) time — a failed attempt never
   overwrites the last *successful* one.
7. Disable Airplane Mode → change some data (e.g. edit the business name)
   → "Backup history" → confirm the Drive backup from step 5 is listed →
   tap "Restore" on it → confirm the destructive confirmation dialog names
   exactly what will happen → confirm → confirm the business name reverts
   to what it was at backup time, and the restore appears in history as a
   success.
8. Force-close and reopen the app (still online, Automatic Backup on) →
   confirm nothing backs up immediately if the last one was recent (< 24h);
   change the device clock forward (or wait) and reopen → confirm an
   automatic backup runs without any user action, and "Last successful
   backup" updates accordingly.
9. Confirm every Phase 1–10 screen/flow still works exactly as before.

This wasn't run against a physical device/emulator or a real Google Cloud
project in this environment (neither is available here) — the local
persistence and orchestration logic were verified as far as this
environment allows (unit tests + strict typecheck + full Metro bundle
export), same as every prior phase; the OAuth/Drive-REST integration itself
is new territory this phase adds and is correspondingly the biggest single
"needs a real device + real credentials to fully confirm" item to date.

### 6. Known limitations

- **No device/emulator, and no Google Cloud OAuth client id, in this
  environment.** `expo.extra.googleDriveClientId` is left as `""` in
  `app.json`; `ExpoGoogleDriveBackupService.signIn()` throws a clear,
  actionable error ("Google Drive backup is not configured for this
  build...") rather than attempting a request that could never succeed.
  Setting up a real Google Cloud project/OAuth client and exercising the
  full sign-in → backup → restore flow on a physical device is required
  before this feature can be considered field-verified — see "Manual
  verification" above.
- **"Automatic backup" is not a true OS background job** — see "What was
  built". It runs opportunistically on app launch and
  background→foreground transitions, not on a fixed schedule while the app
  is closed. Revisit with `expo-task-manager`/`expo-background-fetch` (and
  the native/EAS build they require — this project already has an EAS
  project id configured, from an earlier phase, so that step is not itself
  blocked) if a stricter "back up every day even if the app is never
  opened" guarantee is explicitly requested later.
- **One backup file per attempt, no delta/incremental backups** — every
  "Backup Now" (manual or automatic) uploads a complete new JSON file of
  every table; the retention step prunes down to the newest 10. For the
  data volumes a small business accumulates (the "large data" test covers
  1000s of customers/invoices and 20,000 invoice lines) this stays fast and
  simple; revisit only if real-world backup file sizes become a problem
  Google Drive's App Data quota can't absorb.
- **The checksum is a corruption/truncation detector, not a cryptographic
  guarantee** — see the doc comment on `computeChecksum()`. It reliably
  catches truncation, reordering, and accidental corruption (the brief's
  actual concern), but isn't a defense against a deliberately-forged file
  with a matching hash. Swapping in a real hash (`expo-crypto`'s SHA-256)
  is a self-contained change inside `checksum.ts` if that's ever needed.
- **`backup_log` rows with `finishedAt: null` are theoretically possible**
  if the app is killed mid-attempt (between starting the log write and
  finishing it) — in practice every `BackupService` code path always
  awaits through to writing a finished log entry (success or failure) in
  the same call, so this would only happen from an OS-level force-kill
  during that narrow window, not from any error this codebase's own code
  raises. Not specifically handled (e.g. no "resume/clean up orphaned
  attempts" step) — revisit if this is ever observed in practice.
- **No "delete this backup" action was exposed in the UI** — retention
  pruning does this automatically after a successful new backup, and
  `GoogleDriveBackupService.deleteBackup()` exists and is tested, but
  `BackupHistoryScreen` doesn't yet offer a manual "delete this specific
  backup" button. Add one if a real user need for manually curating the
  Drive backup list comes up.
- **Sign-in state (`isSignedIn()`) is checked, not proactively refreshed,
  on screen load** — `ExpoGoogleDriveBackupService` refreshes an expired
  access token lazily, the first time a Drive call actually needs one
  (inside `getValidAccessToken()`), rather than eagerly validating the
  session the moment `BackupScreen` opens. This keeps `isSignedIn()` fast
  and offline-safe (it only checks whether *some* token is stored), at the
  cost of not being able to distinguish "signed in and the session is
  still good" from "signed in but the refresh token was revoked
  server-side" until the next actual Drive call is attempted (which then
  correctly surfaces `NotSignedInError` and prompts re-sign-in).

### 7. Files modified

New files: `src/domain/backup/{types,checksum,validation,formatting,
testFixtures}.ts` + `__tests__/{checksum,validation,types,formatting}.test.ts`,
`src/data/backup/{BackupRepository,InMemoryBackupRepository,
SqliteBackupRepository,BackupLogRepository,InMemoryBackupLogRepository,
SqliteBackupLogRepository,BackupSettingsRepository,
InMemoryBackupSettingsRepository,SqliteBackupSettingsRepository,
BackupService}.ts` + `__tests__/{InMemoryBackupRepository,
InMemoryBackupLogRepository,InMemoryBackupSettingsRepository,
BackupService}.test.ts`,
`src/data/backup/googleDrive/{GoogleDriveBackupService,
FakeGoogleDriveBackupService,ExpoGoogleDriveBackupService}.ts` +
`__tests__/FakeGoogleDriveBackupService.test.ts`,
`src/state/backupStore.ts` + `__tests__/backupStore.test.ts`,
`src/components/backup/AutoBackupRunner.tsx`,
`src/screens/backup/{BackupScreen,BackupHistoryScreen}.tsx` +
`__tests__/{BackupScreen,BackupHistoryScreen}.test.tsx`,
`drizzle/0008_milky_maggott.sql` (+ updated `drizzle/meta/`).

Modified files: `package.json`/`package-lock.json` (added
`expo-auth-session`, `expo-web-browser`, `expo-crypto`, `expo-application`,
`expo-network`, `expo-secure-store`, `expo-constants` — see below for why
each was added), `app.json` (registered the `expo-web-browser` and
`expo-secure-store` config plugins; added `expo.extra.googleDriveClientId`,
currently `""` — see "Known limitations"), `App.tsx` (`AutoBackupRunner`
wraps `RootNavigator`, inside `AppLockGate`), `src/data/db/schema.ts` (new
`backup_log` table + four new `app_settings` columns +
`APP_SETTINGS_COLUMN_UPGRADES`), `src/data/db/client.ts`
(`ensureAppSettingsColumns()`), `src/data/container.ts`
(`getBackupRepository()`, `getBackupLogRepository()`,
`getBackupSettingsRepository()`, `getGoogleDriveBackupService()`,
`getBackupService()`), `src/navigation/types.ts` (two new routes),
`src/navigation/RootNavigator.tsx` (two new screens registered),
`src/screens/settings/SettingsScreen.tsx` (Backup row now navigates instead
of alerting) + `__tests__/SettingsScreen.backup.test.tsx` (rewritten for
the new behavior), `MVP_BUILD_PLAN.md` (status header only).

**Dependencies added** (all via `npx expo install`, SDK-57-compatible
versions): `expo-auth-session` + `expo-web-browser` (the OAuth flow itself,
per `MVP_BUILD_PLAN.md` §2's stated stack), `expo-secure-store` (OAuth
access/refresh tokens are credentials, not app data — kept out of plain
SQLite), `expo-network` (proactive offline detection, so a doomed request
isn't even attempted), `expo-constants` (reading `expo.extra` config, e.g.
the OAuth client id, and `expo.version` for the backup payload's
`appVersion` field), `expo-crypto` and `expo-application` were installed
alongside the others but are **not currently used** — `expo-crypto` in case
a stronger checksum is wanted later (see "Known limitations"), and
`expo-application` was superseded by reading `expo.version` straight from
`expo-constants` instead; both are harmless to leave installed (Expo SDK
packages with no import have zero runtime cost) but are candidates for
removal if a future cleanup pass wants to trim unused dependencies.

### 8. Issues

None outstanding. Two implementation details were caught and fixed while
building this phase (not shipped): `GoogleDriveBackupService.isSignedIn()`
was initially designed synchronous, then corrected to `Promise<boolean>`
once it became clear checking secure storage is inherently async (a sync
signature would have forced a stale-on-first-render read, the same class
of bug actually caught in `BackupHistoryScreen`'s remote-backup-listing
effect below); and `BackupHistoryScreen`'s initial `useEffect` fired
`refreshRemoteBackups()` once on mount using a stale closed-over `signedIn`
value from before `load()` resolved it, so signed-in users never actually
saw their Drive backups — split into two effects (one for `load()`, a
second keyed on `signedIn` for `refreshRemoteBackups()`) and covered by the
"lists remote backups and restoring one" screen test, which caught the bug
during this phase's own verification.

**Next phase:** Phase 12 — Optional cloud backup. Complete — see below.

---

## Phase 12 — Optional Cloud Backup

**Status:** Complete for the scope defined below. Built on explicit
instruction. Working tree was re-inspected first (see the file lists at the
top of this document); nothing in Phases 1–11 was deleted or behaviorally
changed except one additive `SettingsScreen` row, one additive
`AccountScreen` paragraph edit, and one additive `backupLog.destination`
type value (see below) — Google Drive backup (Phase 11) is untouched and
keeps working exactly as before.

### Architecture rule this phase enforces

Per the explicit instruction:

```
Mobile SQLite → versioned/encrypted backup → Cloud API → Object storage
```

Cloud backup is a **second, independent, optional backup destination** —
never a live data source, and never a per-write sync. `CloudBackupService`
only ever *reads* the local database (via the same `BackupRepository`
Phase 11 built) and *writes* to the cloud API; restoring only ever *reads*
from the cloud API and, once decrypted and validated, *writes* to the local
database. Individual database operations are never synchronized — a
"backup" is always one full, versioned, **encrypted** snapshot, uploaded on
request. The app's core functionality (invoicing, customers, items,
payments, dashboard, PDF/sharing, the digital business card, and Google
Drive backup) has **zero dependency on cloud backup being configured,
reachable, or enabled** — every cloud-backup failure mode
(`CloudBackupNotConfiguredError`/`CloudBackupOfflineError`/
`CloudBackupUnavailableError`/`CloudStorageLimitExceededError`) is caught at
the use-case layer and surfaced as a plain, inline UI message, never a crash
or a blocked screen elsewhere in the app.

### What was built

- **Deliberate, maximal reuse of Phase 11's data-layer doors instead of a
  parallel set of cloud-specific ones** — `CloudBackupService` (the Phase 12
  use-case class) is constructed with the *same* `BackupRepository`
  (`exportAll`/`restoreAll`) and the *same* `BackupLogRepository`
  (`backup_log`, now used with `destination: 'cloud'`) Phase 11 already
  built and registered in `data/container.ts`. This is exactly what Phase
  11's doc comment on `backup_log.destination` predicted when it kept that
  column free text instead of a single-value enum specifically "so a future
  second destination ... is additive." No second local-export mechanism, no
  second history table, per "no duplicate models/repositories/calculations."
- **A real encryption layer, not a placeholder** — `BackupEncryptionService`
  wraps `expo-crypto`'s native **AES-256-GCM** (`AESEncryptionKey`,
  `aesEncryptAsync`/`aesDecryptAsync`, `AESSealedData`), which turned out to
  already ship in the `expo-crypto` version this project depends on (Phase
  11 installed it for a possible stronger checksum and left it otherwise
  unused — see its "Known limitations"). No new npm dependency was needed.
  The AES key is generated once per device and stored via
  `expo-secure-store` (a credential, not app data — same reasoning Phase 11
  used for the Google OAuth tokens); it is never uploaded anywhere. Every
  backup payload is encrypted **on-device, before** `CloudBackupApi.uploadBackup()`
  is ever called — unlike Google Drive's private, per-app App Data folder,
  the cloud object-storage backend is treated as a third party this app
  doesn't control, so plaintext invoice/customer data never leaves the
  device. `EncryptedBackupEnvelope.alg` versions the scheme (`'aes-256-gcm-v1'`),
  the same "version anything that could need to change" reasoning
  `BACKUP_FORMAT_VERSION` already uses.
- **Every requirement from the brief has a concrete mechanism**:
  - *Cloud backup service* — `CloudBackupService` (`backupNow`,
    `restoreBackup`, `listRemoteBackups`, `getStorageUsage`), mirroring
    `BackupService`'s structure and safety guarantees (validate-before-restore,
    prune-only-after-confirmed-upload, log every attempt) almost exactly.
  - *Backup metadata* — `CloudBackupFile` (id, name, createdAt, encrypted
    size) per remote file, plus every attempt's `BackupLogEntry`
    (`destination: 'cloud'`) with row counts and size.
  - *Last backup* — `CloudBackupSettings.lastCloudBackupAt` /
    `lastCloudBackupStatus` / `lastCloudBackupError`, shown on
    `CloudBackupScreen`'s Status card.
  - *Storage usage* / *Storage limits* — `CloudStorageUsage`
    (used/limit/plan), fetched via `CloudBackupApi.getStorageUsage()` and
    shown as a usage bar + text on `CloudBackupScreen`; `uploadBackup()`
    enforces the limit and throws `CloudStorageLimitExceededError` instead
    of silently accepting an upload it can't store (see
    `FakeCloudBackupApi`'s enforcement and `CloudBackupService.test.ts`'s
    "Test: storage limits" case).
  - *Backup history* — `CloudBackupHistoryScreen`, reusing `backup_log`
    filtered to `destination: 'cloud'` (`cloudBackupStore` does the
    filtering client-side — no new query method was added to
    `BackupLogRepository` for what both destinations' small history lists
    already return cheaply in full).
  - *Cloud backup enabled/disabled* — `CloudBackupSettings.cloudBackupEnabled`,
    a `FieldToggleRow` on `CloudBackupScreen`; the toggle is the cloud-backup
    equivalent of Google Drive's "signed in" gate — `CloudBackupService.backupNow()`/
    `restoreBackup()` refuse to run while it's off, with a clear message,
    rather than silently no-op'ing.
  - *Upgrade storage placeholder* — `UpgradeStorageScreen`, listing
    `CLOUD_STORAGE_PLANS` (Free/Plus) and calling `CloudUpgradeService.requestUpgrade()`,
    which today always reports "not available yet" honestly — see below.
- **Subscription/payment kept modular, not built** — `CloudUpgradeService`
  (`data/subscription/`) is a small, self-contained interface
  (`getPlans()`, `requestUpgrade(planId)`) with exactly one implementation
  today, `PlaceholderCloudUpgradeService`, which makes no network call and
  integrates no payment SDK. This satisfies the explicit "do not implement a
  complicated billing system unless existing backend infrastructure already
  supports it" instruction — no billing backend exists — while keeping the
  seam a real Stripe/RevenueCat/IAP-backed implementation could fill in
  later without `CloudBackupService`, `CloudBackupScreen`, or
  `UpgradeStorageScreen` changing beyond how a successful result is handled.
  Cloud backup itself has zero dependency on this interface ever being
  filled in for real — a device can back up and restore on its default
  ("Free") plan indefinitely.
- **A real, undeployed REST backend contract, not a mock-only phase** —
  mirroring Phase 11's Google Drive integration, `CloudBackupApi` is a real
  `fetch`-based HTTP client (`RestCloudBackupApi`) written against a
  documented contract (device registration + storage/backups endpoints —
  see the interface's doc comment), not a stub. Because no such backend has
  actually been built yet (`MVP_BUILD_PLAN.md` §10's still-open "Optional
  cloud backup backend" decision), every method throws a clear
  `CloudBackupNotConfiguredError` until `expo.extra.cloudBackupApiUrl` is
  set in `app.json` (currently `""`) — the exact same pattern
  `ExpoGoogleDriveBackupService.signIn()` uses for its missing OAuth client
  id, so the app never attempts a request that could never succeed.
- Layered architecture per `MVP_BUILD_PLAN.md` §3: screens → `cloudBackupStore`
  (Zustand) → `CloudBackupService` (use-case layer) →
  `BackupRepository`/`BackupLogRepository` (reused from Phase 11) /
  `CloudBackupSettingsRepository` / `CloudBackupApi` /
  `BackupEncryptionService` / `CloudUpgradeService` interfaces → SQLite
  (Drizzle) / the cloud REST API / `expo-crypto` / in-memory-and-fake
  implementations. Screens never import the database, a concrete
  repository, the cloud REST API, or `data/container` directly —
  `UpgradeStorageScreen` reaches `CloudUpgradeService` through
  `cloudBackupStore.getUpgradePlans()`/`requestUpgrade()`, not a direct
  container import, to keep that rule exception-free.
- Reused rather than duplicated: `ActionButton`, `FieldToggleRow`, the
  `colors` theme, `formatBackupSize`/`formatBackupTimestamp`
  (`domain/backup/formatting.ts`), `buildBackupPayload`/`validateBackupPayload`
  (`domain/backup/validation.ts`), and — most significantly —
  `BackupRepository`/`BackupLogRepository` themselves, per "What was built"
  above.

### 1. Screens built

1. **Cloud Backup** — `src/screens/cloudBackup/CloudBackupScreen.tsx`.
   Enable/disable toggle; a Storage card (usage bar + "X of Y used" + plan
   name + "Upgrade storage" button, or an honest "not available"/"enable to
   see usage" message when there's no data yet); a Status card (last
   successful backup, last attempt succeeded/failed + error, mirroring
   `BackupScreen`'s layout exactly); "Backup now" / "Restore backup" /
   "Backup history" actions.
2. **Cloud Backup History** — `src/screens/cloudBackup/CloudBackupHistoryScreen.tsx`.
   Every backup currently in cloud storage (with a per-file "Restore" button
   behind a destructive confirmation dialog) + the local `backup_log` rows
   for `destination: 'cloud'` only — structurally identical to
   `BackupHistoryScreen`, including its disabled/empty states.
3. **Upgrade Storage** — `src/screens/cloudBackup/UpgradeStorageScreen.tsx`.
   Lists every plan in `CLOUD_STORAGE_PLANS` (Free/Plus) with the current
   plan highlighted; only plans flagged `isUpgradeTarget` show an "Upgrade"
   button, which calls `CloudUpgradeService.requestUpgrade()` and shows its
   (today, always "not available yet") result — the explicit
   "Upgrade storage placeholder" from the brief.

**Navigation:** `RootStackParamList` gained `CloudBackup`, `CloudBackupHistory`,
`UpgradeStorage`; `RootNavigator` registers all three. `SettingsScreen`
gained one additive "Cloud backup" row under the existing "Backup" section,
alongside (not replacing) "Backup & restore" — no existing row's behavior
changed. `AccountScreen`'s Subscription paragraph was updated to point at
the now-real Cloud Backup screen instead of saying a cloud backup plan is
merely "planned for a future update" (its `AccountScreen.test.tsx`
assertions — "Subscription" heading, "no cloud account" text — were checked
and still pass unchanged, since neither depends on the exact wording that
changed).

### 2. Backend files

No custom backend was deployed — same position Phase 11 started from before
Google's own API existed to integrate against, except here there is no
external API to integrate against yet either. What was built instead:

- `src/data/cloudBackup/CloudBackupApi.ts` — the interface
  (`getStorageUsage`, `uploadBackup`, `listBackups`, `downloadBackup`,
  `deleteBackup`) plus four typed errors (`CloudBackupOfflineError`,
  `CloudBackupUnavailableError`, `CloudBackupNotConfiguredError`,
  `CloudStorageLimitExceededError`) and a fully documented REST contract in
  its doc comment: `POST /v1/devices/register` (device-bound token, no
  email/password/billing fields — deliberately not a user-account system),
  `GET /v1/storage`, `POST /v1/backups`, `GET /v1/backups`,
  `GET /v1/backups/:id`, `DELETE /v1/backups/:id`.
- `src/data/cloudBackup/RestCloudBackupApi.ts` — the real implementation:
  plain `fetch` calls (no cloud SDK dependency), `expo-network` for a
  proactive offline check (same pattern `ExpoGoogleDriveBackupService` uses),
  lazy device registration on first use with the token cached in
  `expo-secure-store`, and HTTP-413 mapped to `CloudStorageLimitExceededError`.
  Throws `CloudBackupNotConfiguredError` immediately when
  `expo.extra.cloudBackupApiUrl` is unset — see "Known limitations".
- `src/data/cloudBackup/FakeCloudBackupApi.ts` — the Jest-safe double every
  test in this phase runs against (same role `FakeGoogleDriveBackupService`
  plays for Phase 11): in-memory files, real storage-limit enforcement
  against the plan's `limitBytes`, and `simulateOffline`/`simulateUnavailable`/
  `simulateNotConfigured` flags.
- `src/data/cloudBackup/encryption/{BackupEncryptionService,ExpoBackupEncryptionService,FakeBackupEncryptionService}.ts`
  — see "What was built" above.
- `src/data/cloudBackup/CloudBackupService.ts` — the use-case layer
  `cloudBackupStore` and the screens actually call. See "What was built" and
  "Architecture rule this phase enforces" above for the safety guarantees
  this class composes.
- `src/data/subscription/{CloudUpgradeService,PlaceholderCloudUpgradeService}.ts`
  — see "What was built" above.

### 3. Database changes

**No new table** — `backup_log` (Phase 11) is reused as-is; only its
TypeScript-level `BackupDestination` union gained `'cloud'` (`domain/backup/types.ts`),
which is a type-only change (the column itself was already free text — see
Phase 11's doc comment on it, written specifically to anticipate this).

**One extended table** — the same `app_settings` singleton row Phase 10/11
already extend gained five more columns, following the identical
additive/idempotent pattern:

- `cloud_backup_enabled INTEGER NOT NULL DEFAULT 0`
- `cloud_backup_plan_id TEXT` (nullable — null until the first successful
  `getStorageUsage()` call)
- `last_cloud_backup_at INTEGER`
- `last_cloud_backup_status TEXT`
- `last_cloud_backup_error TEXT`

**Fresh installs** get them from the updated `CREATE_TABLES_SQL`. **Existing
installs** get them backfilled by the same `ensureAppSettingsColumns()` step
Phase 11 introduced in `db/client.ts` — one more batch of entries in
`APP_SETTINGS_COLUMN_UPGRADES`, same mechanism, no changes needed to that
function itself. Canonical SQL regenerated via
`node node_modules/drizzle-kit/bin.cjs generate` →
`drizzle/0009_motionless_masked_marvel.sql` (five `ALTER TABLE app_settings ADD`
statements), matches the hand-written upgrades exactly (verified by hand).

New repository, following the established three-file pattern:

- `CloudBackupSettingsRepository` (`getSettings`/`saveSettings`/
  `recordAttempt`/`recordPlan`) — `InMemoryCloudBackupSettingsRepository`
  (mock) + `SqliteCloudBackupSettingsRepository` (real; shares `app_settings`
  with `SqliteSecurityRepository`/`SqliteBackupSettingsRepository`, writing
  only its five owned columns — the same "share one row without clobbering"
  guarantee Phase 2 established, now proven for a fourth feature sharing the
  same row). No Jest coverage for the Sqlite implementation, same reason as
  every other `Sqlite*Repository` in this codebase.
- `BackupRepository`/`BackupLogRepository` (Phase 11) are **reused
  unchanged** — no `SqliteCloudBackupRepository` or
  `SqliteCloudBackupLogRepository` was created; see "What was built".

### 4. API contracts

See "Backend files" above for the documented `CloudBackupApi` REST contract
— this is the shape a future backend would need to implement, written now
so the mobile-side integration (encryption, versioning, error handling,
storage-limit enforcement) doesn't have to change when that backend exists,
the same way Phase 1's documented-but-unbuilt share-link contract worked
out. `POST /v1/devices/register` is deliberately minimal — device-bound, no
user/password/billing fields — matching "do not implement a complicated
billing system."

### 5. Tests

708 Jest tests across 153 suites, all passing (`npx jest`, up from Phase
11's 638 across 141 — this phase added 70 tests across 12 new suites, plus
extended `SettingsScreen`/`AccountScreen` coverage); TypeScript strict-mode
`tsc --noEmit` is clean; a full Metro static export
(`expo export --platform android`) bundles the whole app (1600 modules, up
from Phase 11's 1588) with no resolution errors.

- **Domain** (`domain/cloudBackup/__tests__/`): `types.test.ts` (plan
  registry sanity — free plan not an upgrade target, upgrade-target plans
  have a larger limit, unknown-id fallback; empty-settings defaults;
  retention count is positive) and `formatting.test.ts` (usage
  text/ratio formatting, including the zero-limit divide-by-zero guard).
- **Encryption** (`data/cloudBackup/encryption/__tests__/FakeBackupEncryptionService.test.ts`):
  encrypt/decrypt round-trips, the envelope never equals the plaintext
  verbatim, an unsupported `alg` is rejected, and a simulated decrypt
  failure propagates.
- **Cloud API double** (`data/cloudBackup/__tests__/FakeCloudBackupApi.test.ts`):
  zero-usage-on-empty-plan, full upload/list/download/delete round-trip,
  **storage-limit enforcement** (an upload that would exceed the plan limit
  is rejected; the same upload succeeds after "upgrading" `planId`),
  offline/unavailable/not-configured typed errors, downloading a missing
  file, and `seedFile()`'s limit-check bypass.
- **Settings repository** (`data/cloudBackup/__tests__/InMemoryCloudBackupSettingsRepository.test.ts`):
  defaults, "saving the toggle doesn't clobber the remembered plan and vice
  versa" (the same "share one row" guarantee proven at the repository
  level), and "recording a failure never overwrites the last successful
  `lastCloudBackupAt`" (mirroring Phase 11's equivalent test).
- **Use-case layer** (`data/cloudBackup/__tests__/CloudBackupService.test.ts`,
  18 tests) — every brief-named scenario by name, mirroring
  `BackupService.test.ts`'s structure: disabled-gate failure (backup and
  restore), backup with no/large data, **the payload is verifiably
  encrypted before it reaches the cloud API** (the stored ciphertext never
  contains the plaintext customer name), offline/unavailable/not-configured,
  **storage limits** (an upload rejected by the API with
  `CloudStorageLimitExceededError` produces a clean failed `BackupLogEntry`,
  not a crash), retention pruning after success only, restore success/
  corrupted/incompatible-version/failed-mid-restore/undecryptable-envelope,
  and every attempt (backup and restore, success and failure) logged with
  `destination: 'cloud'`.
- **Subscription placeholder** (`data/subscription/__tests__/PlaceholderCloudUpgradeService.test.ts`):
  `getPlans()` returns the static registry; `requestUpgrade()` always
  resolves `'unavailable'` with an honest message, never throws, never calls
  the network.
- **Store** (`state/__tests__/cloudBackupStore.test.ts`, 10 tests): load,
  the enable/disable toggle (including that enabling awaits fresh storage
  usage/remote backups before resolving — see "Issues" below — and that
  disabling clears them), `backupNow()`/`restore()` success and failure
  paths, a storage-usage refresh surfacing an error without crashing, and
  `getUpgradePlans()`/`requestUpgrade()` delegation.
- **Screens**: `CloudBackupScreen.test.tsx` (disabled state with actions
  disabled; enabling saves immediately and loads storage usage; "Backup
  now" success alert; the last-failure reason shown inline; "Upgrade
  storage" navigation), `CloudBackupHistoryScreen.test.tsx` (disabled-state
  and empty-state messages; listing a remote backup and restoring it after
  confirming updates history; a failed history row shows its error; **a
  `google_drive`-destination log entry never leaks into the cloud history
  list** — the client-side `destination` filter is correct), and
  `UpgradeStorageScreen.test.tsx` (every plan listed; only upgrade-target
  plans show an "Upgrade" button; tapping it shows the honest placeholder
  message).
- **Regression checks**: `SettingsScreen.cloudBackup.test.tsx` (own file,
  matching the established one-section-per-file pattern) covers the new
  row's navigation; every other Phase 1–11 test file and assertion —
  including `AccountScreen.test.tsx`, whose "Subscription" heading and "no
  cloud account" assertions don't depend on the paragraph text that
  changed — is untouched and green. The full suite was re-run after every
  change in this phase.
- **Offline mode / app restart**: the *local* half (SQLite persistence via
  the reused `BackupRepository`, the settings repository) is proven exactly
  as thoroughly as every other phase's local persistence. The *encryption*
  half has real, native-module-backed logic
  (`ExpoBackupEncryptionService`) with **no Jest coverage** — same "no
  device in this environment" reasoning as `ExpoGoogleDriveBackupService`;
  its round-trip contract is instead proven via `FakeBackupEncryptionService`,
  used by every `CloudBackupService`/store/screen test. The *network* half
  (`RestCloudBackupApi`) has not been exercised against a real deployed
  backend — none exists yet (see "Known limitations").

### Manual verification (steps, to run on a device/simulator once a cloud backend exists)

1. Stand up the small backend `CloudBackupApi`'s doc comment documents
   (device registration + storage/backups endpoints), and set its URL as
   `expo.extra.cloudBackupApiUrl` in `app.json` (currently `""`). This step
   cannot be completed in this environment — no such backend exists yet.
2. Enable Airplane Mode, open the app → Settings → "Cloud backup" → confirm
   the screen loads with the toggle off and every action disabled/showing
   an honest "enable to see usage" message — no network call is attempted
   for anything but the toggle itself.
3. Disable Airplane Mode → turn "Enable cloud backup" on → confirm storage
   usage loads (0 used, the Free plan's limit) with no separate Save step.
4. Tap "Backup now" → confirm a success alert, "Last successful backup"
   updates, storage usage increases by roughly the encrypted payload size.
5. Enable Airplane Mode → tap "Backup now" again → confirm a clear
   "you're offline" failure, and "Last successful backup" still shows the
   step-4 time.
6. Disable Airplane Mode → change some data → "Backup history" → confirm
   the step-4 backup is listed → "Restore" it → confirm the destructive
   confirmation dialog → confirm the change reverts and the restore appears
   in history as a success.
7. Tap "Upgrade storage" → confirm every plan is listed, only "Plus" offers
   an "Upgrade" button, and tapping it shows the honest "not available yet"
   message rather than any checkout flow.
8. Confirm every Phase 1–11 screen/flow — Google Drive backup in particular
   — still works exactly as before, entirely independent of whatever cloud
   backup did in steps 2–7.

This wasn't run against a physical device/emulator or a real deployed
backend in this environment (neither is available here) — the local
persistence, encryption contract (via its Fake double), and orchestration
logic were verified as far as this environment allows (unit tests + strict
typecheck + full Metro bundle export), same as every prior phase.

### 6. Known limitations

- **No deployed cloud backend, and no device/emulator, in this
  environment.** `expo.extra.cloudBackupApiUrl` is left as `""`;
  `RestCloudBackupApi` throws `CloudBackupNotConfiguredError` from every
  method rather than attempting a request that could never succeed. Per
  `MVP_BUILD_PLAN.md` §10, which backend technology to actually build/deploy
  is still an open decision — this phase built the complete client-side
  contract and integration against it, not the server itself (matching the
  brief's own architecture diagram, which starts from "Mobile SQLite" and
  treats "Cloud API → Object storage" as the thing this app talks to, not
  builds).
- **No real payment/subscription provider is wired in** — by explicit
  instruction. `UpgradeStorageScreen`/`CloudUpgradeService` are honest
  placeholders; see "What was built" for the seam a real Stripe/RevenueCat/
  IAP integration would fill in later.
- **No automatic/opportunistic cloud backup runner** — unlike Google Drive
  backup's `AutoBackupRunner` (Phase 11), cloud backup only runs when a user
  taps "Backup now" or restores manually; the brief for this phase didn't
  name an automatic-trigger requirement the way Phase 11's did. Adding one
  later would be a small, additive `CloudAutoBackupRunner` following the
  exact pattern `AutoBackupRunner` already established — not a redesign.
- **The `cloudBackupEnabled` toggle gates restore as well as backup** — a
  deliberate design choice (mirrors Google Drive's "signed in" gate exactly)
  rather than a limitation, but worth noting: a user must re-enable cloud
  backup before restoring from it, even if they only want to restore once.
- **One backup file per attempt, no delta/incremental backups, retention of
  5** (`CLOUD_BACKUP_RETENTION_COUNT`, smaller than Google Drive's 10) —
  same "simple beats clever for this data volume" reasoning Phase 11 used,
  with a smaller number here because cloud storage is plan-limited rather
  than "the user's own Drive quota."
- **The AES-256-GCM encryption key lives only in this device's
  `expo-secure-store`, with no export/backup/recovery mechanism** — if the
  app's secure storage is cleared (e.g. app data wiped) independently of an
  actual reinstall-and-restore-from-Drive flow, previously uploaded cloud
  backups become permanently undecryptable from this device. This is the
  standard trade-off of on-device, zero-knowledge encryption (the cloud
  backend never has the key either); revisit only if a real
  passphrase-based recovery flow is explicitly requested later.
- **Device registration (`POST /v1/devices/register`) has no user identity
  at all** — it authenticates a device, not a person, matching "do not
  implement unnecessary account features." A user who reinstalls the app or
  switches devices gets a new, unrelated device token and cannot see their
  previous device's cloud backups from the new one. Revisit only if
  cross-device restore is explicitly requested (that would need a real
  account system, which is out of scope here by explicit instruction).

### 7. Files modified

New files: `src/domain/cloudBackup/{types,formatting}.ts` +
`__tests__/{types,formatting}.test.ts`,
`src/data/cloudBackup/{CloudBackupApi,FakeCloudBackupApi,RestCloudBackupApi,
CloudBackupSettingsRepository,InMemoryCloudBackupSettingsRepository,
SqliteCloudBackupSettingsRepository,CloudBackupService}.ts` +
`__tests__/{FakeCloudBackupApi,InMemoryCloudBackupSettingsRepository,
CloudBackupService}.test.ts`,
`src/data/cloudBackup/encryption/{BackupEncryptionService,
ExpoBackupEncryptionService,FakeBackupEncryptionService}.ts` +
`__tests__/FakeBackupEncryptionService.test.ts`,
`src/data/subscription/{CloudUpgradeService,PlaceholderCloudUpgradeService}.ts`
+ `__tests__/PlaceholderCloudUpgradeService.test.ts`,
`src/state/cloudBackupStore.ts` + `__tests__/cloudBackupStore.test.ts`,
`src/screens/cloudBackup/{CloudBackupScreen,CloudBackupHistoryScreen,
UpgradeStorageScreen}.tsx` + `__tests__/{CloudBackupScreen,
CloudBackupHistoryScreen,UpgradeStorageScreen}.test.tsx`,
`src/screens/settings/__tests__/SettingsScreen.cloudBackup.test.tsx`,
`drizzle/0009_motionless_masked_marvel.sql` (+ updated `drizzle/meta/`).

Modified files: `package.json` unchanged (no new dependency — `expo-crypto`
was already installed by Phase 11), `app.json` (added
`expo.extra.cloudBackupApiUrl`, currently `""`), `src/data/db/schema.ts`
(five new `app_settings` columns + `APP_SETTINGS_COLUMN_UPGRADES` entries;
`BackupDestination`-adjacent doc comment on `backupLog.destination`
updated), `src/domain/backup/types.ts` (`BackupDestination` gained
`'cloud'`), `src/data/container.ts` (`getCloudBackupSettingsRepository()`,
`getCloudBackupApi()`, `getBackupEncryptionService()`,
`getCloudBackupService()`, `getCloudUpgradeService()`),
`src/navigation/types.ts` (three new routes), `src/navigation/RootNavigator.tsx`
(three new screens registered), `src/screens/settings/SettingsScreen.tsx`
(one additive "Cloud backup" row + doc comment update),
`src/screens/settings/AccountScreen.tsx` (Subscription paragraph updated to
point at the real Cloud Backup screen), `MVP_BUILD_PLAN.md` (status header
+ "Open decisions" section updated to reflect what Phase 12 actually built
versus what's still not decided).

### 8. Issues

None outstanding. One race condition was caught and fixed during this
phase's own test-writing (not shipped): `cloudBackupStore.setCloudBackupEnabled()`
and `backupNow()` initially fired `refreshStorageUsage()`/`refreshRemoteBackups()`
without awaiting them (mirroring `load()`'s intentionally-best-effort,
un-awaited refreshes). For `load()` that's fine — it isn't the thing a
caller awaits to know "is state fully up to date." But for
`setCloudBackupEnabled()`/`backupNow()`, a test that awaited the action and
then immediately asserted on `storageUsage` caught a real race: a later
action (e.g. disabling, right after enabling) could finish and set state
*before* the earlier, un-awaited refresh resolved and overwrote it back.
Fixed by awaiting `Promise.all([refreshStorageUsage(), refreshRemoteBackups()])`
inside both of those two actions specifically — see the doc comment added
at that call site.

**Next phase:** Phase 13 — Global offline-first integration. Complete — see below.

---

## Phase 13 — Global Offline-First Integration

**Status:** Complete for the scope defined below. Built on explicit
instruction. This phase is an **audit + hardening pass across every
functionality built in Phases 1–12**, not a new feature — the working tree
was re-inspected functionality-by-functionality (Business, Digital Business
Card, QR, Items, Customers, Customer History, Invoices, Payments, Dashboard,
PDF) rather than assumed compliant, per the brief's explicit "audit the
complete application" instruction. Two real correctness bugs were found and
fixed (below); everything else audited was already offline-first by
construction from the phase that built it, because every prior phase's
checklist (`MVP_BUILD_PLAN.md` §8, steps I–L) already required testing
offline behavior, error states, loading states, and empty states before that
phase was marked complete. Nothing else was rewritten — this phase does not
re-architect working code, per "never overwrite working code without
understanding it first."

### 1. Audit method and scope

For each of the ten functionalities named in the brief, three questions were
checked against the actual source, not assumed:

1. **Does every read go through a local, database-first repository?** —
   traced from screen → Zustand store → repository interface →
   `data/container.ts`'s concrete binding.
2. **Is every write local, and does it survive being interrupted mid-way**
   (app killed, crash, storage-full) **without corrupting existing data?**
3. **Does any part of the flow require a network call to function at all**
   (not counting the three explicitly-optional, explicitly-isolated
   destinations: Google Drive backup, cloud backup, and the
   not-yet-built subscription seam)?

`data/container.ts` was read in full first: every functional repository
(`BusinessRepository`, `BusinessCardRepository`, `ItemRepository`,
`CustomerRepository`, `CustomerActivityRepository`, `InvoiceRepository`,
`PaymentRepository`, `PaymentTotalsRepository`, `DashboardRepository`,
`PdfService`, `ShareLinkService`/`InvoiceShareLinkService`) is bound to its
`Sqlite*`/`Local*` implementation, with **zero** `fetch`/`axios`/HTTP client
anywhere in those classes or their transitive dependencies (confirmed by
grepping the whole `src/` tree for `fetch(`, `axios`, `NetInfo`,
`navigator.onLine`, `XMLHttpRequest` — the only two hits are
`RestCloudBackupApi.ts` and `ExpoGoogleDriveBackupService.ts`, exactly the
two destinations the brief says must stay optional and isolated). This one
composition root is what makes "the local SQLite database is the source of
truth for normal app operation" a structural fact, not a policy someone
could accidentally violate screen-by-screen.

### 2. Findings and fixes — recovery from interrupted writes

The audit's one real finding: three multi-statement writes were **not**
wrapped in a SQLite transaction, unlike `SqliteBackupRepository.restoreAll()`
(Phase 11), which already established the correct pattern. An app kill,
crash, or storage-full error landing between the separate statements would
have left the database permanently inconsistent — exactly the failure mode
"recovery from interrupted writes" exists to rule out:

- **`SqliteInvoiceRepository.create()`** inserted the `invoice` header row,
  then separately inserted its `invoice_item` rows. Interrupted in between,
  the result was a real, visible invoice with **zero line items** — wrong
  totals everywhere it's summed (Invoice List, Invoice Detail, Dashboard,
  Customer History, PDF).
- **`SqliteInvoiceRepository.update()`** updated the header, then deleted
  every existing `invoice_item` row, then reinserted the new set (the
  documented "replace wholesale" strategy). Interrupted between the delete
  and the reinsert, an existing invoice **permanently lost all its line
  items** — worse than the create-path bug because it destroys previously
  good data, not just a fresh save.
- **`SqliteBusinessCardRepository.saveCard()`** saved the `business` row,
  then deleted every `social_link` row, then looped inserting the new set.
  Interrupted mid-loop, the business card **permanently lost its social
  links** (WhatsApp/Facebook/Instagram/Maps) — visible on the Digital Card,
  QR share text, and the shared link itself.

**Fix:** each now wraps its statements in one `db.transaction()` — the same
synchronous, `.run()`-based pattern `SqliteBackupRepository.restoreAll()`
(Phase 11) already used and documented (`drizzle-orm/expo-sqlite`'s
`db.transaction()` runs its callback synchronously against the native sync
API; the callback must stay a plain sync function using each query
builder's `.run()`, not `async`/`await`, or `COMMIT` could fire before the
writes inside actually finish — see that method's doc comment, now mirrored
by these three). A crash or storage-full error at any point inside the
callback now rolls the whole write back; the invoice or business card is
left exactly as it was before the call, never partially written. No schema
change, no new dependency, no behavior change on the happy path — purely an
atomicity fix. `SqliteCustomerRepository`, `SqliteItemRepository`,
`SqlitePaymentRepository`, `SqliteBusinessRepository`, and
`SqliteSecurityRepository` were each checked too and found to already issue
exactly one mutating statement per call (a single insert, update, or
delete) — nothing there needed a transaction, since a single SQLite
statement is already atomic by construction.

### 3. Verification per module

| Module | Reads | Writes | Search | Calculations | Network dependency |
|---|---|---|---|---|---|
| Business | `SqliteBusinessRepository` | Single-statement upserts | n/a | Invoice numbering (`formatNextInvoiceNumber`) is pure local math | None |
| Digital Business Card | `SqliteBusinessCardRepository` | Now transactional (fix above) | n/a | n/a | None — share link is a static device-generated `invora://` deep link (`LocalShareLinkService`, Phase 9), no hosted redirect |
| QR | Renders from the card's local share link | n/a | n/a | n/a | None — `react-native-qrcode-svg` draws the code entirely on-device as local SVG |
| Items | `SqliteItemRepository` | Single-statement | SQL `LIKE` on name/SKU/description | n/a | None |
| Customers | `SqliteCustomerRepository` | Single-statement | SQL `LIKE` on name/phone/email | n/a | None |
| Customer History | `InvoiceBackedCustomerActivityRepository` | Read-only (derives from Invoice/Payment tables) | n/a | Balance/activity summary (`domain/customer/activity.ts`) is pure local reduction over local invoice+payment rows | None — confirmed no API call anywhere in its call graph |
| Invoices | `SqliteInvoiceRepository` | Now transactional (fix above) | JS-side filter over locally-loaded rows (`domain/invoice/filtering.ts`) | Line totals, grand totals, status (`domain/invoice/calculations.ts`/`status.ts`) are pure local math | None |
| Payments | `SqlitePaymentRepository` | Single-statement | SQL `LIKE` on invoice #/customer/reference | Amount-paid sums (`domain/payment/calculations.ts`) are pure local math | None |
| Dashboard | `SqliteDashboardRepository` (dedicated aggregate SQL, see its own doc comment) | Read-only | n/a | Totals/paid/outstanding/overdue (`domain/dashboard/calculations.ts`) are pure local math over locally-aggregated rows | None — confirmed no API call anywhere in its call graph |
| PDF | Reads the invoice via the repositories above | Writes only a local file (`expo-print`'s `printToFileAsync`) | n/a | Reuses the same invoice calculation functions, so the PDF number and the on-screen number can never diverge | None — HTML is rendered to PDF entirely on-device, no remote fonts/images/API |

Loading/error/empty states were spot-checked across the list/detail screens
for every module above (`DashboardScreen`, `CustomerHistoryScreen`,
`InvoiceListScreen`, `ItemListScreen`, `CustomerListScreen`, and others) and
found already consistent: a three-state `'loading' | 'ready' | 'error'`
status per store, an `ActivityIndicator` for loading, a "Couldn't load…" +
"Try again" retry button for errors, and an explicit empty-state message
when `status === 'ready'` and the list is empty — all pre-existing from the
phase that built each screen, not added by this phase.

**Offline startup:** `App.tsx` opens the local SQLite database
(`getDatabase()`) as its only startup gate — a three-state `'loading' |
'ready' | 'error'` shown before `RootNavigator` ever mounts, with no network
call anywhere in that path. `AutoBackupRunner` (Google Drive) wraps the
navigator purely for its side effects and never gates or delays rendering;
`BackupService.backupNow()`/`CloudBackupService`'s equivalent already catch
every failure internally (including "offline") and record a failed
`BackupLogEntry` rather than throwing, so a foregrounded, offline device
triggering an opportunistic auto-backup check can never crash or block the
app — confirmed by reading `runAutomaticBackupIfDue()` and
`BackupService.backupNow()`'s `try`/`catch` in full.

**Recovery from interrupted writes (schema/migration level):** also checked
`data/db/client.ts`'s startup migration path — `CREATE_TABLES_SQL` uses
`CREATE TABLE IF NOT EXISTS` throughout, and `ensureBusinessColumns()`/
`ensureAppSettingsColumns()` check `PRAGMA table_info` per column before
adding it — both are already idempotent, so an app killed mid-startup, on
its very next launch, safely resumes from wherever it left off without
manual repair. No change needed here; confirmed correct as built in Phase
2/10/11.

### 4. Database changes

None. No schema change, no new table, no new column, no new migration file.
This phase changes *how* existing writes are grouped into statements, not
what they write.

### 5. Tests

No new test files — `SqliteInvoiceRepository`/`SqliteBusinessCardRepository`
have never had Jest coverage (Jest cannot drive the native SQLite module
without a device, same limitation noted in every other `Sqlite*Repository`
in this codebase; their query/transaction logic is a thin, mechanical layer
over Drizzle with no branching logic worth a fake). The full suite was run
after the fix to confirm no regression: **153 suites / 708 tests passing**,
plus a clean `tsc --noEmit` across the whole project (the `db.transaction()`
callback's `tx` parameter type was extracted directly from
`ReturnType<typeof getDrizzle>['transaction']` rather than hand-typed, so it
can never drift from Drizzle's actual signature).

Manual/airplane-mode verification this environment cannot run (no physical
device/emulator here, same limitation every prior phase has noted): with
Wi‑Fi and mobile data both off, exercise Business → Digital Card → QR →
Items → Customers → Customer Detail/History → create an Invoice → record a
Payment → Dashboard → Invoice PDF preview/share, confirming each screen
loads, saves, searches, and calculates with no spinner ever waiting on a
network call and no error message mentioning connectivity. Google Drive/
cloud backup screens are expected to show their existing "you're offline"
failure messages (Phases 11/12) — that is correct, isolated behavior, not a
regression.

### 6. Known limitations

- **No `db.transaction()` around `SqliteBusinessRepository`'s four
  read-modify-write methods** (`saveProfile`/`saveInvoiceSettings`/
  `saveInvoiceTypeSelection`/`reserveNextInvoiceNumber`) — each issues
  exactly one `INSERT` or one `UPDATE` statement (SQLite's own atomicity
  already covers a single statement), but there is a small
  check-then-write window between the `SELECT` that decides insert-vs-update
  and that statement. Two saves overlapping in that window is not a
  realistic scenario for a single-user, single-device, foreground-only app
  (nothing in this codebase runs a save from a background task or a second
  concurrent screen), so this was left as-is rather than adding
  synchronization the brief explicitly says not to introduce
  ("do not introduce unnecessary synchronization").
- **No automated device/emulator test of airplane-mode behavior** — same
  environment limitation every phase since Phase 1 has noted; verified as
  far as this environment allows via full-project `tsc`, the full Jest
  suite, and static tracing of every repository's call graph to confirm the
  absence of network calls (see §1).
- **`InvoiceRepository.list()`/`InvoiceBackedCustomerActivityRepository`
  still load full row sets into JS rather than filtering in SQL** — a
  pre-existing, already-documented tradeoff (see
  `SqliteInvoiceRepository`'s own doc comment) that has no offline
  implication (it is still 100% local) and was out of scope for this phase,
  which audits offline correctness, not query performance.

### 7. Files modified

Modified files: `src/data/invoice/SqliteInvoiceRepository.ts` (`create()`/
`update()` now run inside one `db.transaction()`, with line-row insertion
factored into a shared `insertLineRows(tx, ...)` helper),
`src/data/businessCard/SqliteBusinessCardRepository.ts` (`saveCard()` now
runs inside one `db.transaction()`), `IMPLEMENTATION_STATUS.md` (this
section).

### 8. Issues

None outstanding.

**Next phase:** Phase 14 — Google Stitch visual design integration. Not
started; waiting for explicit instruction, per the "never automatically
implement the next phase" rule.
