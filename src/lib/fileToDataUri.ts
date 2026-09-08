import * as FileSystem from 'expo-file-system/legacy';

/** Guesses an image MIME type from a file's extension — good enough for the handful of formats `expo-image-picker` can hand back. */
function guessImageMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Reads a local image file (e.g. the business logo, picked via
 * `expo-image-picker`) and returns it as a `data:` URI. Used so the
 * invoice-PDF HTML never references a bare `file://` path — `expo-print`'s
 * rendering engine resolving an arbitrary local file path is not guaranteed
 * across platforms, while a base64-embedded `data:` URI works the same way
 * everywhere and keeps PDF generation fully self-contained and offline (no
 * network fetch, no dependency on the file still being at that path later).
 *
 * Never throws: a missing/unreadable file (or `logoUri` being null) resolves
 * to `null`, and the PDF is generated without a logo rather than failing to
 * generate at all.
 */
export async function resolveLogoDataUri(logoUri: string | null): Promise<string | null> {
  if (!logoUri) {
    return null;
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: 'base64' });
    return `data:${guessImageMimeType(logoUri)};base64,${base64}`;
  } catch {
    return null;
  }
}
