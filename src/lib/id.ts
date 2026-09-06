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
