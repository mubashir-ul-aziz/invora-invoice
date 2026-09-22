import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { PlanCard } from '@/components/subscription/PlanCard';
import { UsageMeter } from '@/components/subscription/UsageMeter';
import { describeRenewal, describeStatus, describeYearlySavings, formatSyncAge } from '@/domain/subscription/formatting';
import { planChangeKind } from '@/domain/subscription/planChange';
import {
  BILLING_PERIODS,
  PLAN_CONFIG,
  PLAN_ORDER,
  type BillingPeriod,
  type PaidPlanId,
} from '@/domain/subscription/plans';
import { describeUpgradeReason } from '@/domain/subscription/upgradeReason';
import type { RootStackParamList } from '@/navigation/types';
import { useSubscription } from '@/state/useSubscription';
import { colors } from '@/theme/colors';

import { purchaseOutcomeMessage, restoreOutcomeMessage } from './outcomeMessages';

type Props = NativeStackScreenProps<RootStackParamList, 'Pricing'>;

const PERIOD_LABELS: Record<BillingPeriod, string> = { monthly: 'Monthly', yearly: 'Yearly' };

const TONE_COLORS = {
  neutral: { background: colors.background, text: colors.textMuted },
  good: { background: '#E6F4EA', text: '#1E7B3A' },
  warning: { background: '#FFF4D6', text: '#8A5A00' },
  bad: { background: '#FCE8E6', text: colors.danger },
} as const;

/**
 * Pricing / Subscription. One screen for choosing a plan, seeing the current
 * plan + usage + status, restoring purchases and managing the subscription in
 * Google Play (matches the Stitch "Pricing Plans" / "Current Subscription" /
 * "Subscription Management" designs, folded into one — there is no separate
 * account system to warrant three).
 *
 * Everything shown is derived, not hard-coded: plan rules and features from
 * `PLAN_CONFIG`, prices from the RevenueCat Offering (falling back to a
 * clearly-labelled reference price, with purchasing disabled, when it can't be
 * loaded), status/usage from `useSubscription()`. Yearly savings are shown
 * only when computed from the two real store prices. Stitch's claims that
 * aren't backed by anything in Invora (multi-business profiles, payment QR
 * codes, a "cloud backup vault", "bank-grade encryption") are intentionally
 * not shown.
 */
