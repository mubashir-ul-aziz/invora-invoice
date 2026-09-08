/**
 * The one place invoice-PDF HTML generation escapes user-entered text before
 * interpolating it into a template string. Every field that ultimately came
 * from a form (business name, customer name/address, item name/description,
 * notes, terms, ...) goes through this first — otherwise a value containing
 * `<`/`&`/etc. (e.g. an item named `Nuts & Bolts`, or notes pasted with a
 * stray `<`) would corrupt the generated markup instead of just printing
 * literally, since `expo-print` renders this HTML in a real HTML engine.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `escapeHtml`, but also turns embedded newlines into `<br>` — for multi-line fields like Notes/Terms/Description. */
export function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}
