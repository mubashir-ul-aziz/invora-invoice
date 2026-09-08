import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { formatBackupTimestamp } from '@/domain/backup/formatting';
import type { RootStackParamList } from '@/navigation/types';
import { useBackupStore } from '@/state/backupStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Backup'>;

/**
 * "Backup & Restore" (Phase 11). Google Drive is a backup destination only —
 * never a live data source (`MVP_BUILD_PLAN.md` §4) — so every action here
 * either reads the local database to send it to Drive, or (via
 * `BackupHistoryScreen`) downloads a chosen Drive file and validates it
 * before ever touching the local database. See `BackupService`'s doc
 * comment for the safety guarantees behind these two buttons.
 */
export function BackupScreen({ navigation }: Props) {
  const { status, signedIn, settings, error, load, signIn, signOut, setAutoBackupEnabled, backupNow } =
    useBackupStore();

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="backup-screen">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Google Drive</Text>
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Automatic backup</Text>
        <FieldToggleRow
          label="Back up automatically"
          checked={settings.autoBackupEnabled}
          disabled={!signedIn}
          disabledHint="Sign in with Google first"
          onToggle={() => setAutoBackupEnabled(!settings.autoBackupEnabled)}
          testID="backup-auto-toggle"
        />
        <Text style={styles.hint}>
          Runs opportunistically once a day while the app is open and you're online — not a background job (see
          IMPLEMENTATION_STATUS.md).
        </Text>
      </View>

      <View style={styles.card} testID="backup-status-card">
        <Text style={styles.cardTitle}>Status</Text>
        <SummaryRow label="Last successful backup" value={formatBackupTimestamp(settings.lastBackupAt)} />
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
          variant="primary"
          onPress={handleBackupNow}
          disabled={!signedIn || busy}
          testID="backup-now"
        />
        <ActionButton
          label="Restore backup"
          onPress={() => navigation.navigate('BackupHistory')}
          disabled={!signedIn || busy}
          testID="backup-restore"
        />
        <ActionButton
          label="Backup history"
          onPress={() => navigation.navigate('BackupHistory')}
          testID="backup-history-link"
        />
      </View>

      {busy && <ActivityIndicator color={colors.primary} testID="backup-busy" />}
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
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  errorDetail: { fontSize: 12, color: colors.danger },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
