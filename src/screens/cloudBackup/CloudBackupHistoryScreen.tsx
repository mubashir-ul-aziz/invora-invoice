import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatBackupSize, formatBackupTimestamp } from '@/domain/cloudBackup/formatting';
import type { BackupLogEntry } from '@/domain/backup/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCloudBackupStore } from '@/state/cloudBackupStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CloudBackupHistory'>;

/**
 * Lists every backup available to restore from cloud storage, and the
 * `backup_log` rows for this destination only (`entry.destination ===
 * 'cloud'` — the store already filters, see `cloudBackupStore.ts`). Mirrors
 * `BackupHistoryScreen` (Phase 11) exactly; restoring always goes through
 * `cloudBackupStore.restore()` → `CloudBackupService.restoreBackup()`, which
 * decrypts and validates the file before ever touching the local database.
 */
export function CloudBackupHistoryScreen({}: Props) {
  const { status, settings, remoteBackups, history, error, load, refreshRemoteBackups, refreshHistory, restore } =
    useCloudBackupStore();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (settings.cloudBackupEnabled) {
      refreshRemoteBackups();
    }
  }, [settings.cloudBackupEnabled, refreshRemoteBackups]);

  const handleRestore = (fileId: string, createdAt: string) => {
    Alert.alert(
      'Restore this backup?',
      `This replaces all data currently on this device with the cloud backup from ${formatBackupTimestamp(createdAt)}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            const entry = await restore(fileId);
            if (entry.status === 'success') {
              Alert.alert('Restore complete', 'Your data has been restored from cloud backup.');
            } else {
              Alert.alert('Restore failed', entry.errorMessage ?? 'Your existing data was not changed.');
            }
            refreshHistory();
          },
        },
      ],
    );
  };

  const busy = status === 'running';

  return (
    <FlatList
      testID="cloud-backup-history-screen"
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={history}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Available in cloud storage</Text>
          {!settings.cloudBackupEnabled && (
            <Text style={styles.emptyState} testID="cloud-backup-history-disabled">
              Enable cloud backup (from Cloud Backup) to see backups you can restore.
            </Text>
          )}
          {settings.cloudBackupEnabled && remoteBackups.length === 0 && (
            <Text style={styles.emptyState} testID="cloud-backup-history-no-remote">
              No cloud backups yet — use "Backup now" to create one.
            </Text>
          )}
          {settings.cloudBackupEnabled &&
            remoteBackups.map((file) => (
              <View key={file.id} style={styles.row} testID={`remote-cloud-backup-${file.id}`}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{formatBackupTimestamp(file.createdAt)}</Text>
                  <Text style={styles.rowSubtitle}>{formatBackupSize(file.sizeBytes)}</Text>
                </View>
                <ActionButton
                  label="Restore"
                  onPress={() => handleRestore(file.id, file.createdAt)}
                  disabled={busy}
                  testID={`restore-cloud-${file.id}`}
                />
              </View>
            ))}
          {busy && <ActivityIndicator color={colors.primary} testID="cloud-backup-history-busy" />}
          {!!error && (
            <Text style={styles.errorText} testID="cloud-backup-history-error">
              {error}
            </Text>
          )}

          <Text style={[styles.sectionHeader, styles.historyHeader]}>Backup &amp; restore history</Text>
          {history.length === 0 && (
            <Text style={styles.emptyState} testID="cloud-backup-history-empty">
              No cloud backup or restore attempts yet.
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => <HistoryRow entry={item} />}
    />
  );
}

function HistoryRow({ entry }: { entry: BackupLogEntry }) {
  const directionLabel = entry.direction === 'backup' ? 'Backup' : 'Restore';
  const triggerLabel = entry.trigger === 'manual' ? 'Manual' : 'Automatic';
  const totalRecords = entry.counts ? Object.values(entry.counts).reduce((sum, n) => sum + n, 0) : null;

  return (
    <View style={styles.historyRow} testID={`cloud-history-row-${entry.id}`}>
      <View style={styles.historyRowTop}>
        <Text style={styles.rowTitle}>
          {directionLabel} · {triggerLabel}
        </Text>
        <Text style={entry.status === 'success' ? styles.successBadge : styles.failureBadge}>
          {entry.status === 'success' ? 'Success' : 'Failed'}
        </Text>
      </View>
      <Text style={styles.rowSubtitle}>{formatBackupTimestamp(entry.startedAt)}</Text>
      {entry.status === 'success' && totalRecords !== null && (
        <Text style={styles.rowSubtitle}>
          {totalRecords} record{totalRecords === 1 ? '' : 's'} · {formatBackupSize(entry.sizeBytes)}
        </Text>
      )}
      {entry.status === 'failure' && !!entry.errorMessage && (
        <Text style={styles.errorText}>{entry.errorMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  section: { gap: 10 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  historyHeader: { marginTop: 16 },
  emptyState: { fontSize: 13, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.textMuted },
  errorText: { fontSize: 12, color: colors.danger },
  historyRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginBottom: 8,
  },
  historyRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successBadge: { fontSize: 11, fontWeight: '700', color: colors.primary },
  failureBadge: { fontSize: 11, fontWeight: '700', color: colors.danger },
});
