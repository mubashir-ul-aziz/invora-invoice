import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * `expo-print` renders HTML with the platform's native web view and offers no
 * running footer, and the total page count isn't known until the PDF has been
 * laid out — so "Page X of Y" is stamped onto the finished PDF instead.
 *
 * Placement mirrors the invoice HTML's own styling (see `renderInvoiceHtml`):
 * x matches the body's 30px left margin, the colour/size match `.muted`
 * (#666, one step smaller like every other PDF font), and the text sits in the
 * bottom margin strip so it stays clear of the invoice content.
 */
const FONT_SIZE = 7.5;
const LEFT_OFFSET = 30;
const BOTTOM_OFFSET = 12;
const TEXT_COLOR = rgb(0x66 / 255, 0x66 / 255, 0x66 / 255);

/** Takes a base64-encoded PDF and returns it (base64) with "Page N of M" at the bottom-left of every page. */
export async function stampPageNumbers(pdfBase64: string): Promise<string> {
  const doc = await PDFDocument.load(pdfBase64);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, index) => {
    // Honour a non-zero page origin (crop/media box offset) so the label is always inside the visible page.
    const { x, y } = page.getMediaBox();
    page.drawText(`Page ${index + 1} of ${total}`, {
      x: x + LEFT_OFFSET,
      y: y + BOTTOM_OFFSET,
      size: FONT_SIZE,
      font,
      color: TEXT_COLOR,
    });
  });

  return doc.saveAsBase64();
}
