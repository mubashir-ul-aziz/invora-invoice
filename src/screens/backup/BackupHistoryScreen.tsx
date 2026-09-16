import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatBackupSize, formatBackupTimestamp } from '@/domain/backup/formatting';
import type { BackupLogEntry, BackupTrigger } from '@/domain/backup/types';
import type { RootStackParamList } from '@/navigation/types';
import { useBackupStore } from '@/state/backupStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BackupHistory'>;

const SUCCESS_BG = '#DBFCEC';
const SUCCESS_FG = '#006243';

type Filter = 'all' | BackupTrigger;

/**
 * Lists every backup available to restore from Google Drive, and a read-only
 * log of every backup/restore attempt this device has made (success and
 * failure — see the doc comment on `backupLog` in `data/db/schema.ts`).
 * Restoring always goes through `backupStore.restore()` →
 * `BackupService.restoreBackup()`, which validates the file (version,
 * corruption) before ever touching the local database — see its doc
 * comment and the "IMPORTANT SAFETY RULE" in `MVP_BUILD_PLAN.md`.
 *
 * Restyled to match the Stitch "Backup History" design's summary card +
 * filter chips + grouped rows. Unlike most restyles, every element here
 * maps onto real store data, so nothing needed a DESIGN ONLY badge:
 * - The summary card's snapshot count and total size are computed from the
 *   real `remoteBackups` list, replacing Stitch's fabricated account
 *   email/"Active Sync" badge/fixed "/Invora_Backups/" path (no Drive
 *   account-profile or folder-path data exists anywhere in this app).
 * - The filter chips (All/Automatic/Manual) are real, filtering the real
 *   `history` log by its actual `trigger` field.
 * - The "Retry" action on a failed *backup* entry re-runs a real manual
 *   backup (`backupNow()`) — the same action "Backup now" already
 *   triggers. Failed *restore* entries don't offer Retry: `BackupLogEntry`
 *   doesn't record which remote file a restore attempt targeted, so there's
 *   nothing real to retry against.
 * - The bottom "Create Manual Backup Now" button also calls the same real
 *   `backupNow()` action, giving this screen a second real entry point to
 *   it (the "Encrypted Vault" label, per-row "Snapshot Contents" preview
 *   grid, and toast notifications in Stitch have no backing data/mechanism
 *   and are dropped rather than shown).
 */
export function BackupHistoryScreen({}: Props) {
  const {
    status,
    signedIn,
    remoteBackups,
    history,
    error,
    load,
    refreshRemoteBackups,
    refreshHistory,
    restore,
    backupNow,
  } = useBackupStore();

  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    load();
  }, [load]);

  // A separate effect (rather than folding this into the one above) because
  // `load()` is what actually resolves `signedIn` from the drive service —
  // on first mount it's still the pre-load default (`false`), so this must
  // re-run once `load()` finishes and flips it, not just once on mount.
  useEffect(() => {
    if (signedIn) {
      refreshRemoteBackups();
    }
  }, [signedIn, refreshRemoteBackups]);

  const handleRestore = (fileId: string, createdAt: string) => {
    Alert.alert(
      'Restore this backup?',
      `This replaces all data currently on this device with the backup from ${formatBackupTimestamp(createdAt)}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            const entry = await restore(fileId);
            if (entry.status === 'success') {
              Alert.alert('Restore complete', 'Your data has been restored from Google Drive.');
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
      Alert.alert('Backup complete', 'Your data was backed up to Google Drive.');
    } else {
      Alert.alert('Backup failed', entry.errorMessage ?? 'Something went wrong.');
    }
    refreshRemoteBackups();
  };

  const handleRefresh = () => {
    load();
    if (signedIn) refreshRemoteBackups();
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
      testID="backup-history-screen"
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={filteredHistory}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={
        <View style={styles.section}>
          {/* Real summary card — derived from remoteBackups, no fabricated account/quota data */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryIcon}>
                <Feather name="cloud" size={18} color={colors.primary} />
              </View>
              <Text style={styles.summaryTitle}>Google Drive</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh backups"
                testID="backup-history-refresh"
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
                  {signedIn ? `${remoteBackups.length} snapshot${remoteBackups.length === 1 ? '' : 's'}` : 'Not connected'}
                </Text>
              </View>
              {signedIn && remoteBackups.length > 0 && (
                <View style={styles.summaryMetric}>
                  <Feather name="pie-chart" size={14} color={colors.textMuted} />
                  <Text style={styles.summaryMetricText}>{formatBackupSize(totalRemoteBytes)} stored</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.sectionHeader}>Available on Google Drive</Text>
          {!signedIn && (
            <Text style={styles.emptyState} testID="backup-history-signed-out">
              Sign in with Google Drive (from Backup &amp; Restore) to see backups you can restore.
            </Text>
          )}
          {signedIn && remoteBackups.length === 0 && (
            <Text style={styles.emptyState} testID="backup-history-no-remote">
              No backups on Google Drive yet — use "Backup now" to create one.
            </Text>
          )}
          {signedIn &&
            remoteBackups.map((file) => (
              <View key={file.id} style={styles.row} testID={`remote-backup-${file.id}`}>
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
                  testID={`restore-${file.id}`}
                />
              </View>
            ))}
          {busy && <ActivityIndicator color={colors.primary} testID="backup-history-busy" />}
          {!!error && (
            <Text style={styles.errorText} testID="backup-history-error">
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
            <Text style={styles.emptyState} testID="backup-history-empty">
              No backup or restore attempts yet.
            </Text>
          )}
          {history.length > 0 && filteredHistory.length === 0 && (
            <Text style={styles.emptyState}>No {filter} attempts yet.</Text>
          )}
        </View>
      }
      renderItem={({ item }) => <HistoryRow entry={item} onRetry={item.direction === 'backup' ? handleBackupNow : undefined} />}
      ListFooterComponent={
        <ActionButton
          label={status === 'running' ? 'Backing up…' : 'Create Manual Backup Now'}
          icon="upload-cloud"
          variant="primary"
          onPress={handleBackupNow}
          disabled={!signedIn || busy}
          testID="backup-history-create-backup"
        />
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
    <View style={styles.historyRow} testID={`history-row-${entry.id}`}>
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
            testID={`retry-${entry.id}`}
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
});
