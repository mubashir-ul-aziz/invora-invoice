import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { STATUS_BACKGROUND, STATUS_TEXT } from '@/components/invoice/InvoiceStatusBadge';
import type { Customer, CustomerActivityEntry, CustomerActivityType, CustomerBalanceSummary } from '@/domain/customer/types';
import { INVOICE_STATUS_LABELS } from '@/domain/invoice/status';
import type { InvoiceStatus } from '@/domain/invoice/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerActivityStore } from '@/state/customerActivityStore';
import { useCustomerStore } from '@/state/customerStore';
import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerHistory'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';
type ChipFilter = CustomerActivityType | 'all';

const INVOICE_STATUSES: readonly string[] = ['unpaid', 'partial', 'paid', 'overdue'];

function isInvoiceStatus(status: string | null): status is InvoiceStatus {
  return !!status && INVOICE_STATUSES.includes(status);
}

const FILTER_CHIPS: { value: ChipFilter; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'all', label: 'All Events', icon: 'layers' },
  { value: 'payment', label: 'Payments', icon: 'credit-card' },
  { value: 'invoice', label: 'Invoices', icon: 'file-text' },
];

interface MonthSection {
  key: string;
  label: string;
  data: CustomerActivityEntry[];
}

/**
 * Groups already newest-first entries into contiguous "MONTH YEAR" sections
 * — the same "only merge consecutive same-bucket items" shape as
 * `domain/shared/dateSections.ts`'s `groupByDateSection`, but at month
 * granularity to match the Stitch "Customer History" timeline's date
 * groups.
 */
function groupByMonth(entries: CustomerActivityEntry[]): MonthSection[] {
  const sections: MonthSection[] = [];
  for (const entry of entries) {
    const date = new Date(entry.date);
    const valid = !Number.isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : 'unknown';
    const label = valid
      ? date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase()
      : 'UNKNOWN DATE';
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.data.push(entry);
    } else {
      sections.push({ key, label, data: [entry] });
    }
  }
  return sections;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Customer History, restyled to match the Stitch "Customer History" design:
 * an overview banner (customer + real Total Settled/Open Balance), a
 * filter-chip bar, and a month-grouped timeline of the customer's real
 * invoices and payments — reading from `InvoiceBackedCustomerActivityRepository`
 * (see `data/customerActivity/`) via the same `customerActivityStore` Customer
 * Detail already uses.
 *
 * The Stitch mock also shows a per-event receipt/audit trail this app's data
 * model doesn't have: bank-transfer reference numbers, "sent via email" /
 * "opened by recipient" tracking, a separate "Invoice Sent" vs
 * "Invoice Created" event pair, and an "Edits" timeline of customer-profile
 * changes. None of that is backed by real per-event data (there is no
 * receipt artifact, no email-tracking, and no audit log on `Customer` — see
 * `domain/customer/types.ts`), so rather than inventing plausible-looking
 * values, the "Edits" filter chip is shown disabled and marked DESIGN ONLY,
 * and each entry's only actions are the real ones: a "Details" link to that
 * invoice/payment's own screen.
 */
