import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { formatBackupSize, formatBackupTimestamp } from '@/domain/backup/formatting';
import type { RootStackParamList } from '@/navigation/types';
import { useBackupStore } from '@/state/backupStore';
import { toast } from '@/state/toastStore';
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
 * precedent as other restyled screens.
 */
export function BackupScreen({ navigation }: Props) {
  const { status, signedIn, settings, history, error, load, signIn, signOut, setAutoBackupEnabled, backupNow } =
    useBackupStore();

  useEffect(() => {
    load();
  }, [load]);

  const busy = status === 'loading' || status === 'running';

  const handleBackupNow = async () => {
    const entry = await backupNow();
    if (entry.status === 'success') {
      toast.success({ title: 'Backup complete', message: 'Your data was backed up to Google Drive.' });
    } else {
      toast.error({ title: 'Backup failed', message: entry.errorMessage ?? 'Something went wrong.' });
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
