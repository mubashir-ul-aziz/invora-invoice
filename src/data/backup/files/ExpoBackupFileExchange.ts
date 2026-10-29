import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { BackupFileExchange, PickedBackupFile, SaveCopyOutcome } from './BackupFileExchange';

const JSON_MIME = 'application/json';

/**
 * Real `BackupFileExchange` (`expo-sharing`, `expo-document-picker`, and the
 * Storage Access Framework from `expo-file-system/legacy` on Android). No
 * Jest coverage (native modules).
 */
export class ExpoBackupFileExchange implements BackupFileExchange {
  async shareFile(uri: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(uri, { mimeType: JSON_MIME, UTI: 'public.json', dialogTitle: 'Metriqo backup' });
  }

  async shareContent(fileName: string, content: string): Promise<void> {
    if (!FileSystem.cacheDirectory) {
      throw new Error('Temporary storage is not available on this device.');
    }
    // Drive file names come from the server: keep them from escaping the cache folder.
    const safeName = fileName.replace(/[^\w.-]/g, '_') || 'metriqo-backup.json';
    const uri = `${FileSystem.cacheDirectory}${safeName}`;
    await FileSystem.writeAsStringAsync(uri, content);
    try {
      await this.shareFile(uri);
    } finally {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  }

  async saveCopyToDevice(fileName: string, content: string): Promise<SaveCopyOutcome> {
    if (Platform.OS !== 'android') {
      return 'unsupported';
    }
    const { StorageAccessFramework } = FileSystem;
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      return 'cancelled';
    }
    // Android adds the extension for the MIME type itself.
    const uri = await StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      fileName.replace(/\.json$/i, ''),
      JSON_MIME,
    );
    await FileSystem.writeAsStringAsync(uri, content);
    return 'saved';
  }

  async pickBackupFile(): Promise<PickedBackupFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
      // Many file managers and download folders report `.json` files as
      // `application/octet-stream` or `text/plain`, so filtering strictly on
      // `application/json` would grey out real backups. The content is
      // validated before anything is restored.
      type: Platform.OS === 'ios' ? ['public.json', 'public.plain-text', 'public.data'] : '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) {
      return null;
    }
    const asset = result.assets[0];
    return { uri: asset.uri, name: asset.name, sizeBytes: typeof asset.size === 'number' ? asset.size : null };
  }

  async readPickedFile(uri: string): Promise<string> {
    return FileSystem.readAsStringAsync(uri);
  }

  async discardPickedFile(uri: string): Promise<void> {
    if (FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory)) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  }
}
