import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { formatBackupTimestamp, formatStorageUsage, storageUsageRatio } from '@/domain/cloudBackup/formatting';
import { getCloudStoragePlan } from '@/domain/cloudBackup/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCloudBackupStore } from '@/state/cloudBackupStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CloudBackup'>;

/**
 * Optional Cloud Backup (Phase 12) — a **second, independent** backup
 * destination alongside Google Drive (Phase 11), per `MVP_BUILD_PLAN.md`
 * §4/§10. Nothing here is a live data source, and nothing here is required
 * for the app to work: every action below is additive on top of the local
 * SQLite database, and if cloud backup is unreachable/unconfigured
 * (`CloudBackupNotConfiguredError`/`CloudBackupOfflineError`/
 * `CloudBackupUnavailableError`), that's surfaced as a plain inline message
 * — never a crash, and never something that blocks any other screen in the
 * app.
 */
export function CloudBackupScreen({ navigation }: Props) {
  const {
    status,
    settings,
    storageUsage,
    error,
    load,
    setCloudBackupEnabled,
    backupNow,
  } = useCloudBackupStore();

  useEffect(() => {
    load();
  }, [load]);

  const busy = status === 'loading' || status === 'running';

  const handleBackupNow = async () => {
    const entry = await backupNow();
    if (entry.status === 'success') {
      Alert.alert('Backup complete', 'Your data was backed up to cloud storage.');
    } else {
      Alert.alert('Backup failed', entry.errorMessage ?? 'Something went wrong.');
    }
  };

  const plan = storageUsage
    ? getCloudStoragePlan(storageUsage.planId)
    : settings.planId
      ? getCloudStoragePlan(settings.planId)
      : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="cloud-backup-screen">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cloud backup</Text>
        <Text style={styles.cardBody}>
          Optional, paid cloud backup — a second copy of your data, separate from Google Drive. Your local data on
          this device is always the source of truth.
        </Text>
        <FieldToggleRow
          label="Enable cloud backup"
          checked={settings.cloudBackupEnabled}
          onToggle={() => setCloudBackupEnabled(!settings.cloudBackupEnabled)}
          testID="cloud-backup-toggle"
        />
      </View>

      <View style={styles.card} testID="cloud-backup-storage-card">
        <Text style={styles.cardTitle}>Storage</Text>
        {storageUsage ? (
          <>
            <Text style={styles.cardBody}>{formatStorageUsage(storageUsage)}</Text>
            <View style={styles.usageTrack}>
              <View style={[styles.usageFill, { width: `${storageUsageRatio(storageUsage) * 100}%` }]} />
            </View>
            <Text style={styles.hint}>Plan: {plan?.label ?? 'Free'}</Text>
          </>
        ) : (
          <Text style={styles.cardBody} testID="cloud-backup-storage-unknown">
            {settings.cloudBackupEnabled
              ? "Storage usage isn't available right now."
              : 'Enable cloud backup to see your storage usage.'}
          </Text>
        )}
        <ActionButton
          label="Upgrade storage"
          onPress={() => navigation.navigate('UpgradeStorage')}
          testID="cloud-backup-upgrade"
        />
      </View>

      <View style={styles.card} testID="cloud-backup-status-card">
        <Text style={styles.cardTitle}>Status</Text>
        <SummaryRow label="Last successful backup" value={formatBackupTimestamp(settings.lastCloudBackupAt)} />
        <SummaryRow
          label="Last attempt"
          value={
            settings.lastCloudBackupStatus === 'success'
              ? 'Succeeded'
              : settings.lastCloudBackupStatus === 'failure'
                ? 'Failed'
                : 'Never attempted'
          }
        />
        {settings.lastCloudBackupStatus === 'failure' && !!settings.lastCloudBackupError && (
          <Text style={styles.errorDetail} testID="cloud-backup-last-error">
            {settings.lastCloudBackupError}
          </Text>
        )}
        {status === 'error' && !!error && (
          <Text style={styles.errorDetail} testID="cloud-backup-error">
            {error}
          </Text>
        )}
      </View>

      <View style={styles.row}>
        <ActionButton
          label={status === 'running' ? 'Backing up…' : 'Backup now'}
          variant="primary"
          onPress={handleBackupNow}
          disabled={!settings.cloudBackupEnabled || busy}
          testID="cloud-backup-now"
        />
        <ActionButton
          label="Restore backup"
          onPress={() => navigation.navigate('CloudBackupHistory')}
          disabled={!settings.cloudBackupEnabled || busy}
          testID="cloud-backup-restore"
        />
        <ActionButton
          label="Backup history"
          onPress={() => navigation.navigate('CloudBackupHistory')}
          testID="cloud-backup-history-link"
        />
      </View>

      {busy && <ActivityIndicator color={colors.primary} testID="cloud-backup-busy" />}
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 11, color: colors.textMuted },
  usageTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  usageFill: { height: '100%', backgroundColor: colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  errorDetail: { fontSize: 12, color: colors.danger },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
