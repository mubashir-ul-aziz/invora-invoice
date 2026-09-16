import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { getCloudStoragePlan } from '@/domain/cloudBackup/types';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { useCloudBackupStore } from '@/state/cloudBackupStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

/**
 * Account / Subscription placeholder (Phase 10), per the explicit
 * "RELATED SCREENS: Account/Subscription placeholder" and "do not implement
 * unnecessary account features" / "do not implement payment processing"
 * instructions. Invora has no cloud account or login system yet — everything
 * runs off the on-device database (`MVP_BUILD_PLAN.md` §4) — so this screen
 * states that honestly instead of faking a sign-in/sign-out flow or a
 * checkout. "Logout" is listed by the brief but has nothing to log out of
 * today; it's a labelled, working button that says so rather than a dead
 * link, so tapping it is never a silent no-op.
 *
 * Restyled to match the Stitch "Account / Subscription" design's cards.
 * This screen is where the gap between the design and this app is widest:
 * Stitch envisions a full logged-in-user paid-tier product (a personal
 * account distinct from the business, a metered "Invora Starter" plan with
 * a monthly invoice allowance, an "Invora Pro" upgrade with its own price
 * and feature list, stored account credentials, restorable IAP purchases).
 * None of that exists — this app has no login, no invoice metering/tier
 * gating of any kind, and no payment/IAP integration anywhere in the
 * codebase. Rather than invent fake facts (an email address, a "member
 * since" date, a price), the identity header and "Subscription" card use
 * the one real, related capability that already exists — the real business
 * profile and the real Cloud Backup storage plan (`cloudBackupStore`,
 * `CLOUD_STORAGE_PLANS`) — and the promo card's CTA is real navigation to
 * the existing `UpgradeStorage` screen. Everything with no real analog at
 * all (Account Credentials' email/member-since/billing-reference rows,
 * Restore Purchases) is still rendered per the design but marked DESIGN
 * ONLY, with honest "not applicable" values rather than invented ones.
 */
export function AccountScreen({ navigation }: Props) {
  const { profile, load: loadProfile } = useBusinessProfileStore();
  const { settings: cloudSettings, load: loadCloudBackup } = useCloudBackupStore();

  useEffect(() => {
    loadProfile();
    loadCloudBackup();
  }, [loadProfile, loadCloudBackup]);

  const currentPlan = getCloudStoragePlan(cloudSettings.planId ?? 'free');
  const plusPlan = getCloudStoragePlan('plus');
  const notAvailable = (what: string) => Alert.alert('Not available', `${what} is not implemented yet.`);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="account-screen">
      {/* Real business identity header — replaces Stitch's fake personal user identity */}
      <View style={styles.identityCard}>
        {profile?.logoUri ? (
          <Image source={{ uri: profile.logoUri }} style={styles.identityLogo} />
        ) : (
          <View style={styles.identityLogoPlaceholder}>
            <Text style={styles.identityLogoPlaceholderText}>
              {(profile?.businessName?.trim() || 'Y').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.flexShrink}>
          <Text style={styles.identityName} numberOfLines={1}>
            {profile?.businessName?.trim() || 'Your business'}
          </Text>
          <Text style={styles.identityCaption}>All data stored locally on this device</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={styles.title}>Account</Text>
        </View>
        <Text style={styles.body}>
          Invora runs fully offline, with your data stored on this device. There's no cloud
          account to sign in to yet.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="star" size={16} color={colors.primary} />
          <Text style={styles.title}>Subscription</Text>
          <View style={styles.planPill}>
            <Text style={styles.planPillText}>{currentPlan.label} plan</Text>
          </View>
        </View>
        <Text style={styles.body}>
          Invora itself is free to use, with every feature available regardless of plan. The only paid option is
          optional cloud backup storage.
        </Text>
      </View>

      {/* Real promo — navigates to the actual UpgradeStorage screen, using the real Plus plan (no invented price) */}
      {currentPlan.id !== plusPlan.id && (
        <View style={styles.promoCard}>
          <View style={styles.promoBadge}>
            <Feather name="zap" size={12} color={colors.primaryText} />
            <Text style={styles.promoBadgeText}>MORE CLOUD STORAGE</Text>
          </View>
          <Text style={styles.promoTitle}>Invora {plusPlan.label}</Text>
          <Text style={styles.promoPrice}>{plusPlan.priceLabel}</Text>
          <Text style={styles.promoBody}>Upgrade your cloud backup plan for more storage room.</Text>
          <ActionButton
            label={`Upgrade to ${plusPlan.label}`}
            icon="arrow-up-circle"
            variant="primary"
            onPress={() => navigation.navigate('UpgradeStorage')}
            testID="account-upgrade"
          />
        </View>
      )}

      {/* DESIGN ONLY: no account/login/IAP system exists — values are honest placeholders, never invented facts. */}
      <View style={styles.card}>
        <Text style={styles.title}>Account Credentials · DESIGN ONLY</Text>
        <CredentialRow icon="at-sign" label="Account Email" value="Not applicable — no sign-in required" />
        <CredentialRow icon="calendar" label="Member Since" value="Not tracked" />
        <CredentialRow icon="hash" label="Billing Reference" value="Not applicable" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases — DESIGN ONLY, not implemented"
          testID="action-restore-purchases-design-only"
          onPress={() => notAvailable('Restoring purchases')}
          style={({ pressed }) => [styles.restoreRow, pressed && styles.pressed]}
        >
          <View style={styles.restoreIcon}>
            <Feather name="rotate-ccw" size={17} color={colors.primary} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.restoreLabel}>Restore Purchases</Text>
            <Text style={styles.restoreCaption}>Re-sync purchases from the App Store or Google Play</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <ActionButton
        label="Log out"
        onPress={() =>
          Alert.alert(
            "You're not signed in",
            'There is no account to log out of yet — all your data stays on this device either way.',
          )
        }
        testID="action-logout"
      />
    </ScrollView>
  );
}

function CredentialRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.credentialRow}>
      <View style={styles.credentialLabelRow}>
        <Feather name={icon} size={15} color={colors.textMuted} />
        <Text style={styles.credentialLabel}>{label}</Text>
      </View>
      <Text style={styles.credentialValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  identityCard: {
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
  identityLogo: { width: 44, height: 44, borderRadius: 11, backgroundColor: colors.background },
  identityLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityLogoPlaceholderText: { color: colors.primaryText, fontSize: 17, fontWeight: '700' },
  identityName: { fontSize: 15, fontWeight: '700', color: colors.text },
  identityCaption: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  body: { fontSize: 13, color: colors.textMuted },

  planPill: { backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  planPillText: { fontSize: 11, fontWeight: '700', color: colors.text },

  promoCard: {
    backgroundColor: colors.text,
    borderRadius: 16,
    padding: 18,
    gap: 6,
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  promoBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryText, letterSpacing: 0.4 },
  promoTitle: { fontSize: 19, fontWeight: '700', color: colors.surface },
  promoPrice: { fontSize: 13, fontWeight: '600', color: colors.placeholder },
  promoBody: { fontSize: 12, color: colors.placeholder, marginBottom: 8 },

  credentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 10,
  },
  credentialLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  credentialLabel: { fontSize: 12, color: colors.textMuted },
  credentialValue: { fontSize: 12, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  restoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.background },
  restoreIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  restoreLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  restoreCaption: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});
