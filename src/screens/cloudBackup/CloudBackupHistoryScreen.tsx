import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatBackupSize, formatBackupTimestamp } from '@/domain/cloudBackup/formatting';
import type { BackupLogEntry, BackupTrigger } from '@/domain/backup/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCloudBackupStore } from '@/state/cloudBackupStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CloudBackupHistory'>;

const SUCCESS_BG = '#DBFCEC';
const SUCCESS_FG = '#006243';

type Filter = 'all' | BackupTrigger;

/**
 * Lists every backup available to restore from cloud storage, and the
 * `backup_log` rows for this destination only (`entry.destination ===
 * 'cloud'` — the store already filters, see `cloudBackupStore.ts`). Mirrors
 * `BackupHistoryScreen` (Phase 11) exactly; restoring always goes through
 * `cloudBackupStore.restore()` → `CloudBackupService.restoreBackup()`, which
 * decrypts and validates the file before ever touching the local database.
 *
 * Restyled to match the Stitch "Cloud Backup History" design's stat-ribbon +
 * filter-chip + grouped-row layout, same treatment as `BackupHistoryScreen`.
 * As with that screen, every element here maps to real store data:
 * - The stat ribbon's snapshot count and total size come from the real
 *   `remoteBackups` list.
 * - Filter chips (All/Automatic/Manual) filter the real `history` log.
 * - "Retry" on a failed backup entry re-runs the real `backupNow()`.
 * - The bottom "Trigger Immediate Cloud Backup" button also calls the real
 *   `backupNow()`.
 * Dropped rather than shown (no backing data): Stitch's "Invora Cloud (EU
 * Central)" region claim (no region concept exists in `CloudBackupApi`),
 * the "zero-knowledge" claim, the per-row "Snapshot Breakdown" preview grid
 * (remote files carry no counts before restoring), and the "SHA-256 digest
 * validation" line — replaced with the real, code-verified claim that
 * payloads are encrypted with AES-256-GCM (see `CloudBackupScreen`'s doc
 * comment for how that was confirmed).
 */
