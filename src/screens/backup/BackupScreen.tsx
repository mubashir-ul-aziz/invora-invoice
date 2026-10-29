import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { formatBackupSize, formatBackupTimestamp } from '@/domain/backup/formatting';
import type { BackupHistoryItem } from '@/domain/backup/history';
import type { BackupPreview } from '@/domain/backup/types';
import type { RootStackParamList } from '@/navigation/types';
import { useBackupStore, type BackupBusyAction, type PrepareOutcome } from '@/state/backupStore';
import { toast } from '@/state/toastStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Backup'>;

const SUCCESS_BG = '#DBFCEC';
const SUCCESS_FG = '#006243';
const FAILURE_BG = '#FBE4E2';

const BUSY_LABELS: Record<BackupBusyAction, string> = {
  signing_in: 'Signing in…',
  drive_backup: 'Backing up to Google Drive…',
  export: 'Creating backup…',
  preparing: 'Checking backup file…',
  restoring: 'Saving a safety backup and restoring…',
  sharing: 'Preparing file…',
  deleting: 'Deleting…',
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function previewMessage(preview: BackupPreview): string {
  const { counts } = preview;
  const lines = [
    `Backup from ${formatBackupTimestamp(preview.createdAt)}`,
    `Business: ${preview.businessName ?? 'No business profile'}`,
    `${plural(counts.invoices, 'invoice')} · ${plural(counts.customers, 'customer')} · ${plural(counts.items, 'item')} · ${plural(counts.payments, 'payment')}`,
  ];
  if (preview.formatVersion < 2) {
    lines.push('Older backup format — the logo is only kept if it is still on this device.');
  } else if (preview.hasLogo) {
    lines.push('Includes the business logo.');
  }
  lines.push(
    '',
    'Restoring REPLACES all business data on this device — profile, customers, items, invoices and payments. A safety backup of your current data is saved first.',
    'Your plan, App Lock and backup history are not changed.',
  );
  return lines.join('\n');
}

/**
 * "Backup & Restore". Top: automatic Google Drive backup (account, toggle,
 * last success, status). Middle: Export / Import a `.json` backup file.
 * Bottom: this device's persistent backup history — Drive, exported and
 * safety backups — with Download/Share, Restore and Delete per entry.
 *
 * Every restore goes through the same two steps in `backupStore`: the file
 * is fully validated and previewed first (`prepare…`), and only on
 * confirmation is a safety backup written and the data replaced
 * (`confirmRestore`). See `BackupRestoreService` for the guarantees.
 *
 * Kept from the Stitch "Backup & Restore" bento layout; Stitch's storage
 * quota meter, AES-256 badge, "Zero-Knowledge" and compliance cards stay out
 * because nothing in the app backs them (backups are not encrypted).
 */
export function BackupScreen({}: Props) {
  const {
    busy,
    signedIn,
    accountEmail,
    settings,
    items,
    error,
    load,
    signIn,
    signOut,
    setAutoBackupEnabled,
    backupNow,
    exportBackup,
    shareItem,
    saveItemToDevice,
    importBackup,
    prepareRestoreFromItem,
    confirmRestore,
    cancelRestore,
    deleteItem,
    refreshRemoteBackups,
  } = useBackupStore();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (signedIn) {
      refreshRemoteBackups();
    }
  }, [signedIn, refreshRemoteBackups]);

  const isBusy = busy !== null;

  const share = async (item: BackupHistoryItem) => {
    try {
      // The share sheet doesn't report what the user did with the file, so closing it is not called a success.
      await shareItem(item);
    } catch (err) {
      toast.error({ title: "Couldn't share backup", message: err instanceof Error ? err.message : 'Please try again.' });
    }
  };

  const saveToFolder = async (item: BackupHistoryItem) => {
    try {
      const outcome = await saveItemToDevice(item);
      if (outcome === 'saved') {
        toast.success({ title: 'Copy saved', message: `${item.fileName ?? 'The backup'} was saved to the folder you chose.` });
      } else if (outcome === 'unsupported') {
        await share(item);
      }
    } catch (err) {
      toast.error({ title: "Couldn't save copy", message: err instanceof Error ? err.message : 'Please try again.' });
    }
  };

  const offerDownload = (item: BackupHistoryItem, title = 'Download or share backup') => {
    const options =
      Platform.OS === 'android'
        ? [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Share…', onPress: () => share(item) },
            { text: 'Save to folder', onPress: () => saveToFolder(item) },
          ]
        : [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Share / Save to Files', onPress: () => share(item) },
          ];
    Alert.alert(title, item.fileName ?? undefined, options);
  };

  const runRestore = async () => {
    const result = await confirmRestore();
    if (!result) return;
    if (result.entry.status === 'success') {
      toast.success({
        title: 'Restore complete',
        message: 'Your data was restored. A safety backup of the previous data is in your backup history.',
      });
    } else {
      toast.error({ title: 'Restore failed', message: result.entry.errorMessage ?? 'Your existing data was not changed.' });
    }
  };

  const handlePrepared = (outcome: PrepareOutcome) => {
    if (outcome.status === 'cancelled') return;
    if (outcome.status === 'invalid') {
      toast.error({ title: "Can't restore this backup", message: outcome.message });
      return;
    }
    Alert.alert('Restore this backup?', previewMessage(outcome.preview), [
      { text: 'Cancel', style: 'cancel', onPress: cancelRestore },
      { text: 'Replace my data', style: 'destructive', onPress: runRestore },
    ], { cancelable: true, onDismiss: cancelRestore });
  };

  const handleImport = async () => {
    handlePrepared(await importBackup());
  };

  const handleRestoreItem = async (item: BackupHistoryItem) => {
    handlePrepared(await prepareRestoreFromItem(item));
  };

  const handleExport = async () => {
    const entry = await exportBackup();
    if (entry.status !== 'success') {
      toast.error({ title: 'Export failed', message: entry.errorMessage ?? 'Something went wrong. Nothing was changed.' });
      return;
    }
    toast.success({ title: 'Backup saved on this device', message: entry.fileName ?? 'Your backup is in the history below.' });
    const item = useBackupStore.getState().items.find((candidate) => candidate.key === entry.id);
    if (item) {
      offerDownload(item, 'Keep a copy somewhere else?');
    }
  };

  const handleDelete = (item: BackupHistoryItem) => {
    const local = item.location === 'local';
    const title = local ? 'Delete backup file from this device?' : 'Delete backup from Google Drive?';
    const message = local
      ? `This permanently deletes ${item.fileName ?? 'this backup file'} from this device's Metriqo storage. Copies you already shared or saved elsewhere are not affected.`
      : `This permanently deletes ${item.fileName ?? 'this backup'} from Google Drive${accountEmail ? ` (${accountEmail})` : ''}. Backups stored on this device are not affected.`;
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: local ? 'Delete local file' : 'Delete from Drive',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(item);
            toast.success({ title: 'Backup deleted', message: local ? 'The local backup file was deleted.' : 'The backup was deleted from Google Drive.' });
          } catch (err) {
            toast.error({ title: "Couldn't delete backup", message: err instanceof Error ? err.message : 'Please try again.' });
          }
        },
      },
    ]);
  };

  const handleBackupNow = async () => {
    const entry = await backupNow();
    if (entry.status === 'success') {
      toast.success({ title: 'Backup complete', message: 'Your data was backed up to Google Drive.' });
    } else {
      toast.error({ title: 'Backup failed', message: entry.errorMessage ?? 'Something went wrong.' });
    }
  };

  const handleSignIn = async () => {
    if (!(await signIn())) {
      toast.error({ title: "Couldn't connect Google Drive", message: useBackupStore.getState().error ?? 'Please try again.' });
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out of Google Drive?', 'You can sign back in any time — your existing backups stay on Drive.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const lastStatus =
    settings.lastBackupStatus === 'success' ? 'Succeeded' : settings.lastBackupStatus === 'failure' ? 'Failed' : 'Never attempted';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="backup-screen">
      <View style={styles.card} testID="backup-drive-card">
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleIcon}>
            <Feather name="cloud" size={18} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Automatic Google Drive Backup</Text>
          <View style={[styles.statusPill, styles.statusPillOff]} testID="backup-drive-coming-soon">
            <Text style={[styles.statusPillText, styles.statusPillTextOff]}>Coming soon</Text>
          </View>
          <View style={[styles.statusPill, signedIn ? styles.statusPillOn : styles.statusPillOff]}>
            <Text style={[styles.statusPillText, signedIn ? styles.statusPillTextOn : styles.statusPillTextOff]}>
              {signedIn ? 'Connected' : 'Not connected'}
            </Text>
          </View>
        </View>

        {signedIn ? (
          <Text style={styles.cardBody} testID="backup-account">
            {accountEmail ? `Signed in as ${accountEmail}` : 'Connected — sign out and in again to show the account email.'}
          </Text>
        ) : (
          <Text style={styles.cardBody}>Sign in with Google to back up to your Drive's private app folder.</Text>
        )}

        <FieldToggleRow
          icon="refresh-cw"
          label="Automatic daily backup"
          description="Backs up when you open Metriqo and a day has passed"
          checked={settings.autoBackupEnabled}
          disabled={!signedIn}
          disabledHint="Sign in with Google first"
          onToggle={() => setAutoBackupEnabled(!settings.autoBackupEnabled)}
          testID="backup-auto-toggle"
        />

        <SummaryRow label="Last successful backup" value={formatBackupTimestamp(settings.lastBackupAt)} testID="backup-last-success" />
        <SummaryRow label="Last attempt" value={lastStatus} />
        {settings.lastBackupStatus === 'failure' && !!settings.lastBackupError && (
          <Text style={styles.errorDetail} testID="backup-last-error">
            {settings.lastBackupError}
          </Text>
        )}

        <Text style={styles.hint} testID="backup-platform-note">
          Android and iOS don't let apps run on an exact schedule in the background. Automatic backups run while
          Metriqo is open (or when you return to it), you're online, and at least 24 hours have passed since the last
          one — a day you don't open the app is skipped.
        </Text>

        <View style={styles.row}>
          {signedIn ? (
            <>
              <ActionButton
                label="Back up now"
                icon="upload-cloud"
                variant="primary"
                onPress={handleBackupNow}
                disabled={isBusy}
                testID="backup-now"
              />
              <ActionButton label="Sign out" onPress={handleSignOut} disabled={isBusy} testID="backup-sign-out" />
            </>
          ) : (
            <ActionButton
              label="Sign in with Google"
              variant="primary"
              onPress={handleSignIn}
              disabled={isBusy}
              testID="backup-sign-in"
            />
          )}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleIcon}>
            <Feather name="hard-drive" size={18} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Backup file</Text>
        </View>
        <Text style={styles.cardBody}>
          Export saves a complete backup in Metriqo's storage on this device, then lets you share it or save a copy.
          Import restores a backup file — it replaces your current business data after saving a safety backup.
        </Text>
        <View style={styles.row}>
          <ActionButton
            label="Export Backup"
            icon="download"
            variant="primary"
            onPress={handleExport}
            disabled={isBusy}
            testID="backup-export"
          />
          <ActionButton label="Import Backup" icon="upload" onPress={handleImport} disabled={isBusy} testID="backup-import" />
        </View>
      </View>

      {busy !== null && (
        <View style={styles.busyRow} testID="backup-busy">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.cardBody}>{BUSY_LABELS[busy]}</Text>
        </View>
      )}
      {!!error && busy === null && (
        <Text style={styles.errorDetail} testID="backup-error">
          {error}
        </Text>
      )}

      <Text style={styles.sectionHeader}>Backup history</Text>
      {items.length === 0 && (
        <Text style={styles.cardBody} testID="backup-history-empty">
          No backups yet. Export a backup or back up to Google Drive to see it here.
        </Text>
      )}
      {items.map((item) => (
        <HistoryRow
          key={item.key}
          item={item}
          disabled={isBusy}
          onShare={() => offerDownload(item)}
          onRestore={() => handleRestoreItem(item)}
          onDelete={() => handleDelete(item)}
        />
      ))}
    </ScrollView>
  );
}

