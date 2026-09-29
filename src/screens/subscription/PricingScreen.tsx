import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlanCard } from '@/components/subscription/PlanCard';
import { UsageMeter } from '@/components/subscription/UsageMeter';
import { SettingsRow } from '@/components/business/SettingsRow';
import {
  describeRenewal,
  describeStatus,
  describeYearlySavings,
  formatSyncAge,
} from '@/domain/subscription/formatting';
import { planChangeKind } from '@/domain/subscription/planChange';
import {
  BILLING_PERIODS,
  PLAN_CONFIG,
  PLAN_ORDER,
  describePlanFeatures,
  isPaidPlan,
  type BillingPeriod,
  type PaidPlanId,
} from '@/domain/subscription/plans';
import { describeUpgradeReason } from '@/domain/subscription/upgradeReason';
import type { RootStackParamList } from '@/navigation/types';
import { useSubscription } from '@/state/useSubscription';
import { colors, radius, spacing, typography } from '@/theme/colors';

import { customerCenterOutcomeMessage, paywallOutcomeMessage, purchaseOutcomeMessage, restoreOutcomeMessage } from './outcomeMessages';

type Props = NativeStackScreenProps<RootStackParamList, 'Pricing'>;

const PERIOD_LABELS: Record<BillingPeriod, string> = { monthly: 'Monthly', yearly: 'Yearly' };

const TONE_COLORS = {
  neutral: { background: colors.lockedBg, text: colors.textMuted },
  good: { background: colors.successBg, text: colors.success },
  warning: { background: colors.warningBg, text: colors.warning },
  bad: { background: colors.dangerBg, text: colors.danger },
} as const;

/**
 * Pricing / Subscription — Kinetic Ledger. One screen combining the Stitch
 * "Subscription Management" / "Current Subscription" hero (status, renewal,
 * usage, plan features, Manage/Change Plan/Restore actions) with the Stitch
 * "Pricing Plans" grid below it (billing toggle, all five plan cards). Folded
 * into one route rather than three — there is one subscription state, not
 * three (see `guards.tsx`/`subscriptionStore`), and "Change Plan" simply
 * scrolls this same screen to the plan grid instead of opening a duplicate.
 *
 * Everything shown is derived, not hard-coded: plan rules and features from
 * `PLAN_CONFIG`/`describePlanFeatures`, prices from the RevenueCat Offering
 * (falling back to a clearly-labelled reference price, with purchasing
 * disabled, when it can't be loaded), status/usage from `useSubscription()`.
 * Yearly savings are shown only when computed from the two real store prices.
 * Stitch's claims with no backing in this app (multi-business profiles,
 * payment QR codes, a "cloud backup vault", "bank-grade encryption", a
 * fabricated billing-issue countdown) are intentionally not shown.
 */