export function PricingScreen({ route }: Props) {
  const reason = route.params?.reason;
  const sub = useSubscription();
  const { refresh, loadOfferings, refreshUsage } = sub;
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [busyPlan, setBusyPlan] = useState<PaidPlanId | null>(null);

  useEffect(() => {
    refresh('screen');
    loadOfferings();
    refreshUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findPackage = (plan: PaidPlanId, p: BillingPeriod) => sub.packages.find((pkg) => pkg.plan === plan && pkg.period === p);
  const offeringsReady = sub.offeringsStatus === 'ready';
  const statusInfo = describeStatus(sub.status);
  const tone = TONE_COLORS[statusInfo.tone];
  const renewal = describeRenewal(sub.subscription, sub.status);
  const working = sub.status === 'LOADING' || sub.status === 'RESTORING' || sub.purchasing;

  const handlePurchase = async (plan: PaidPlanId) => {
    setBusyPlan(plan);
    try {
      const outcome = await sub.purchase(plan, period);
      const message = purchaseOutcomeMessage(outcome, PLAN_CONFIG[plan].label);
      if (message) {
        Alert.alert(message.title, message.message);
      }
    } finally {
      setBusyPlan(null);
    }
  };

  const handleRestore = async () => {
    const outcome = await sub.restore();
    const message = restoreOutcomeMessage(outcome);
    Alert.alert(message.title, message.message);
  };

  const reasonCopy = reason ? describeUpgradeReason(reason, { limit: sub.usage?.limit }) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="pricing-screen">
      {reasonCopy && (
        <View style={styles.reasonBanner} testID="pricing-reason">
          <Feather name="lock" size={16} color={colors.primary} />
          <View style={styles.flexShrink}>
            <Text style={styles.reasonTitle}>{reasonCopy.title}</Text>
            <Text style={styles.reasonMessage}>{reasonCopy.message}</Text>
          </View>
        </View>
      )}

      {/* Current plan, status and usage */}
      <View style={styles.card} testID="pricing-current">
        <View style={styles.currentTop}>
          <View>
            <Text style={styles.eyebrow}>CURRENT PLAN</Text>
            <Text style={styles.currentPlan} testID="pricing-current-plan">
              {sub.planConfig.label}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: tone.background }]} testID="pricing-status">
            <Text style={[styles.statusText, { color: tone.text }]}>{statusInfo.label}</Text>
          </View>
        </View>
        {!!renewal && <Text style={styles.detail}>{renewal}</Text>}
        {sub.isOffline && (
          <View style={styles.offlineRow} testID="pricing-offline">
            <Feather name="wifi-off" size={13} color={colors.textMuted} />
            <Text style={styles.detail}>
              Offline — last verified {formatSyncAge(sub.subscription.lastSyncedAt, sub.currentTime())}. Invora keeps working
              on your saved plan.
            </Text>
          </View>
        )}
        <UsageMeter usage={sub.usage} testID="pricing-usage" />
      </View>

      {/* Billing period toggle */}
      <View style={styles.toggle} accessibilityRole="tablist">
        {BILLING_PERIODS.map((p) => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`billing-toggle-${p}`}
              onPress={() => setPeriod(p)}
              style={[styles.toggleOption, active && styles.toggleOptionActive]}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{PERIOD_LABELS[p]}</Text>
            </Pressable>
          );
        })}
      </View>

      {sub.offeringsStatus === 'error' && (
        <View style={styles.errorCard} testID="pricing-offerings-error">
          <Text style={styles.errorTitle}>Couldn't load plans from Google Play</Text>
          <Text style={styles.detail}>
            {sub.offeringsError ? `${sub.offeringsError} ` : ''}Prices below are reference prices and can't be purchased
            until plans load.
          </Text>
          <ActionButton label="Try again" onPress={() => loadOfferings(true)} testID="pricing-retry-offerings" />
        </View>
      )}

      {/* Plans */}
      {PLAN_ORDER.map((planId) => {
        const config = PLAN_CONFIG[planId];
        if (planId === 'free') {
          return (
            <PlanCard
              key={planId}
              testID="plan-free"
              config={config}
              period={period}
              isCurrent={sub.plan === 'free'}
              cta={null}
              ctaNote={sub.plan === 'free' ? null : 'Included with Invora whenever no paid plan is active.'}
            />
          );
        }
        const paidPlan: PaidPlanId = planId;
        const pkg = findPackage(paidPlan, period);
        const kind = planChangeKind({ plan: sub.plan, period: sub.subscription.billingPeriod }, { plan: paidPlan, period });
        const isCurrent = kind === 'same';
        const label =
          kind === 'immediate' || kind === 'new' ? `Upgrade to ${config.label}` : `Switch to ${config.label}`;
        return (
          <PlanCard
            key={planId}
            testID={`plan-${planId}`}
            config={config}
            period={period}
            pkg={pkg}
            savingsLabel={describeYearlySavings(findPackage(paidPlan, 'monthly'), findPackage(paidPlan, 'yearly'))}
            isCurrent={isCurrent}
            cta={
              isCurrent
                ? { label: 'Current plan', disabled: true, onPress: () => undefined }
                : {
                    label: busyPlan === paidPlan ? 'Working…' : label,
                    disabled: !offeringsReady || !pkg || working,
                    onPress: () => handlePurchase(paidPlan),
                  }
            }
            ctaNote={
              kind === 'deferred'
                ? 'Starts at your next renewal — you keep your current plan until then.'
                : !isCurrent && offeringsReady && !pkg
                  ? 'Not available right now'
                  : null
            }
          />
        );
      })}

      {/* Restore + manage */}
      <View style={styles.card}>
        <ActionButton
          label="Restore purchases"
          icon="rotate-ccw"
          disabled={working}
          onPress={handleRestore}
          testID="action-restore-purchases"
        />
        <ActionButton
          label="Manage subscription in Google Play"
          icon="external-link"
          onPress={() => {
            sub.openManageSubscription();
          }}
          testID="action-manage-subscription"
        />
        <Text style={styles.fineprint}>
          Renewal, cancellation, plan changes and your payment method are managed in Google Play. Payments are processed by
          Google Play — Invora never sees your card details.
        </Text>
      </View>

      <Text style={styles.fineprint} testID="pricing-data-note">
        Your invoices, customers and payments always stay saved on this device. A plan controls what you can open and how many
        invoices you can create each month — never whether your data exists.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  reasonBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 14,
  },
  reasonTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  reasonMessage: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10 },
  currentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6 },
  currentPlan: { fontSize: 22, fontWeight: '800', color: colors.text },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '60%' },
  statusText: { fontSize: 11, fontWeight: '700' },
  detail: { fontSize: 12, color: colors.textMuted, lineHeight: 17, flexShrink: 1 },
  offlineRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    alignSelf: 'stretch',
  },
  toggleOption: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  toggleOptionActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: colors.primaryText },
  errorCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.danger },
  errorTitle: { fontSize: 14, fontWeight: '700', color: colors.danger },
  fineprint: { fontSize: 11, color: colors.textMuted, lineHeight: 16, textAlign: 'center' },
});
