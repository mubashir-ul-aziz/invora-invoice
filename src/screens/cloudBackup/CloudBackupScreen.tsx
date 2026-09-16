import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { formatBackupTimestamp, formatStorageUsage, storageUsageRatio } from '@/domain/cloudBackup/formatting';
import { getCloudStoragePlan } from '@/domain/cloudBackup/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCloudBackupStore } from '@/state/cloudBackupStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CloudBackup'>;

const SUCCESS_BG = '#DBFCEC';
const SUCCESS_FG = '#006243';
const WARNING_BG = '#FDF0DA';
const WARNING_FG = '#8A5A00';

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
 *
 * Restyled to match the Stitch "Cloud Backup" design's bento cards. Unlike
 * most Stitch mocks, its "AES-256-GCM" claim is real — `CloudBackupService`
 * genuinely encrypts every payload client-side via `ExpoBackupEncryptionService`
 * (native AES-256-GCM), so that badge is shown as-is rather than dropped.
 * Everything else Stitch invents around it has no backing data anywhere in
 * this app and is dropped rather than badged: the "Frankfurt Sovereign
 * Region (EU-1)" claim (`CloudBackupApi`'s REST contract has no region
 * concept — no backend is even deployed yet, see `CloudBackupNotConfiguredError`),
 * the per-category storage breakdown (invoices/attachments/ledger — only a
 * single `usedBytes`/`limitBytes` total exists), the "SHA-256 Checksum
 * matched & cryptographic signature intact" line (AES-GCM's built-in auth
 * tag gives integrity, but no separate checksum/signature step exists), and
 * the "zero-knowledge... cloud operators cannot view" marketing claim (no
 * cloud backend is deployed to verify this against). The storage-limit
 * warning and its Upgrade button are real, driven by the actual
 * usage ratio and the real `Plus` plan (`CLOUD_STORAGE_PLANS`) — replacing
 * Stitch's fabricated "50 GB or 200 GB" tiers.
 */
export function CloudBackupScreen({ navigation }: Props) {
  const { status, settings, storageUsage, history, error, load, setCloudBackupEnabled, backupNow } =
    useCloudBackupStore();

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
  const plusPlan = getCloudStoragePlan('plus');
  const ratio = storageUsage ? storageUsageRatio(storageUsage) : 0;
  const nearLimit = !!storageUsage && ratio >= 0.8 && plan?.id !== plusPlan.id;
  const backupsLogged = history.filter((entry) => entry.direction === 'backup' && entry.status === 'success').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="cloud-backup-screen">
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleIcon}>
            <Feather name="cloud" size={18} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Cloud backup</Text>
          <View style={[styles.statusPill, settings.cloudBackupEnabled ? styles.statusPillOn : styles.statusPillOff]}>
            <Text
              style={[
                styles.statusPillText,
                settings.cloudBackupEnabled ? styles.statusPillTextOn : styles.statusPillTextOff,
              ]}
            >
              {settings.cloudBackupEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>
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
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleIcon}>
            <Feather name="pie-chart" size={18} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Storage</Text>
        </View>
        {storageUsage ? (
          <>
            <Text style={styles.cardBody}>{formatStorageUsage(storageUsage)}</Text>
            <View style={styles.usageTrack}>
              <View style={[styles.usageFill, { width: `${ratio * 100}%` }, nearLimit && styles.usageFillWarning]} />
            </View>
            <Text style={styles.hint}>Plan: {plan?.label ?? 'Free'}</Text>
            <View style={styles.badgeRow}>
              <Feather name="lock" size={12} color={colors.textMuted} />
              <Text style={styles.badgeText}>Encrypted with AES-256-GCM on this device before upload</Text>
            </View>
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

      {nearLimit && (
        <View style={styles.warningCard} testID="cloud-backup-storage-warning">
          <Feather name="alert-triangle" size={18} color={WARNING_FG} />
          <View style={styles.flexShrink}>
            <Text style={styles.warningTitle}>Storage limit approaching</Text>
            <Text style={styles.warningBody}>
              Avoid interrupted backups — upgrade to the {plusPlan.label} plan for more room.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upgrade storage plan"
              onPress={() => navigation.navigate('UpgradeStorage')}
              style={({ pressed }) => [styles.warningButton, pressed && styles.pressed]}
            >
              <Text style={styles.warningButtonText}>Upgrade Storage Plan</Text>
              <Feather name="arrow-right" size={14} color={colors.primaryText} />
            </Pressable>
          </View>
        </View>
      )}

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
          icon="upload-cloud"
          variant="primary"
          onPress={handleBackupNow}
          disabled={!settings.cloudBackupEnabled || busy}
          testID="cloud-backup-now"
        />
      </View>
      {busy && <ActivityIndicator color={colors.primary} testID="cloud-backup-busy" />}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View cloud backup history"
        testID="cloud-backup-history-link"
        onPress={() => navigation.navigate('CloudBackupHistory')}
        style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
      >
        <View style={styles.navIcon}>
          <Feather name="clock" size={18} color={colors.primary} />
        </View>
        <View style={styles.flexShrink}>
          <Text style={styles.navLabel}>View Cloud Backup History</Text>
          <Text style={styles.navCaption}>
            {backupsLogged === 0 ? 'No backups logged yet' : `${backupsLogged} backup${backupsLogged === 1 ? '' : 's'} logged`}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>
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
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap: 10,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitleIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  cardBody: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 11, color: colors.textMuted },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillOn: { backgroundColor: SUCCESS_BG },
  statusPillOff: { backgroundColor: colors.background },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  statusPillTextOn: { color: SUCCESS_FG },
  statusPillTextOff: { color: colors.textMuted },

  usageTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  usageFill: { height: '100%', backgroundColor: colors.primary },
  usageFillWarning: { backgroundColor: WARNING_FG },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  badgeText: { fontSize: 11, color: colors.textMuted, flexShrink: 1 },

  warningCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: WARNING_BG,
    borderRadius: 14,
    padding: 14,
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: WARNING_FG },
  warningBody: { fontSize: 12, color: WARNING_FG, marginTop: 2 },
  warningButton: {
    marginTop: 10,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  warningButtonText: { fontSize: 13, fontWeight: '700', color: colors.primaryText },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  errorDetail: { fontSize: 12, color: colors.danger },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  navIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  navCaption: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
