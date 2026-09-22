import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import type { StorePackage } from '@/data/subscription/RevenueCatAdapter';
import { describeYearlyMonthlyEquivalent } from '@/domain/subscription/formatting';
import { describePlanFeatures, type BillingPeriod, type PlanConfig } from '@/domain/subscription/plans';
import { colors } from '@/theme/colors';

interface Props {
  config: PlanConfig;
  period: BillingPeriod;
  /** The RevenueCat/Google Play package for this plan + period; undefined until offerings load (or if it isn't configured). */
  pkg?: StorePackage;
  /** Savings line for the yearly toggle, only ever supplied when computed from real store prices. */
  savingsLabel?: string | null;
  isCurrent: boolean;
  /** `null` = no action (e.g. the Free plan card). */
  cta: { label: string; disabled: boolean; onPress: () => void } | null;
  /** Small explanatory line under the CTA (e.g. "Starts at your next renewal"). */
  ctaNote?: string | null;
  testID?: string;
}

/**
 * One plan on the Pricing screen. Purely presentational: every rule it shows
 * (limits, history access, badge) comes from `PlanConfig`, and every price
 * from the store package — nothing is hard-coded here.
 */
export function PlanCard({ config, period, pkg, savingsLabel, isCurrent, cta, ctaNote, testID }: Props) {
  const isFree = config.id === 'free';
  const suffix = period === 'monthly' ? '/ month' : '/ year';

  let price: string;
  let subline: string | null = null;
  if (isFree) {
    price = 'Free';
  } else if (pkg) {
    price = pkg.priceString;
    subline = period === 'yearly' ? describeYearlyMonthlyEquivalent(pkg) : null;
  } else {
    // Offerings not loaded: show the reference price, clearly labelled as such, and no purchase.
    price = `$${config.fallbackPriceUsd[period]}`;
    subline = 'Reference price — the final price is shown by Google Play';
  }

  return (
    <View style={[styles.card, isCurrent && styles.cardCurrent, !!config.badge && styles.cardBadged]} testID={testID}>
      <View style={styles.headerRow}>
        <View style={styles.flexShrink}>
          <Text style={styles.name}>{config.label}</Text>
          <Text style={styles.tagline}>{config.tagline}</Text>
        </View>
        <View style={styles.pills}>
          {!!config.badge && (
            <View style={styles.badge} testID={`${testID}-badge`}>
              <Text style={styles.badgeText}>{config.badge}</Text>
            </View>
          )}
          {isCurrent && (
            <View style={styles.currentPill} testID={`${testID}-current`}>
              <Text style={styles.currentText}>CURRENT PLAN</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{price}</Text>
        {!isFree && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
      {!!subline && <Text style={styles.subline}>{subline}</Text>}
      {period === 'yearly' && !!savingsLabel && !isFree && <Text style={styles.savings}>{savingsLabel}</Text>}

      <View style={styles.features}>
        {describePlanFeatures(config).map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Feather name="check" size={14} color={colors.primary} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {cta && (
        <ActionButton
          label={cta.label}
          variant={config.badge && !isCurrent ? 'primary' : 'secondary'}
          disabled={cta.disabled}
          onPress={cta.onPress}
          testID={testID ? `${testID}-cta` : undefined}
        />
      )}
      {!!ctaNote && <Text style={styles.ctaNote}>{ctaNote}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCurrent: { borderColor: colors.primary },
  cardBadged: { borderColor: colors.primary, borderWidth: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  tagline: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pills: { alignItems: 'flex-end', gap: 4 },
  badge: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.primaryText, letterSpacing: 0.5 },
  currentPill: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  currentText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  suffix: { fontSize: 13, color: colors.textMuted },
  subline: { fontSize: 12, color: colors.textMuted },
  savings: { fontSize: 12, fontWeight: '700', color: colors.primary },
  features: { gap: 6, marginVertical: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: colors.text, flexShrink: 1 },
  ctaNote: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