export function PricingScreen({ route }: Props) {
  const reason = route.params?.reason;
  const sub = useSubscription();
  const { refresh, loadOfferings, refreshUsage } = sub;
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [busyPlan, setBusyPlan] = useState<PaidPlanId | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const plansSectionY = useRef(0);

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
  const currentFeatures = describePlanFeatures(sub.planConfig);

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

  const handlePresentPaywall = async () => {
    const outcome = await sub.presentPaywall();
    const message = paywallOutcomeMessage(outcome);
    if (message) {
      Alert.alert(message.title, message.message);
    }
  };

  const handlePresentCustomerCenter = async () => {
    const outcome = await sub.presentCustomerCenter();
    const message = customerCenterOutcomeMessage(outcome);
    if (message) {
      Alert.alert(message.title, message.message);
    }
  };

  const scrollToPlans = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, plansSectionY.current - spacing.lg), animated: true });
  };

  const reasonCopy = reason ? describeUpgradeReason(reason, { limit: sub.usage?.limit }) : null;

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content} testID="pricing-screen">
      {reasonCopy && (
        <View style={styles.reasonBanner} testID="pricing-reason">
          <View style={styles.reasonRow}>
            <View style={styles.reasonIcon}>
              <Feather name="lock" size={16} color={colors.primary} />
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.reasonTitle}>{reasonCopy.title}</Text>
              <Text style={styles.reasonMessage}>{reasonCopy.message}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upgrade now"
            testID="pricing-reason-upgrade"
            onPress={handlePresentPaywall}
            disabled={working}
            style={({ pressed }) => [styles.reasonUpgradeButton, pressed && styles.pressed]}
          >
            <Text style={styles.reasonUpgradeText}>{working ? 'Working…' : 'Upgrade now'}</Text>
          </Pressable>
        </View>
      )}

      {/* trust === 'stale': the cache hasn't been verified for longer than the offline policy allows
          (`MAX_STALE_MS`, see offlinePolicy.ts), so `sub.plan` has already fallen back to Free even
          though `sub.subscription.plan` (the last thing RevenueCat actually confirmed) was paid. The
          generic "Not verified yet" status pill doesn't convey that, so a paying user needs an explicit
          nudge to reconnect rather than assuming they've simply lost their plan. */}
      {sub.trust === 'stale' && isPaidPlan(sub.subscription.plan) && (
        <View style={styles.staleBanner} testID="pricing-stale-trust">
          <View style={styles.staleIcon}>
            <Feather name="alert-triangle" size={16} color={colors.warning} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.staleTitle}>Verify your subscription</Text>
            <Text style={styles.staleMessage}>
              We haven't been able to confirm your {PLAN_CONFIG[sub.subscription.plan].label} plan in a while, so it's showing
              as Free for now. Connect to the internet to verify your subscription and restore full access.
            </Text>
          </View>
        </View>
      )}

      {/* Current subscription — status, renewal, usage, plan features (Stitch "Subscription Management" / "Current Subscription") */}
      <View style={styles.card} testID="pricing-current">
        <View style={styles.currentTop}>
          <View style={styles.flexShrink}>
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
              Offline — last verified {formatSyncAge(sub.subscription.lastSyncedAt, sub.currentTime())}. Metriqo keeps working
              on your saved plan.
            </Text>
          </View>
        )}

        <UsageMeter usage={sub.usage} testID="pricing-usage" />

        <View style={styles.divider} />

        <Text style={styles.featuresHeading}>Plan features</Text>
        <View style={styles.featureList} testID="pricing-current-features">
          {currentFeatures.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Feather name="check" size={14} color={colors.primary} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {sub.isPaid && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change plan"
            testID="pricing-change-plan"
            onPress={scrollToPlans}
            style={({ pressed }) => [styles.changePlanButton, pressed && styles.pressed]}
          >
            <Text style={styles.changePlanText}>Change Plan</Text>
            <Feather name="chevron-down" size={16} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Manage + Restore (Stitch "Subscription Management" actions) */}
      <View style={styles.actionsGroup}>
        <SettingsRow
          icon="external-link"
          label="Manage Subscription"
          description="Renewal, cancellation and payment method in Google Play"
          onPress={() => {
            sub.openManageSubscription();
          }}
          testID="action-manage-subscription"
        />
        <SettingsRow
          icon="rotate-ccw"
          label="Restore Purchases"
          description="Re-sync your subscription from Google Play"
          onPress={handleRestore}
          testID="action-restore-purchases"
        />
        <SettingsRow
          icon="life-buoy"
          label="Customer Center"
          description="Manage, pause or cancel your subscription, or get help"
          onPress={handlePresentCustomerCenter}
          testID="action-customer-center"
        />
      </View>

      {/* Plan grid (Stitch "Pricing Plans") */}
      <View onLayout={(e) => (plansSectionY.current = e.nativeEvent.layout.y)}>
        <Text style={styles.sectionHeading}>All plans</Text>
      </View>

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
          <Feather name="alert-triangle" size={16} color={colors.danger} />
          <View style={styles.flexShrink}>
            <Text style={styles.errorTitle}>Couldn't load plans from Google Play</Text>
            <Text style={styles.detail}>
              {sub.offeringsError ? `${sub.offeringsError} ` : ''}Prices below are reference prices and can't be purchased
              until plans load.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try again"
            testID="pricing-retry-offerings"
            onPress={() => loadOfferings(true)}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.plansList}>
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
                ctaNote={sub.plan === 'free' ? null : 'Included with Metriqo whenever no paid plan is active.'}
              />
            );
          }
          const paidPlan: PaidPlanId = planId;
          const pkg = findPackage(paidPlan, period);
          const currentPackage =
            isPaidPlan(sub.plan) && sub.subscription.billingPeriod
              ? findPackage(sub.plan, sub.subscription.billingPeriod)
              : undefined;
          const kind = planChangeKind(
            { plan: sub.plan, period: sub.subscription.billingPeriod },
            { plan: paidPlan, period },
            { current: currentPackage, target: pkg },
          );
          const isCurrent = kind === 'same';
          const label = kind === 'immediate' || kind === 'new' ? `Upgrade to ${config.label}` : `Switch to ${config.label}`;
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
      </View>

      <Text style={styles.fineprint}>
        Renewal, cancellation, plan changes and your payment method are managed in Google Play. Payments are processed by
        Google Play — Metriqo never sees your card details.
      </Text>

      <Text style={styles.fineprint} testID="pricing-data-note">
        Your invoices, customers and payments always stay saved on this device. A plan controls what you can open and how many
        invoices you can create each month — never whether your data exists.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl + spacing.lg },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },

  reasonBanner: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
  },
  reasonRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  reasonUpgradeButton: {
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonUpgradeText: { fontSize: typography.bodyBold.fontSize, fontWeight: '700', color: colors.primaryText },
  reasonIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonTitle: { fontSize: typography.h3.fontSize, fontWeight: typography.h3.weight, color: colors.text },
  reasonMessage: { fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2, lineHeight: 17 },

  staleBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.warningBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.lg,
  },
  staleIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staleTitle: { fontSize: typography.h3.fontSize, fontWeight: typography.h3.weight, color: colors.text },
  staleMessage: { fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2, lineHeight: 17 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  currentTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  eyebrow: { fontSize: typography.label.fontSize, fontWeight: typography.label.weight, color: colors.textMuted, letterSpacing: 0.6 },
  currentPlan: { fontSize: typography.h1.fontSize, fontWeight: typography.h1.weight, color: colors.text },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, maxWidth: '55%' },
  statusText: { fontSize: typography.label.fontSize, fontWeight: '700' },
  detail: { fontSize: typography.caption.fontSize, color: colors.textMuted, lineHeight: 17, flexShrink: 1 },
  offlineRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  divider: { height: 1, backgroundColor: colors.border },
  featuresHeading: { fontSize: typography.label.fontSize, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.4 },
  featureList: { gap: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { fontSize: typography.body.fontSize, color: colors.text, flexShrink: 1 },
  changePlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
  },
  changePlanText: { fontSize: typography.bodyBold.fontSize, fontWeight: '700', color: colors.primary },

  actionsGroup: { gap: spacing.sm },
  sectionHeading: { fontSize: typography.h2.fontSize, fontWeight: typography.h2.weight, color: colors.text, paddingTop: spacing.sm },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  toggleOption: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 1, borderRadius: radius.sm + 1 },
  toggleOptionActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: typography.bodyBold.fontSize, fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: colors.primaryText },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorTitle: { fontSize: typography.bodyBold.fontSize, fontWeight: '700', color: colors.danger },
  retryButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.dangerBg },
  retryText: { fontSize: typography.caption.fontSize, fontWeight: '700', color: colors.danger },

  plansList: { gap: spacing.md },

  fineprint: { fontSize: typography.caption.fontSize, color: colors.textMuted, lineHeight: 16, textAlign: 'center' },
});
