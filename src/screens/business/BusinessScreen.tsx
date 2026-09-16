import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/components/business/SettingsRow';
import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatNextInvoiceNumber } from '@/domain/business/types';
import { openEmail, openPhone, openWebsite } from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Business'>;

/**
 * The "Business / Company" screen — profile summary + entry points into
 * Edit and Settings. Restyled to match the Stitch "Business Profile"
 * design: an identity card with real Currency/Prefix stats, a Registration
 * & Contact card whose Phone/Email/Website rows are real tappable actions
 * (reusing `lib/linking`'s `openPhone`/`openEmail`/`openWebsite`, same as
 * Customer Detail), a Configuration & Settings section, and a Quick Access
 * icon grid for the rest of the app's hubs.
 *
 * The Stitch mock's "Verified Business Entity" checkmarks and "Status:
 * Live" micro-stat aren't reproduced — `BusinessProfile` has no
 * verification or live-status field, and this app has no such concept
 * (dropped rather than badged, same reasoning as Invoice Review's
 * compliance-claim copy). The copy-to-clipboard buttons on Address/Email
 * aren't reproduced either — this app doesn't depend on `expo-clipboard`
 * anywhere; Phone/Email/Website are real tappable actions instead, which is
 * more useful than a copy affordance would be.
 *
 * One real addition: a "Business Settings" row now also links to the real
 * (already-built, previously unlinked-from-here) `BusinessSettingsScreen`,
 * matching the Stitch design's own row for it.
 */
