import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { DashboardSummaryCard } from '@/components/dashboard/DashboardSummaryCard';
import { RecentInvoiceRow } from '@/components/dashboard/RecentInvoiceRow';
import { PAYMENT_TERMS_OPTIONS } from '@/domain/business/types';
import type { DashboardRecentInvoice } from '@/domain/dashboard/types';
import { addDaysIso, todayIsoDate } from '@/domain/invoice/formMapping';
import type { RootStackParamList } from '@/navigation/types';
import { useDashboardStore } from '@/state/dashboardStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

/**
 * The app's home screen (Phase 8). Total Sales / Paid / Outstanding /
 * Overdue / invoice count (`DashboardSummaryCard`) and a short recent-
 * invoices list come from `dashboardStore`, the only consumer of
 * `domain/dashboard/calculations.ts` — nothing on this screen sums an
 * invoice or a payment itself. `recentInvoices` is capped at a handful of
 * rows (see `DEFAULT_RECENT_INVOICES_LIMIT`), so it's rendered with a plain
 * `.map()` inside the same `ScrollView` as everything else, not a nested
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

  useEffect(() => {
    load();
    loadInvoiceType();
    loadInvoiceSettings();
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="dashboard-screen">
      <DashboardSummaryCard summary={summary} testID="dashboard-summary" />

      <View style={styles.row}>
        <ActionButton
          label="Create invoice"
          variant="primary"
          onPress={handleCreateInvoice}
          testID="action-create-invoice"
        />
        <ActionButton label="Add customer" onPress={() => navigation.navigate('CreateCustomer')} testID="action-add-customer" />
        <ActionButton label="Record payment" onPress={handleRecordPayment} testID="action-record-payment" />
      </View>

      <View style={styles.row}>
        <ActionButton label="Invoices" onPress={() => navigation.navigate('InvoiceList')} testID="action-invoices" />
        <ActionButton label="Customers" onPress={() => navigation.navigate('CustomerList')} testID="action-customers" />
        <ActionButton label="Business" onPress={() => navigation.navigate('Business')} testID="action-business" />
        <ActionButton label="Settings" onPress={() => navigation.navigate('Settings')} testID="action-settings" />
      </View>

      <View style={styles.section} testID="dashboard-recent-invoices">
        <Text style={styles.sectionTitle}>Recent invoices</Text>

        {summary.recentInvoices.length === 0 ? (
          <Text style={styles.emptyText} testID="dashboard-recent-empty">
            You haven't created any invoices yet.
          </Text>
        ) : (
          summary.recentInvoices.map((entry) => (
            <RecentInvoiceRow
              key={entry.invoiceId}
              entry={entry}
              onPress={() => handleOpenInvoice(entry)}
              testID={`dashboard-recent-invoice-${entry.invoiceId}`}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.textMuted },
});
