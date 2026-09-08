/**
 * Every device-native operation the PDF/Sharing functionality needs, behind
 * one interface — same "screens/stores depend on an interface, never a
 * concrete native module" rule every other repository/service in this
 * codebase follows (see `ShareLinkService`, `PaymentTotalsRepository`, ...).
 * `ExpoPdfService` is the only real implementation (backed by `expo-print` /
 * `expo-sharing` / `expo-mail-composer`) and, like every other native-backed
 * class in this codebase (`Sqlite*Repository`), has no Jest coverage — Jest
 * can't drive these native modules without a device. `FakePdfService` is the
 * Jest-safe double every store/screen test injects instead.
 */
export interface PdfService {
  /** Renders an HTML string to a local PDF file and returns its `file://` URI. Purely local — no network call, per "PDF generation must work offline". */
  generatePdf(html: string): Promise<string>;
  /** Opens the OS's native print/preview UI for an already-generated PDF file — this **is** the "PDF preview" surface: the user sees the real, rendered PDF (with the OS's own Share/Print actions available from inside it), not an in-app re-implementation of a PDF renderer. */
  previewPdf(uri: string): Promise<void>;
  /** Opens the native share sheet for a PDF file — surfaces WhatsApp/Mail/Drive/etc. as OS-provided share targets, per "sharing should use native mobile sharing capabilities". */
  sharePdf(uri: string, options?: { dialogTitle?: string }): Promise<void>;
  /** Whether a mail app is configured on this device — checked before offering "Share via Email" so a device with none doesn't show a dead-end button. */
  isEmailAvailable(): Promise<boolean>;
  /** Opens the native email composer with the PDF attached and the subject/body/recipient pre-filled. */
  shareViaEmail(
    uri: string,
    options: { subject: string; body: string; recipients?: string[] },
  ): Promise<void>;
}
