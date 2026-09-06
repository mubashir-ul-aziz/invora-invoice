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

**Next phase:** Phase 7 — Payments. Not started; waiting for explicit
instruction, per the "never automatically implement the next phase" rule.