export function CloudBackupHistoryScreen({}: Props) {
  const {
    status,
    settings,
    remoteBackups,
    history,
    error,
    load,
    refreshRemoteBackups,
    refreshHistory,
    restore,
    backupNow,
  } = useCloudBackupStore();

  const [filter, setFilter] = useState<Filter>('all');

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

  const handleBackupNow = async () => {
    const entry = await backupNow();
    if (entry.status === 'success') {
      Alert.alert('Backup complete', 'Your data was backed up to cloud storage.');
    } else {
      Alert.alert('Backup failed', entry.errorMessage ?? 'Something went wrong.');
    }
    refreshRemoteBackups();
  };

  const handleRefresh = () => {
    load();
    if (settings.cloudBackupEnabled) refreshRemoteBackups();
  };

  const busy = status === 'running';

  const totalRemoteBytes = remoteBackups.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
  const counts = {
    all: history.length,
    manual: history.filter((h) => h.trigger === 'manual').length,
    automatic: history.filter((h) => h.trigger === 'automatic').length,
  };
  const filteredHistory = useMemo(
    () => (filter === 'all' ? history : history.filter((h) => h.trigger === filter)),
    [history, filter],
  );

  return (
    <FlatList
      testID="cloud-backup-history-screen"
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={filteredHistory}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={
        <View style={styles.section}>
          {/* Real stat ribbon — derived from remoteBackups, no fabricated region/quota data */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryIcon}>
                <Feather name="cloud" size={18} color={colors.primary} />
              </View>
              <Text style={styles.summaryTitle}>Invora Cloud Vault</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh backups"
                testID="cloud-backup-history-refresh"
                onPress={handleRefresh}
                style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
              >
                <Feather name="refresh-cw" size={16} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.summaryMetrics}>
              <View style={styles.summaryMetric}>
                <Feather name="archive" size={14} color={colors.textMuted} />
                <Text style={styles.summaryMetricText}>
                  {settings.cloudBackupEnabled
                    ? `${remoteBackups.length} snapshot${remoteBackups.length === 1 ? '' : 's'}`
                    : 'Not enabled'}
                </Text>
              </View>
              {settings.cloudBackupEnabled && remoteBackups.length > 0 && (
                <View style={styles.summaryMetric}>
                  <Feather name="pie-chart" size={14} color={colors.textMuted} />
                  <Text style={styles.summaryMetricText}>{formatBackupSize(totalRemoteBytes)} stored</Text>
                </View>
              )}
            </View>
          </View>

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
                <View style={styles.rowIcon}>
                  <Feather name="cloud" size={16} color={colors.primary} />
                </View>
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

          {/* Real filter chips over the real history log */}
          <View style={styles.chipRow}>
            <FilterChip label="All" count={counts.all} active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip
              label="Automatic"
              count={counts.automatic}
              active={filter === 'automatic'}
              onPress={() => setFilter('automatic')}
            />
            <FilterChip
              label="Manual"
              count={counts.manual}
              active={filter === 'manual'}
              onPress={() => setFilter('manual')}
            />
          </View>

          {history.length === 0 && (
            <Text style={styles.emptyState} testID="cloud-backup-history-empty">
              No cloud backup or restore attempts yet.
            </Text>
          )}
          {history.length > 0 && filteredHistory.length === 0 && (
            <Text style={styles.emptyState}>No {filter} attempts yet.</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <HistoryRow entry={item} onRetry={item.direction === 'backup' ? handleBackupNow : undefined} />
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          <ActionButton
            label={status === 'running' ? 'Uploading…' : 'Trigger Immediate Cloud Backup'}
            icon="upload-cloud"
            variant="primary"
            onPress={handleBackupNow}
            disabled={!settings.cloudBackupEnabled || busy}
            testID="cloud-backup-history-trigger-backup"
          />
          <View style={styles.footerNote}>
            <Feather name="lock" size={12} color={colors.textMuted} />
            <Text style={styles.footerNoteText}>Encrypted with AES-256-GCM before upload</Text>
          </View>
        </View>
      }
    />
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Filter: ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      <View style={[styles.chipCount, active && styles.chipCountActive]}>
        <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function HistoryRow({ entry, onRetry }: { entry: BackupLogEntry; onRetry?: () => void }) {
  const directionLabel = entry.direction === 'backup' ? 'Backup' : 'Restore';
  const triggerLabel = entry.trigger === 'manual' ? 'Manual' : 'Automatic';
  const totalRecords = entry.counts ? Object.values(entry.counts).reduce((sum, n) => sum + n, 0) : null;
  const failed = entry.status === 'failure';

  return (
    <View style={styles.historyRow} testID={`cloud-history-row-${entry.id}`}>
      <View style={[styles.historyIcon, failed && styles.historyIconFailed]}>
        <Feather name={failed ? 'alert-triangle' : 'check'} size={16} color={failed ? colors.danger : SUCCESS_FG} />
      </View>
      <View style={styles.flexShrink}>
        <View style={styles.historyRowTop}>
          <Text style={styles.rowTitle}>
            {directionLabel} · {triggerLabel}
          </Text>
          <Text style={failed ? styles.failureBadge : styles.successBadge}>{failed ? 'Failed' : 'Success'}</Text>
        </View>
        <Text style={styles.rowSubtitle}>{formatBackupTimestamp(entry.startedAt)}</Text>
        {!failed && totalRecords !== null && (
          <Text style={styles.rowSubtitle}>
            {totalRecords} record{totalRecords === 1 ? '' : 's'} · {formatBackupSize(entry.sizeBytes)}
          </Text>
        )}
        {failed && !!entry.errorMessage && <Text style={styles.errorText}>{entry.errorMessage}</Text>}
        {failed && !!onRetry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry backup"
            testID={`retry-cloud-${entry.id}`}
            onPress={onRetry}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Feather name="rotate-ccw" size={13} color={colors.primary} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0, gap: 2 },
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

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  refreshButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  summaryMetrics: { flexDirection: 'row', gap: 14 },
  summaryMetric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryMetricText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.primaryText },
  chipCount: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipCountText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  chipCountTextActive: { color: colors.primaryText },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  rowIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.textMuted },
  errorText: { fontSize: 12, color: colors.danger },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  historyIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: SUCCESS_BG, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  historyIconFailed: { backgroundColor: '#FBE4E2' },
  historyRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  successBadge: { fontSize: 11, fontWeight: '700', color: SUCCESS_FG },
  failureBadge: { fontSize: 11, fontWeight: '700', color: colors.danger },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start' },
  retryText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  footer: { gap: 8, marginTop: 8 },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  footerNoteText: { fontSize: 11, color: colors.textMuted },
});
