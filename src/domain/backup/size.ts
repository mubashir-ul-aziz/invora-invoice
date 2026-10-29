/** Bytes `content` takes as UTF-8 (what it occupies on disk / over the wire), without needing `TextEncoder`. */
export function utf8ByteLength(content: string): number {
  let bytes = 0;
  for (let i = 0; i < content.length; i += 1) {
    const code = content.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < content.length) {
      // A surrogate pair is one 4-byte code point.
      bytes += 4;
      i += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}
