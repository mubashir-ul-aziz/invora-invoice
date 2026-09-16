import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { formatBackupSize, formatBackupTimestamp } from '@/domain/backup/formatting';
import type { RootStackParamList } from '@/navigation/types';
import { useBackupStore } from '@/state/backupStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Backup'>;

const SUCCESS_BG = '#DBFCEC';
const SUCCESS_FG = '#006243';

/**
 * "Backup & Restore" (Phase 11). Google Drive is a backup destination only —
 * never a live data source (`MVP_BUILD_PLAN.md` §4) — so every action here
 * either reads the local database to send it to Drive, or (via
 * `BackupHistoryScreen`) downloads a chosen Drive file and validates it
 * before ever touching the local database. See `BackupService`'s doc
 * comment for the safety guarantees behind these two buttons.
 *
 * Restyled to match the Stitch "Backup & Restore" design's bento cards.
 * The "Last Successful Backup" health card is real: it reads the most
 * recent successful entry from `history` (each `BackupLogEntry` already
 * stores real `sizeBytes` and per-table `counts` — see
 * `domain/backup/types.ts`), instead of Stitch's fabricated date/size/
 * counts. The account row (Stitch's "Alex Vance" name/email/avatar +
 * "Switch" button), the storage quota meter ("14.8 MB of 15 GB" — no
 * quota data exists), the AES-256 badge, the "Zero-Knowledge Guarantee"
 * card, and the GDPR/CCPA compliance footer are all dropped rather than
 * shown, since this app has no Drive account-profile, storage-quota, or
 * encryption capability at all (confirmed — `BackupService` does not
 * encrypt backup payloads) — same "never fake a backend feature/claim"
 * precedent as other restyled screens. "Backup Frequency" and "Include
 * PDF Attachments" have no backing setting (`BackupSettings` only has
 * `autoBackupEnabled`), so both are DESIGN ONLY.
 */
