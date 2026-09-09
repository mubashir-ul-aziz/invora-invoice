/**
 * Local, dependency-free id/slug generator. Good enough for single-device
 * primary keys and share-link slugs; not a cryptographic UUID. If/when
 * records need to be globally unique across devices (e.g. a synced backend),
 * swap this for a real UUID at the repository boundary — nothing above it
 * needs to change.
 */
export function generateLocalId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${random}`;
}

/**
 * Generates a unique-enough 6-digit business id (e.g. `"483920"`) — always
 * exactly 6 digits, never leading-zero-stripped since it's a string. Assigned
 * once when a business row is first created (see `SqliteBusinessRepository`/
 * `InMemoryBusinessRepository`) and never regenerated afterwards; it's the
 * fixed half of every invoice number that business ever issues (see
 * `domain/business/types.ts`'s `formatNextInvoiceNumber`).
 */
export function generateBusinessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
