import type { PdfService } from './PdfService';

/**
 * The Jest-safe double for `PdfService` — `expo-print`/`expo-sharing`/
 * `expo-mail-composer` are native modules Jest can't drive without a device,
 * same reasoning every `Sqlite*Repository` in this codebase already
 * documents. Records every call so tests can assert on what a screen/store
 * asked for, and returns a deterministic fake `file://` URI instead of
 * actually rendering anything.
 */
export class FakePdfService implements PdfService {
  generatedHtml: string[] = [];
  previewedUris: string[] = [];
  sharedPdfCalls: { uri: string; options?: { dialogTitle?: string } }[] = [];
  emailCalls: { uri: string; options: { subject: string; body: string; recipients?: string[] } }[] = [];
  emailAvailable = true;
  private counter = 0;

  async generatePdf(html: string): Promise<string> {
    this.generatedHtml.push(html);
    this.counter += 1;
    return `file://fake/invoice-${this.counter}.pdf`;
  }

  async previewPdf(uri: string): Promise<void> {
    this.previewedUris.push(uri);
  }

  async sharePdf(uri: string, options?: { dialogTitle?: string }): Promise<void> {
    this.sharedPdfCalls.push({ uri, options });
  }

  async isEmailAvailable(): Promise<boolean> {
    return this.emailAvailable;
  }

  async shareViaEmail(
    uri: string,
    options: { subject: string; body: string; recipients?: string[] },
  ): Promise<void> {
    this.emailCalls.push({ uri, options });
  }
}
