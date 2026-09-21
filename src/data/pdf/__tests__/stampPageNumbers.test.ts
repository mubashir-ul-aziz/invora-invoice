import { PDFDocument, PDFPage } from 'pdf-lib';

import { stampPageNumbers } from '../stampPageNumbers';

async function blankPdf(pageCount: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([612, 792]);
  }
  return doc.saveAsBase64();
}

describe('stampPageNumbers', () => {
  it.each([1, 2, 5])('keeps all %i page(s) and page size intact', async (pageCount) => {
    const stamped = await stampPageNumbers(await blankPdf(pageCount));
    const doc = await PDFDocument.load(stamped);
    expect(doc.getPageCount()).toBe(pageCount);
    doc.getPages().forEach((page) => expect(page.getSize()).toEqual({ width: 612, height: 792 }));
  });

  it('writes "Page N of M" at the bottom-left of every page', async () => {
    const drawText = jest.spyOn(PDFPage.prototype, 'drawText');
    try {
      await stampPageNumbers(await blankPdf(3));
      expect(drawText.mock.calls.map(([text]) => text)).toEqual(['Page 1 of 3', 'Page 2 of 3', 'Page 3 of 3']);
      drawText.mock.calls.forEach(([, options]) => {
        expect(options?.x).toBe(30);
        expect(options?.y).toBe(12);
      });
    } finally {
      drawText.mockRestore();
    }
  });
});