export function CustomerHistoryScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const { getById } = useCustomerStore();
  const {
    status: activityStatus,
    summary,
    history,
    filter,
    error,
    load,
    setFilter,
  } = useCustomerActivityStore();
  const [customerStatus, setCustomerStatus] = useState<LoadStatus>('loading');
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getById(customerId);
        if (cancelled) {
          return;
        }
        if (!found) {
          setCustomerStatus('not-found');
          return;
        }
        setCustomer(found);
        setCustomerStatus('ready');
      } catch {
        if (!cancelled) {
          setCustomerStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    load(customerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const sections = useMemo(() => groupByMonth(history), [history]);

  const handleOpenEntry = (entry: CustomerActivityEntry) => {
    if (entry.type === 'invoice') {
      navigation.navigate('InvoiceDetail', { invoiceId: entry.id });
    } else {
      navigation.navigate('EditPayment', { paymentId: entry.id });
    }
  };

  if (customerStatus === 'loading' || activityStatus === 'loading' || activityStatus === 'idle') {
    return (
      <View style={styles.centered} testID="customer-history-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (customerStatus === 'not-found') {
    return (
      <View style={styles.centered} testID="customer-history-not-found">
        <Text style={styles.errorText}>This customer no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (customerStatus === 'error' || activityStatus === 'error' || !customer) {
    return (
      <View style={styles.centered} testID="customer-history-error">
        <Text style={styles.errorText}>Couldn&apos;t load history.</Text>
        {!!error && <Text style={styles.errorDetail}>{error}</Text>}
        <ActionButton label="Try again" onPress={() => load(customerId)} />
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="customer-history-screen">
      <SectionList
        testID="customer-history-list"
        sections={sections}
        keyExtractor={(entry) => entry.id}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <OverviewBanner customer={customer} summary={summary} />
            <FilterChipsRow filter={filter.type} onChange={(type) => setFilter({ type })} />
          </>
        }
        renderSectionHeader={({ section }) => (
          <MonthSectionHeader label={section.label} count={section.data.length} />
        )}
        renderItem={({ item, index, section }) => (
          <HistoryEntryCard
            entry={item}
            isFirst={index === 0}
            isLast={index === section.data.length - 1}
            onPress={() => handleOpenEntry(item)}
            testID={`history-row-${item.id}`}
          />
        )}
        ListEmptyComponent={
          <View style={styles.centered} testID="customer-history-empty">
            <View style={styles.emptyIcon}>
              <Feather name="search" size={22} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter.type === 'all' ? 'No history yet' : 'No events found'}
            </Text>
            <Text style={styles.emptyText}>
              {filter.type === 'all'
                ? 'Invoices and payments for this customer will show up here.'
                : `No ${filter.type === 'invoice' ? 'invoices' : 'payments'} yet.`}
            </Text>
            {filter.type !== 'all' && (
              <ActionButton label="Reset filters" onPress={() => setFilter({ type: 'all' })} />
            )}
          </View>
        }
        ListFooterComponent={
          history.length > 0 ? (
            <View style={styles.endMarker}>
              <Feather name="clock" size={15} color={colors.textMuted} />
              <Text style={styles.endMarkerText}>Beginning of recorded history</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function OverviewBanner({ customer, summary }: { customer: Customer; summary: CustomerBalanceSummary }) {
  const currencySymbol = useCurrencySymbol();
  return (
    <View style={styles.banner} testID="customer-history-banner">
      <View style={styles.bannerTopRow}>
        <View style={styles.bannerNameRow}>
          <Feather name="briefcase" size={16} color={colors.primary} />
          <Text style={styles.bannerName} numberOfLines={1}>
            {customer.name}
          </Text>
        </View>
        {/* Stitch shows a "ID: CUST-884" client-code badge here; `Customer` has no display code field (see domain/customer/types.ts) — same DESIGN ONLY treatment Customer Detail already uses for this. */}
        <View
          style={styles.designOnlyChip}
          accessibilityLabel="Customer ID badge — DESIGN ONLY, no customer code field exists"
        >
          <Text style={styles.designOnlyChipText}>ID: DESIGN ONLY</Text>
        </View>
      </View>
      <View style={styles.bannerSubtitleRow}>
        <View style={styles.bannerDot} />
        <Text style={styles.bannerSubtitle}>Activity timeline • Invoices &amp; payments</Text>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>Total Settled</Text>
          <Text style={styles.metricValue} testID="customer-history-total-settled">
            {currencySymbol}{summary.totalPaid.toFixed(2)}
          </Text>
        </View>
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>Open Balance</Text>
          <Text
            style={[styles.metricValue, styles.metricValuePrimary]}
            testID="customer-history-open-balance"
          >
            {currencySymbol}{summary.outstanding.toFixed(2)}
          </Text>
        </View>
        {/* Stitch shows a "Health: Prime" verified badge here; there is no customer health/tier concept anywhere in the data model. */}
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>Health</Text>
          <View
            style={styles.designOnlyChip}
            accessibilityLabel="Customer health badge — DESIGN ONLY, no health/tier field exists"
          >
            <Text style={styles.designOnlyChipText}>DESIGN ONLY</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FilterChipsRow({ filter, onChange }: { filter: ChipFilter; onChange: (value: ChipFilter) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
      testID="history-type-filter"
    >
      {FILTER_CHIPS.map((chip) => {
        const selected = filter === chip.value;
        return (
          <Pressable
            key={chip.value}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            accessibilityState={{ selected }}
            testID={`history-type-filter-${chip.value}`}
            onPress={() => onChange(chip.value)}
            style={({ pressed }) => [
              styles.filterChip,
              selected && styles.filterChipSelected,
              pressed && !selected && styles.filterChipPressed,
            ]}
          >
            <Feather name={chip.icon} size={14} color={selected ? colors.primaryText : colors.textMuted} />
            <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{chip.label}</Text>
          </Pressable>
        );
      })}
      {/* Stitch's chip bar also has an "Edits" filter for customer-profile audit
          events (address changed, customer created, etc). No such audit log
          exists on `Customer` (domain/customer/types.ts) or anywhere in this
          app's data model, so it's shown per DESIGN.md but disabled rather
          than wired to a filter value that would just always be empty. */}
      <View style={styles.filterChipDisabled} testID="history-type-filter-edit-design-only">
        <Feather name="edit-2" size={14} color={colors.placeholder} />
        <Text style={styles.filterChipDisabledText}>Edits</Text>
        <View style={styles.designOnlyChipSmall}>
          <Text style={styles.designOnlyChipSmallText}>DESIGN ONLY</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function MonthSectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionDot} />
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      <View style={styles.sectionCountPill}>
        <Text style={styles.sectionCountText}>
          {count} {count === 1 ? 'Entry' : 'Entries'}
        </Text>
      </View>
    </View>
  );
}

function HistoryEntryCard({
  entry,
  isFirst,
  isLast,
  onPress,
  testID,
}: {
  entry: CustomerActivityEntry;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const isInvoice = entry.type === 'invoice';
  const markerColor = isInvoice ? colors.primary : '#1E7B41';
  const markerIcon: keyof typeof Feather.glyphMap = isInvoice ? 'file-text' : 'credit-card';
  const currencySymbol = useCurrencySymbol();

  const statusBackground = isInvoice && isInvoiceStatus(entry.status) ? STATUS_BACKGROUND[entry.status] : '#E3F3E8';
  const statusColor = isInvoice && isInvoiceStatus(entry.status) ? STATUS_TEXT[entry.status] : '#1E7B41';
  const statusLabel = isInvoice && isInvoiceStatus(entry.status) ? INVOICE_STATUS_LABELS[entry.status] : entry.status;

  const secondaryLine = isInvoice ? `Issued ${formatShortDate(entry.date)}` : (entry.status ?? 'Payment recorded');

  return (
    <View style={styles.entryWrap}>
      <View style={styles.markerColumn}>
        <View style={[styles.markerLine, isFirst && styles.markerLineHidden]} />
        <View style={[styles.marker, { backgroundColor: markerColor }]}>
          <Feather name={markerIcon} size={12} color="#fff" />
        </View>
        <View style={[styles.markerLine, isLast && styles.markerLineHidden]} />
      </View>

      <View style={styles.entryCard} testID={testID}>
        <View style={styles.entryTopRow}>
          <View style={styles.entryTitleBlock}>
            <Text style={styles.entryTitle} numberOfLines={1}>
              {entry.title}
            </Text>
            <Text style={styles.entrySecondary} numberOfLines={1}>
              {secondaryLine}
            </Text>
          </View>
          <Text style={styles.entryDate}>{formatShortDate(entry.date)}</Text>
        </View>

        <View style={styles.entryFooterRow}>
          <View style={styles.entryFooterLeft}>
            <Text style={styles.entryAmount}>{currencySymbol}{entry.amount.toFixed(2)}</Text>
            {!!statusLabel && (
              <View style={[styles.statusPill, { backgroundColor: statusBackground }]}>
                <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View details for ${entry.title}`}
            testID={testID ? `${testID}-details` : undefined}
            onPress={onPress}
            style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
          >
            <Text style={styles.detailsButtonText}>Details</Text>
            <Feather name="chevron-right" size={14} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  pressed: { opacity: 0.75 },

  listContent: { padding: 16, paddingBottom: 28, gap: 0 },

  designOnlyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignSelf: 'flex-start',
  },
  designOnlyChipText: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.2 },

  banner: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bannerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bannerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  bannerName: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
  bannerSubtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  bannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E7B41' },
  bannerSubtitle: { fontSize: 12, color: colors.textMuted },

  metricsRow: {
    flexDirection: 'row',
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    gap: 8,
  },
  metricCol: { flex: 1, gap: 2, minWidth: 0 },
  metricLabel: { fontSize: 10, color: colors.textMuted },
  metricValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  metricValuePrimary: { color: colors.primary },

  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingBottom: 12 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  filterChipPressed: { opacity: 0.7 },
  filterChipSelected: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  filterChipTextSelected: { color: colors.primaryText },
  filterChipDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  filterChipDisabledText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  designOnlyChipSmall: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.background },
  designOnlyChipSmallText: { fontSize: 8, fontWeight: '700', color: colors.textMuted },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingVertical: 8,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.text, letterSpacing: 0.6 },
  sectionCountPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.surface },
  sectionCountText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },

  entryWrap: { flexDirection: 'row', alignItems: 'stretch' },
  markerColumn: { width: 26, alignItems: 'center' },
  markerLine: { width: 2, flex: 1, backgroundColor: colors.border },
  markerLineHidden: { backgroundColor: 'transparent' },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  entryCard: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  entryTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  entryTitleBlock: { flex: 1, minWidth: 0, gap: 2 },
  entryTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  entrySecondary: { fontSize: 12, color: colors.textMuted },
  entryDate: { fontSize: 11, color: colors.textMuted, flexShrink: 0 },

  entryFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  entryFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
  statusPill: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 7 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  detailsButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsButtonText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', maxWidth: 260 },

  endMarker: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 16 },
  endMarkerText: { fontSize: 11, color: colors.textMuted },
});