function HistoryRow({
  item,
  disabled,
  onShare,
  onRestore,
  onDelete,
}: {
  item: BackupHistoryItem;
  disabled: boolean;
  onShare: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const failed = item.status === 'failure';
  const details = [
    item.sizeBytes !== null ? formatBackupSize(item.sizeBytes) : null,
    item.counts ? `${plural(item.counts.invoices, 'invoice')} · ${plural(item.counts.customers, 'customer')}` : null,
  ].filter(Boolean);
  const hasActions = item.actions.share || item.actions.restore || item.actions.delete;

  return (
    <View style={styles.historyRow} testID={`history-row-${item.key}`}>
      <View style={[styles.historyIcon, failed && styles.historyIconFailed]}>
        <Feather name={failed ? 'alert-triangle' : item.location === 'google_drive' ? 'cloud' : item.location === 'local' ? 'smartphone' : 'check'} size={15} color={failed ? colors.danger : SUCCESS_FG} />
      </View>
      <View style={styles.flexShrink}>
        <View style={styles.historyRowTop}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={failed ? styles.failureBadge : styles.successBadge}>{failed ? 'Failed' : 'Success'}</Text>
        </View>
        <Text style={styles.rowSubtitle}>{formatBackupTimestamp(item.occurredAt)}</Text>
        {details.length > 0 && <Text style={styles.rowSubtitle}>{details.join(' · ')}</Text>}
        {!!item.fileName && (
          <Text style={styles.rowFile} numberOfLines={1}>
            {item.fileName}
          </Text>
        )}
        {failed && !!item.errorMessage && <Text style={styles.errorDetail}>{item.errorMessage}</Text>}
        {!!item.unavailableReason && <Text style={styles.rowSubtitle}>{item.unavailableReason}</Text>}
        {hasActions && (
          <View style={styles.actionRow}>
            {item.actions.share && (
              <RowAction icon="share-2" label="Download/Share" onPress={onShare} disabled={disabled} testID={`share-${item.key}`} />
            )}
            {item.actions.restore && (
              <RowAction icon="rotate-ccw" label="Restore" onPress={onRestore} disabled={disabled} testID={`restore-${item.key}`} />
            )}
            {item.actions.delete && (
              <RowAction icon="trash-2" label="Delete" onPress={onDelete} disabled={disabled} danger testID={`delete-${item.key}`} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function RowAction({
  icon,
  label,
  onPress,
  disabled,
  danger,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
  testID: string;
}) {
  const color = danger ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.rowAction, (pressed || disabled) && styles.pressed]}
    >
      <Feather name={icon} size={13} color={color} />
      <Text style={[styles.rowActionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.6 },
  flexShrink: { flexShrink: 1, flex: 1, minWidth: 0, gap: 2 },

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
  hint: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillOn: { backgroundColor: SUCCESS_BG },
  statusPillOff: { backgroundColor: colors.background },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  statusPillTextOn: { color: SUCCESS_FG },
  statusPillTextOff: { color: colors.textMuted },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  errorDetail: { fontSize: 12, color: colors.danger },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  sectionHeader: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: 6 },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  historyIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: SUCCESS_BG, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  historyIconFailed: { backgroundColor: FAILURE_BG },
  historyRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 },
  rowSubtitle: { fontSize: 12, color: colors.textMuted },
  rowFile: { fontSize: 11, color: colors.textMuted },
  successBadge: { fontSize: 11, fontWeight: '700', color: SUCCESS_FG },
  failureBadge: { fontSize: 11, fontWeight: '700', color: colors.danger },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  rowActionText: { fontSize: 12, fontWeight: '700' },
});