export function BusinessScreen({ navigation }: Props) {
  const { status, profile, error, load } = useBusinessProfileStore();
  // Also preloaded here (not just from the Digital Card screen) so the
  // merged "Business profile" form — reachable from this screen without ever
  // visiting Digital Card — has the card's owner name/social links ready as
  // soon as it mounts, instead of loading them itself (see
  // `EditBusinessScreen`'s doc comment for why it doesn't self-load).
  const { load: loadCard } = useBusinessCardStore();

  useEffect(() => {
    load();
    loadCard();
  }, [load, loadCard]);

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="business-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="business-error">
        <Text style={styles.errorText}>Couldn't load your business profile.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <ActionButton label="Try again" onPress={load} />
      </View>
    );
  }

  const hasContactInfo = !!(profile?.address || profile?.phone || profile?.email || profile?.website || profile?.taxId);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="business-screen"
    >
      {/* Identity card */}
      <View style={styles.card} testID="business-summary">
        <View style={styles.identityBlock}>
          {profile?.logoUri ? (
            <Image
              source={{ uri: profile.logoUri }}
              style={styles.logo}
              testID="business-logo-image"
            />
          ) : (
            <View style={styles.logoPlaceholder} testID="business-logo-placeholder">
              <Text style={styles.logoPlaceholderText}>
                {(profile?.businessName?.trim() || 'Y').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.businessName}>
            {profile?.businessName?.trim() || 'Your business name'}
          </Text>

          {!profile && (
            <Text style={styles.emptyState} testID="business-empty">
              You haven't set up your business profile yet.
            </Text>
          )}
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Currency</Text>
            <Text style={styles.statValue}>{profile?.currency ?? 'USD'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Prefix</Text>
            <Text style={styles.statValue}>{profile?.invoicePrefix || 'INV-'}</Text>
          </View>
        </View>

        <View style={styles.nextNumberRow}>
          <Text style={styles.statLabel}>Next invoice number</Text>
          <Text style={styles.nextNumberValue}>
            {formatNextInvoiceNumber(
              profile?.invoicePrefix ?? 'INV-',
              profile?.businessCode ?? '',
              profile?.nextInvoiceNumber ?? 1,
            )}
          </Text>
        </View>
        {!!profile?.businessCode && <SummaryRow label="Business ID" value={profile.businessCode} />}
      </View>

      {/* Registration & Contact */}
      {hasContactInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registration &amp; Contact</Text>
          <View style={styles.contactCard}>
            {!!profile?.address && (
              <ContactRow icon="home" label="Registered Address" value={profile.address} />
            )}
            {!!profile?.phone && (
              <ContactRow
                icon="phone"
                label="Phone"
                value={profile.phone}
                onPress={() => openPhone(profile.phone!)}
                actionIcon="phone-call"
                testID="action-call-business"
              />
            )}
            {!!profile?.email && (
              <ContactRow
                icon="mail"
                label="Email Address"
                value={profile.email}
                onPress={() => openEmail(profile.email!)}
                actionIcon="send"
                testID="action-email-business"
              />
            )}
            {!!profile?.website && (
              <ContactRow
                icon="globe"
                label="Website"
                value={profile.website}
                onPress={() => openWebsite(profile.website!)}
                actionIcon="external-link"
                testID="action-website-business"
              />
            )}
            {!!profile?.taxId && <ContactRow icon="shield" label="Tax / VAT Number" value={profile.taxId} />}
          </View>
        </View>
      )}

      {/* Configuration & Settings */}
      <View style={styles.section} testID="business-settings-section">
        <Text style={styles.sectionTitle}>Configuration &amp; Settings</Text>
        <SettingsRow
          icon="user"
          label="Business profile"
          description="Name, logo, address, contact details, invoice prefix"
          onPress={() => navigation.navigate('EditBusiness')}
          testID="settings-row-profile"
        />
        <SettingsRow
          icon="sliders"
          label="Business settings"
          description="Preferences, notifications, regional units"
          onPress={() => navigation.navigate('BusinessSettings')}
          testID="settings-row-business-settings"
        />
        <SettingsRow
          icon="file-text"
          label="Invoice settings"
          description="Prefix, numbering, currency, default tax, template"
          onPress={() => navigation.navigate('InvoiceSettings')}
          testID="settings-row-invoice"
        />
        <SettingsRow
          icon="layers"
          label="Invoice type"
          description="Which fields appear on an invoice line item"
          onPress={() => navigation.navigate('InvoiceTypeSelection')}
          testID="settings-row-invoice-type"
        />
        <SettingsRow
          icon="credit-card"
          label="Digital business card"
          description="Card, QR code, sharing"
          onPress={() => navigation.navigate('DigitalCard')}
          testID="settings-row-card"
          tag="vCard"
        />
      </View>

      {/* Quick Access */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.quickGrid}>
          <QuickTile icon="grid" label="Dashboard" onPress={() => navigation.navigate('Dashboard')} testID="action-dashboard" />
          <QuickTile icon="credit-card" label="Business card" onPress={() => navigation.navigate('DigitalCard')} testID="action-digital-card" />
          <QuickTile icon="package" label="Items" onPress={() => navigation.navigate('ItemList')} testID="action-items" />
          <QuickTile icon="users" label="Customers" onPress={() => navigation.navigate('CustomerList')} testID="action-customers" />
          <QuickTile icon="file-text" label="Invoices" onPress={() => navigation.navigate('InvoiceList')} testID="action-invoices" />
          <QuickTile icon="dollar-sign" label="Payments" onPress={() => navigation.navigate('PaymentHistory')} testID="action-payments" />
          <QuickTile icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} testID="action-settings" />
        </View>
      </View>
    </ScrollView>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
  actionIcon,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
  actionIcon?: keyof typeof Feather.glyphMap;
  testID?: string;
}) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIcon}>
        <Feather name={icon} size={17} color={colors.primary} />
      </View>
      <View style={styles.contactTextCol}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {!!onPress && !!actionIcon && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          testID={testID}
          onPress={onPress}
          hitSlop={8}
          style={({ pressed }) => [styles.contactAction, pressed && styles.pressed]}
        >
          <Feather name={actionIcon} size={16} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

function QuickTile({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
    >
      <View style={styles.quickTileIcon}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.quickTileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyState: { color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  pressed: { opacity: 0.75 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  identityBlock: { alignItems: 'center', gap: 6 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    color: colors.primaryText,
    fontSize: 26,
    fontWeight: '700',
  },
  businessName: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },

  statsBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, padding: 10 },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statLabel: { fontSize: 11, color: colors.textMuted },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },

  nextNumberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextNumberValue: { fontSize: 13, fontWeight: '700', color: colors.primary },

  section: { gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  contactIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  contactTextCol: { flex: 1, minWidth: 0 },
  contactLabel: { fontSize: 11, color: colors.textMuted },
  contactValue: { fontSize: 14, color: colors.text, marginTop: 1 },
  contactAction: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTile: {
    width: '31%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickTileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  quickTileLabel: { fontSize: 11, fontWeight: '600', color: colors.text },
});
