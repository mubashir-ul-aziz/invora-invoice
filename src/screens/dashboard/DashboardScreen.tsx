import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { DashboardBottomNav } from '@/components/dashboard/DashboardBottomNav';
import { DashboardGreetingHeader } from '@/components/dashboard/DashboardGreetingHeader';
import { DashboardQuickActions } from '@/components/dashboard/DashboardQuickActions';
import { DashboardStatusBreakdown } from '@/components/dashboard/DashboardStatusBreakdown';
import { DashboardSummaryCard } from '@/components/dashboard/DashboardSummaryCard';
import { RecentInvoiceRow } from '@/components/dashboard/RecentInvoiceRow';
import { PAYMENT_TERMS_OPTIONS } from '@/domain/business/types';
import type { DashboardRecentInvoice } from '@/domain/dashboard/types';
import { addDaysIso, todayIsoDate } from '@/domain/invoice/formMapping';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { useDashboardStore } from '@/state/dashboardStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

/**
 * The app's home screen, restyled to match the Stitch "Dashboard" design:
 * a greeting header, a 3-tile quick-actions row, a 2x2 key-metrics grid, a
 * status-breakdown strip, and a recent-invoices list, plus a screen-local
 * bottom nav mirroring the Stitch mock's tab bar. See the doc comments on
 * `DashboardGreetingHeader` and `DashboardSummaryCard` for exactly which
 * Stitch elements have no backend support and are marked DESIGN ONLY instead
 * of showing invented numbers.
 *
 * Total Sales / Paid / Outstanding / Overdue / invoice counts
 * (`DashboardSummaryCard`, `DashboardStatusBreakdown`) and the recent-
 * invoices list come from `dashboardStore`, the only consumer of
 * `domain/dashboard/calculations.ts` — nothing on this screen sums an
 * invoice or a payment itself. `recentInvoices` shows every invoice issued
 * today uncapped (falling back to a handful of the most recent ones — see
 * `DEFAULT_RECENT_INVOICES_LIMIT` — only when nothing's been issued today),
 * so it's rendered with a plain `.map()` inside the same `ScrollView` as
 * everything else, not a nested
 * `FlatList` (which React Native warns against inside a scroll view of the
 * same orientation) — Invoice List/Payment History remain the place for a
 * long, virtualized, paginated history.
 *
 * Reloads on every focus, not just on mount: quick actions below (and
 * Invoice Detail/Record Payment reached from elsewhere) navigate away and
 * back via the same `popToTop()`-then-forward pattern the rest of this
 * codebase already uses, which keeps this screen mounted underneath rather
 * than remounting it — a mount-only `load()` would keep showing stale
 * totals after e.g. recording a payment and returning here.
 */
export function DashboardScreen({ navigation }: Props) {
  const { status, summary, error, load } = useDashboardStore();
  const { selection: invoiceTypeSelection, load: loadInvoiceType } = useInvoiceTypeStore();
  const { settings: invoiceSettings, load: loadInvoiceSettings } = useInvoiceSettingsStore();
  const { profile: businessProfile, load: loadBusinessProfile } = useBusinessProfileStore();

  useEffect(() => {
    load();
    loadInvoiceType();
    loadInvoiceSettings();
    loadBusinessProfile();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const handleCreateInvoice = () => {
    const invoiceTypeId = invoiceTypeSelection?.invoiceTypeId ?? 'general';
    const termsDays = invoiceSettings?.defaultPaymentTermsDays ?? null;
    const terms = termsDays != null ? (PAYMENT_TERMS_OPTIONS.find((o) => o.value === termsDays)?.label ?? null) : null;
    const dueDate = termsDays != null ? addDaysIso(todayIsoDate(), termsDays) : null;

    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId, terms, dueDate });
    navigation.navigate('CustomerList', {
      onSelectCustomer: (customer) => {
        useInvoiceDraftStore.getState().setCustomer(customer);
        navigation.navigate('CreateInvoiceItems');
      },
    });
  };

  const handleRecordPayment = () => {
    navigation.navigate('InvoiceList', {
      onSelectInvoice: (invoice) => navigation.navigate('RecordPayment', { invoiceId: invoice.id }),
    });
  };

  const handleOpenInvoice = (entry: DashboardRecentInvoice) => {
    navigation.navigate('InvoiceDetail', { invoiceId: entry.invoiceId });
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="dashboard-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="dashboard-error">
        <Text style={styles.errorText}>Couldn't load your dashboard.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <ActionButton label="Try again" onPress={load} />
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="dashboard-screen">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <DashboardGreetingHeader profile={businessProfile} testID="dashboard-greeting" />

        <DashboardQuickActions
          onCreateInvoice={handleCreateInvoice}
          onAddCustomer={() => navigation.navigate('CreateCustomer')}
          onRecordPayment={handleRecordPayment}
        />

        <DashboardSummaryCard summary={summary} testID="dashboard-summary" />

        <DashboardStatusBreakdown summary={summary} testID="dashboard-status-breakdown" />

        <View style={styles.section} testID="dashboard-recent-invoices">
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Recent invoices</Text>
              <View style={styles.countBadge} testID="summary-invoice-count">
                <Text style={styles.countBadgeText}>{summary.invoiceCount}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all invoices"
              onPress={() => navigation.navigate('InvoiceList')}
              style={styles.seeAll}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Feather name="chevron-right" size={16} color={colors.primary} />
            </Pressable>
          </View>

          {summary.recentInvoices.length === 0 ? (
            <Text style={styles.emptyText} testID="dashboard-recent-empty">
              You haven't created any invoices yet.
            </Text>
          ) : (
            <View style={styles.recentList}>
              {summary.recentInvoices.map((entry) => (
                <RecentInvoiceRow
                  key={entry.invoiceId}
                  entry={entry}
                  onPress={() => handleOpenInvoice(entry)}
                  testID={`dashboard-recent-invoice-${entry.invoiceId}`}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <DashboardBottomNav
        onInvoices={() => navigation.navigate('InvoiceList')}
        onCustomers={() => navigation.navigate('CustomerList')}
        onSettings={() => navigation.navigate('Settings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  countBadge: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  seeAll: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  recentList: { gap: 8 },
  emptyText: { color: colors.textMuted },
});
