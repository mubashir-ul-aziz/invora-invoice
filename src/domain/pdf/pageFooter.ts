/**
 * Empty strip kept free at the bottom of every PDF page for the "Page N of M"
 * label that `stampPageNumbers` draws afterwards. `expo-print` prints with
 * zero page margins (the body's own margin only applies to the first and last
 * page), so without this a full page's last table row would run straight
 * into the label. Only the bottom edge is affected — top/left/right stay as
 * they were.
 *
 * Applied twice because the two platforms honour different mechanisms: as a
 * CSS `@page` bottom margin (Android's Chromium print) and as expo-print's
 * native `margins.bottom` (iOS). The value is deliberately a little taller
 * than the label needs (label top sits ~19pt above the page bottom), so it
 * still clears even if a CSS px renders slightly under 1pt.
 */
export const PDF_FOOTER_RESERVE = 28;
