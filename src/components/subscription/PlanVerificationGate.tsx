import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatBackupTimestamp } from '@/domain/backup/formatting';
import { evaluateVerification } from '@/domain/subscription/verificationPolicy';
import { restoreOutcomeMessage, verifyOutcomeMessage } from '@/screens/subscription/outcomeMessages';
import { useBackupStore } from '@/state/backupStore';
import { useSubscriptionStore } from '@/state/subscriptionStore';
import { toast } from '@/state/toastStore';
import { colors } from '@/theme/colors';

interface Props {
  children: React.ReactNode;
}

/** How often the 24-hour boundary is re-checked while the app stays open. */
const RECHECK_MS = 60 * 1000;

/**
 * Enforces the 24-hour verification policy (`verificationPolicy.ts`): once
 * the plan hasn't been verified with RevenueCat for 24 hours, normal app use
 * pauses behind this screen until a verification succeeds. It only ever
 * offers what's safe without verification — verify/retry, Restore Purchases
 * and exporting a backup — and never deletes data or calls the plan expired.
 *
 * Re-evaluated every minute and on every return to the foreground. It lifts
 * by itself as soon as any refresh verifies (a reconnect also triggers one —
 * see `SubscriptionService.startListening()`). Mounted inside
 * `SubscriptionRunner` so the startup/foreground/reconnect refreshes keep
 * running while it's shown.
 */
export function PlanVerificationGate({ children }: Props) {
  const resolved = useSubscriptionStore((state) => state.resolved);
  const verification = useSubscriptionStore((state) => state.snapshot.verification);
  const clockHighWaterMs = useSubscriptionStore((state) => state.snapshot.clockHighWaterMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RECHECK_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const state = evaluateVerification({ ...verification, clockHighWaterMs, now });
  if (!resolved || !state.required) {
    return <>{children}</>;
  }
  return <VerificationRequired reason={state.reason} lastVerifiedAt={verification.lastVerifiedAt} />;
}

function VerificationRequired({
  reason,
  lastVerifiedAt,
}: {
  reason: 'expired_window' | 'clock_rollback';
  lastVerifiedAt: number | null;
}) {
  const verifying = useSubscriptionStore((state) => state.verifying);
  const restoring = useSubscriptionStore((state) => state.busy === 'restoring');
  const verifyPlan = useSubscriptionStore((state) => state.verifyPlan);
  const restore = useSubscriptionStore((state) => state.restore);
  const exportBackup = useBackupStore((state) => state.exportBackup);
  const shareItem = useBackupStore((state) => state.shareItem);
  const backupBusy = useBackupStore((state) => state.busy !== null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    const message = verifyOutcomeMessage(await verifyPlan());
    setLastMessage(message.type === 'success' ? null : message.message);
    toast.show(message.type, message);
  };

  const handleRestorePurchases = async () => {
    const message = restoreOutcomeMessage(await restore());
    toast.show(message.type, message);
  };

  const handleExport = async () => {
    const entry = await exportBackup();
    if (entry.status !== 'success') {
      toast.error({ title: 'Export failed', message: entry.errorMessage ?? 'Something went wrong.' });
      return;
    }
    toast.success({ title: 'Backup saved on this device', message: entry.fileName ?? 'Saved.' });
    const item = useBackupStore.getState().items.find((candidate) => candidate.key === entry.id);
    if (item) {
      await shareItem(item).catch(() => undefined);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="plan-verification-gate">
      <View style={styles.icon}>
        <Feather name="wifi-off" size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>Connect to the internet to verify your plan</Text>
      <Text style={styles.body}>
        Metriqo confirms your subscription with Google Play at least once every 24 hours. Your invoices and data are safe
        on this device and nothing has been deleted — connect to the internet and tap Verify now to continue.
      </Text>
      {reason === 'clock_rollback' && (
        <Text style={styles.body} testID="plan-verification-clock">
          Your device's date or time moved backwards. Make sure it's set automatically, then verify.
        </Text>
      )}
      <Text style={styles.meta} testID="plan-verification-last">
        Last verified: {lastVerifiedAt ? formatBackupTimestamp(new Date(lastVerifiedAt).toISOString()) : 'not yet on this device'}
      </Text>
      {!!lastMessage && (
        <Text style={styles.error} testID="plan-verification-error">
          {lastMessage}
        </Text>
      )}

      <View style={styles.actions}>
        <ActionButton
          label={verifying ? 'Verifying…' : 'Verify now'}
          icon="refresh-cw"
          variant="primary"
          onPress={handleVerify}
          disabled={verifying}
          testID="plan-verification-verify"
        />
        <ActionButton
          label={restoring ? 'Restoring…' : 'Restore Purchases'}
          icon="rotate-ccw"
          onPress={handleRestorePurchases}
          disabled={restoring}
          testID="plan-verification-restore"
        />
        <ActionButton
          label="Export Backup"
          icon="download"
          onPress={handleExport}
          disabled={backupBusy}
          testID="plan-verification-export"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  meta: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  error: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  actions: { gap: 10, marginTop: 8 },
});
