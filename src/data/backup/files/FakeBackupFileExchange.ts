import type { BackupFileExchange, PickedBackupFile, SaveCopyOutcome } from './BackupFileExchange';

/** Test double for `BackupFileExchange`: records what was shared/saved, and serves `nextPick` to the picker. */
export class FakeBackupFileExchange implements BackupFileExchange {
  sharedFiles: string[] = [];
  sharedContents: { fileName: string; content: string }[] = [];
  savedCopies: { fileName: string; content: string }[] = [];
  discarded: string[] = [];
  /** What the next `pickBackupFile()` returns (null = the user cancelled). */
  nextPick: (PickedBackupFile & { content: string }) | null = null;
  saveOutcome: SaveCopyOutcome = 'saved';
  shareError: Error | null = null;
  private picked = new Map<string, string>();

  async shareFile(uri: string): Promise<void> {
    if (this.shareError) throw this.shareError;
    this.sharedFiles.push(uri);
  }

  async shareContent(fileName: string, content: string): Promise<void> {
    if (this.shareError) throw this.shareError;
    this.sharedContents.push({ fileName, content });
  }

  async saveCopyToDevice(fileName: string, content: string): Promise<SaveCopyOutcome> {
    if (this.saveOutcome === 'saved') {
      this.savedCopies.push({ fileName, content });
    }
    return this.saveOutcome;
  }

  async pickBackupFile(): Promise<PickedBackupFile | null> {
    if (!this.nextPick) return null;
    const { content, ...file } = this.nextPick;
    this.picked.set(file.uri, content);
    return file;
  }

  async readPickedFile(uri: string): Promise<string> {
    const content = this.picked.get(uri) ?? (this.nextPick?.uri === uri ? this.nextPick.content : undefined);
    if (content === undefined) throw new Error('The selected file could not be read.');
    return content;
  }

  async discardPickedFile(uri: string): Promise<void> {
    this.discarded.push(uri);
  }
}
