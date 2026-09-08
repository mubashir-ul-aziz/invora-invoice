import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { PdfService } from './PdfService';

/**
 * The real, device-native implementation — see the doc comment on
 * `PdfService`. `printToFileAsync` renders the given HTML entirely on-device
 * (no network call), so PDF generation works offline exactly like every
 * other functionality in this codebase.
 */
export class ExpoPdfService implements PdfService {
  async generatePdf(html: string): Promise<string> {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return uri;
  }

  async previewPdf(uri: string): Promise<void> {
    await Print.printAsync({ uri });
  }

  async sharePdf(uri: string, options?: { dialogTitle?: string }): Promise<void> {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: options?.dialogTitle,
    });
  }

  async isEmailAvailable(): Promise<boolean> {
    return MailComposer.isAvailableAsync();
  }

  async shareViaEmail(
    uri: string,
    options: { subject: string; body: string; recipients?: string[] },
  ): Promise<void> {
    await MailComposer.composeAsync({
      recipients: options.recipients,
      subject: options.subject,
      body: options.body,
      attachments: [uri],
    });
  }
}
