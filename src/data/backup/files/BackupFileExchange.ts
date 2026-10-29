/** A file the user picked to import. */
export interface PickedBackupFile {
  uri: string;
  name: string;
  /** As reported by the picker; null when the platform didn't say. */
  sizeBytes: number | null;
}

/**
 * Only an explicit write to a folder the user chose is `'saved'`. Opening the
 * share sheet is never reported as saved — the OS doesn't tell the app what
 * (if anything) the user did with it.
 */
export type SaveCopyOutcome = 'saved' | 'cancelled' | 'unsupported';

/**
 * Moving backup files in and out of the app: the system share sheet, an
 * Android "save to a folder" write, and the document picker for imports.
 */
export interface BackupFileExchange {
  /** Opens the system share sheet for an existing file. Resolves when the sheet closes — which says nothing about whether a copy was saved. */
  shareFile(uri: string): Promise<void>;
  /** Writes `content` to a temporary file named `fileName` and opens the share sheet for it (used for Drive backups, which have no local file). */
  shareContent(fileName: string, content: string): Promise<void>;
  /** Android: asks the user for a folder (e.g. Downloads) and writes a copy there. iOS/web: `'unsupported'` — use the share sheet ("Save to Files"). */
  saveCopyToDevice(fileName: string, content: string): Promise<SaveCopyOutcome>;
  /** Opens the system document picker. Resolves null when the user cancels. */
  pickBackupFile(): Promise<PickedBackupFile | null>;
  readPickedFile(uri: string): Promise<string>;
  /** Best-effort cleanup of the picker's temporary copy. */
  discardPickedFile(uri: string): Promise<void>;
}
