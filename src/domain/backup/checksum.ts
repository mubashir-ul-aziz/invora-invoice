/**
 * A small, dependency-free, deterministic checksum — good enough to catch a
 * truncated/corrupted/interrupted backup file (the "PROTECT AGAINST" list in
 * `MVP_BUILD_PLAN.md`), not a cryptographic guarantee. Adding a real hashing
 * library (e.g. `expo-crypto`'s SHA-256) for a stronger guarantee is possible
 * later without changing anything outside this file — every caller only sees
 * `computeChecksum(json) -> string`.
 *
 * Implementation: a 32-bit FNV-1a hash over the UTF-16 code units of the
 * input, returned as an 8-character hex string. Any single-byte corruption,
 * truncation, or reordering in a JSON payload of the size a small business's
 * data reaches changes the hash with overwhelming probability.
 */
export function computeChecksum(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    // 32-bit FNV prime multiplication, done with shifts/adds to stay within
    // safe-integer arithmetic (JS numbers, no BigInt needed for a 32-bit hash).
    hash =
      (hash +
        ((hash << 1) >>> 0) +
        ((hash << 4) >>> 0) +
        ((hash << 7) >>> 0) +
        ((hash << 8) >>> 0) +
        ((hash << 24) >>> 0)) >>>
      0;
  }
  return hash.toString(16).padStart(8, '0');
}