export function BackupScreen({ navigation }: Props) {
  const { status, signedIn, settings, history, error, load, signIn, signOut, setAutoBackupEnabled, backupNow } =
    useBackupStore();

  const [includePdfs, setIncludePdfs] = useState(true);

  useEffect(() => {
    load();
  }, [load]);

  const busy = status === 'loading' || status === 'running';

  const handleBackupNow = async () => {
    const entry = await backupNow();
    if (entry.status === 'success') {
      Alert.alert('Backup complete', 'Your data was backed up to Google Drive.');
    } else {
      Alert.alert('Backup failed', entry.errorMessage ?? 'Something went wrong.');
    }
  };

  const handleSignIn = async () => {
    await signIn();
  };

  const handleSignOut = () => {
    Alert.alert('Sign out of Google Drive?', 'You can sign back in any time — your existing backups stay on Drive.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const notAvailable = (what: string) => Alert.alert('Not available', `${what} is not implemented yet.`);

  const lastSuccess = history.find((entry) => entry.direction === 'backup' && entry.status === 'success');
  const backupsLogged = history.filter((entry) => entry.direction === 'backup' && entry.status === 'success').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="backup-screen">
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleIcon}>
            <Feather name="cloud" size={18} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Google Drive Sync</Text>
          <View style={[styles.statusPill, signedIn ? styles.statusPillOn : styles.statusPillOff]}>
            <Text style={[styles.statusPillText, signedIn ? styles.statusPillTextOn : styles.statusPillTextOff]}>
              {signedIn ? 'Connected' : 'Not connected'}
            </Text>
          </View>
        </View>
        {signedIn ? (
          <>
            <Text style={styles.cardBody}>Signed in — backups are stored in your Drive's private app folder.</Text>
            <ActionButton label="Sign out" onPress={handleSignOut} testID="backup-sign-out" />
          </>
        ) : (
          <>
            <Text style={styles.cardBody}>Sign in with Google to back up and restore your data.</Text>
            <ActionButton
              label="Sign in with Google"
              variant="primary"
              onPress={handleSignIn}
              disabled={busy}
              testID="backup-sign-in"
            />
          </>
        )}
      </View>

      <View style={styles.card} testID="backup-status-card">
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleIcon}>
            <Feather name="check-circle" size={18} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Last Successful Backup</Text>
        </View>
        {lastSuccess ? (
          <>
            <Text style={styles.cardBody}>{formatBackupTimestamp(lastSuccess.startedAt)}</Text>
            <View style={styles.chipRow}>
              <Chip label={`Archive: ${formatBackupSize(lastSuccess.sizeBytes)}`} />
              {!!lastSuccess.counts && (
                <>
                  <Chip label={`${lastSuccess.counts.invoices} Invoices`} />
                  <Chip label={`${lastSuccess.counts.customers} Customers`} />
                  <Chip label={`${lastSuccess.counts.items} Items`} />
                </>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.cardBody}>No successful backup yet.</Text>
        )}
        <SummaryRow
          label="Last attempt"
          value={
            settings.lastBackupStatus === 'success'
              ? 'Succeeded'
              : settings.lastBackupStatus === 'failure'
                ? 'Failed'
                : 'Never attempted'
          }
        />
        {settings.lastBackupStatus === 'failure' && !!settings.lastBackupError && (
          <Text style={styles.errorDetail} testID="backup-last-error">
            {settings.lastBackupError}
          </Text>
        )}
        {status === 'error' && !!error && (
          <Text style={styles.errorDetail} testID="backup-error">
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
          disabled={!signedIn || busy}
          testID="backup-now"
        />
      </View>
      {busy && <ActivityIndicator color={colors.primary} testID="backup-busy" />}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Automated Backups</Text>
        <FieldToggleRow
          icon="refresh-cw"
          label="Automatic Daily Backup"
          description="Runs once a day while the app is open and you're online"
          checked={settings.autoBackupEnabled}
          disabled={!signedIn}
          disabledHint="Sign in with Google first"
          onToggle={() => setAutoBackupEnabled(!settings.autoBackupEnabled)}
          testID="backup-auto-toggle"
        />
        {/* DESIGN ONLY: BackupSettings has no configurable frequency — backups always run opportunistically once a day. */}
        <ValueRow
          icon="clock"
          label="Backup Frequency · DESIGN ONLY"
          value="Daily"
          onPress={() => notAvailable('Choosing a backup frequency')}
          testID="action-backup-frequency-design-only"
        />
        {/* DESIGN ONLY: backups always archive full database tables; there's no separate PDF-attachment inclusion setting. */}
        <FieldToggleRow
          icon="file-text"
          label="Include PDF Attachments · DESIGN ONLY"
          description="Archive generated invoice PDFs alongside the database"
          checked={includePdfs}
          onToggle={() => setIncludePdfs((v) => !v)}
          testID="toggle-include-pdfs-design-only"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View snapshot history"
        testID="backup-history-link"
        onPress={() => navigation.navigate('BackupHistory')}
        style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
      >
        <View style={styles.navIcon}>
          <Feather name="clock" size={18} color={colors.primary} />
        </View>
        <View style={styles.flexShrink}>
          <Text style={styles.navLabel}>View Snapshot History</Text>
          <Text style={styles.navCaption}>
            {backupsLogged === 0 ? 'No backups logged yet' : `${backupsLogged} backup${backupsLogged === 1 ? '' : 's'} logged`}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>

      {/* DESIGN ONLY: restoring from an offline .invora file isn't implemented — restore only works from a Drive file (see Backup History). */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="rotate-ccw" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Disaster Recovery</Text>
        </View>
        <Text style={styles.cardBody}>
          Need to migrate to a new device or recover deleted records? Restore an earlier snapshot from Google Drive, or
          load an offline archive directly.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore from file — DESIGN ONLY, not implemented"
          testID="action-restore-from-file-design-only"
          onPress={() => notAvailable('Restoring from an offline .invora file')}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <Feather name="upload" size={16} color={colors.primary} />
          <Text style={styles.textButtonLabel}>Restore from File (.invora) · DESIGN ONLY</Text>
        </Pressable>
      </View>
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

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function ValueRow({
  icon,
  label,
  value,
  onPress,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} — DESIGN ONLY, not implemented`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.valueRow, pressed && styles.pressed]}
    >
      <View style={styles.valueIcon}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.valueLabel}>{label}</Text>
      <View style={styles.valueRight}>
        <Text style={styles.valueText}>{value}</Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 11, color: colors.text, fontWeight: '600' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  errorDetail: { fontSize: 12, color: colors.danger },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  valueIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  valueLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  valueRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { fontSize: 12, color: colors.textMuted },

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

  textButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  textButtonLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
