import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CustomerActivityRow } from '@/components/customer/CustomerActivityRow';
import { avatarStyleFor, initialsFor } from '@/components/customer/CustomerListRow';
import { InvoiceStatusBadge, STATUS_BACKGROUND, STATUS_TEXT } from '@/components/invoice/InvoiceStatusBadge';
import { PAYMENT_TERMS_OPTIONS } from '@/domain/business/types';
import type { Customer } from '@/domain/customer/types';
import { addDaysIso, todayIsoDate } from '@/domain/invoice/formMapping';
import type { InvoiceStatus } from '@/domain/invoice/types';
import { openEmail, openGoogleMaps, openPhone, openWebsite, openWhatsApp } from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerActivityStore } from '@/state/customerActivityStore';
import { useCustomerStore } from '@/state/customerStore';
import { useCurrencySymbol } from '@/state/currencyContext';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { useInvoiceStore, type InvoiceWithStatus } from '@/state/invoiceStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';
type DetailTab = 'invoices' | 'payments';

const STATUS_ICON: Record<InvoiceStatus, keyof typeof Feather.glyphMap> = {
  unpaid: 'file-text',
  partial: 'clock',
  paid: 'check-circle',
  overdue: 'alert-circle',
};

/**
 * Customer Detail, restyled to match the Stitch "Customer Detail" design: a
 * profile header card, a real outstanding-balance hero metric with an
 * unpaid/collected progress split, Total Invoiced / Paid to Date tiles,
 * Create Invoice / Record Payment CTAs, a row of contact quick-actions, and
 * segmented Invoices/Payments tabs over the customer's real ledger.
 *
 * Every number here is derived from `CustomerBalanceSummary` (via
 * `customerActivityStore`) and the customer's real invoices/payments — never
 * fabricated. The Stitch mock's "#CUST-084" client code, "Active Account"
 * status, "Verified Corporate" tick, and VAT number have no backing field on
 * `Customer` (see `domain/customer/types.ts`) — each is marked DESIGN ONLY
 * rather than invented. "Filter by date" is likewise decorative: neither
 * `customerActivityStore` nor `invoiceStore` support a date-range filter for
 * one customer's ledger.
 */
export function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const { getById } = useCustomerStore();
  const { summary, history, load: loadActivity } = useCustomerActivityStore();
  const { listForCustomer } = useInvoiceStore();
  const { selection: invoiceTypeSelection, load: loadInvoiceType } = useInvoiceTypeStore();
  const { settings: invoiceSettings, load: loadInvoiceSettings } = useInvoiceSettingsStore();
  const currencySymbol = useCurrencySymbol();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<InvoiceWithStatus[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('invoices');

  useEffect(() => {
    loadInvoiceType();
    loadInvoiceSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getById(customerId);
        if (cancelled) {
          return;
        }
        if (!found) {
          setStatus('not-found');
          return;
        }
        setCustomer(found);
        const [, customerInvoices] = await Promise.all([
          loadActivity(customerId),
          listForCustomer(customerId),
        ]);
        if (cancelled) {
          return;
        }
        setInvoices(customerInvoices);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="customer-detail-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="customer-detail-not-found">
        <Text style={styles.errorText}>This customer no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error' || !customer) {
    return (
      <View style={styles.centered} testID="customer-detail-error">
        <Text style={styles.errorText}>Couldn't load this customer.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const avatarStyle = avatarStyleFor(customer.id);
  const overdueCount = invoices.filter((entry) => entry.status === 'overdue').length;
  const paidCount = invoices.filter((entry) => entry.status === 'paid').length;
  const paymentEntries = history.filter((entry) => entry.type === 'payment');

  const totalBilled = summary.totalBilled;
  const pctUnpaid = totalBilled > 0 ? Math.min(100, (summary.outstanding / totalBilled) * 100) : 0;
  const pctCollected = totalBilled > 0 ? Math.max(0, 100 - pctUnpaid) : 0;

  const handleCreateInvoice = () => {
    const invoiceTypeId = invoiceTypeSelection?.invoiceTypeId ?? 'general';
    const termsDays = invoiceSettings?.defaultPaymentTermsDays ?? null;
    const terms =
      termsDays != null ? (PAYMENT_TERMS_OPTIONS.find((o) => o.value === termsDays)?.label ?? null) : null;
    const dueDate = termsDays != null ? addDaysIso(todayIsoDate(), termsDays) : null;

    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId, terms, dueDate });
    useInvoiceDraftStore.getState().setCustomer(customer);
    navigation.navigate('CreateInvoiceItems');
  };

  const handleRecordPayment = () =>
    navigation.navigate('InvoiceList', {
      customerId,
      onSelectInvoice: (invoice) => navigation.navigate('RecordPayment', { invoiceId: invoice.id }),
    });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="customer-detail-screen"
    >
      {/* Interactive Top Action Sub-bar (Stitch: "Client ID: #CUST-084" + "Active Account"). Neither a display customer code nor an active/inactive status exists on `Customer` (domain/customer/types.ts) — both are DESIGN ONLY. */}
      <View style={styles.subBar}>
        <View style={styles.subBarLeft}>
          <View style={styles.idBadge}>
            <Text style={styles.idBadgeText}>Client ID: DESIGN ONLY</Text>
          </View>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>DESIGN ONLY</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit customer details"
          testID="action-edit-customer"
          onPress={() => navigation.navigate('EditCustomer', { customerId })}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        >
          <Feather name="edit-2" size={15} color={colors.primary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>

      {/* Customer Profile Header Card */}
      <View style={styles.card} testID="customer-detail-info">
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: avatarStyle.background }]}>
            <Text style={[styles.avatarText, { color: avatarStyle.foreground }]}>
              {initialsFor(customer.name)}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {customer.name}
              </Text>
              {/* Stitch shows a "Verified Corporate" checkmark here; there is no verification concept on `Customer`. */}
              <View style={styles.designOnlyChip} accessibilityLabel="Verified badge — DESIGN ONLY, no verification field exists">
                <Text style={styles.designOnlyChipText}>DESIGN ONLY</Text>
              </View>
            </View>
            {!!(customer.address || customer.email) && (
              <Text style={styles.profileSubtitle} numberOfLines={1}>
                {[customer.address, customer.email].filter(Boolean).join(' • ')}
              </Text>
            )}
            <View style={styles.chipsRow}>
              {!!customer.phone && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Call customer"
                  testID="action-call"
                  onPress={() => openPhone(customer.phone!)}
                  style={styles.contactChip}
                >
                  <Feather name="phone" size={12} color={colors.primary} />
                  <Text style={styles.contactChipText}>{customer.phone}</Text>
                </Pressable>
              )}
              {/* Stitch shows a "VAT: GB 982 4410 19" chip here; there is no tax/VAT id field on `Customer`. */}
              <View style={styles.contactChip}>
                <Text style={styles.contactChipText}>Tax ID: DESIGN ONLY</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Prominent Financial Stat Cards — all real, from CustomerBalanceSummary */}
      <View style={styles.card}>
        <View style={styles.balanceHeader}>
          <View>
            <Text style={styles.statLabel}>Outstanding Balance</Text>
            <Text
              style={[styles.balanceValue, summary.outstanding > 0 && styles.balanceValueDanger]}
              testID="summary-outstanding"
            >
              {currencySymbol}{summary.outstanding.toFixed(2)}
            </Text>
          </View>
          {overdueCount > 0 && (
            <View style={styles.overdueBadge} testID="customer-detail-overdue-badge">
              <Feather name="alert-triangle" size={13} color={colors.danger} />
              <Text style={styles.overdueBadgeText}>
                {overdueCount} Overdue Invoice{overdueCount === 1 ? '' : 's'}
              </Text>
            </View>
          )}
        </View>
        {totalBilled > 0 ? (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressUnpaid, { width: `${pctUnpaid}%` }]} />
              <View style={[styles.progressCollected, { width: `${pctCollected}%` }]} />
            </View>
            <View style={styles.progressCaptionRow}>
              <Text style={styles.progressCaption}>{pctUnpaid.toFixed(1)}% unpaid ratio</Text>
              <Text style={styles.progressCaptionCollected}>{pctCollected.toFixed(1)}% collected</Text>
            </View>
          </>
        ) : (
          <Text style={styles.progressCaption}>Nothing billed to this customer yet.</Text>
        )}
      </View>

      <View style={styles.statGridRow}>
        <View style={[styles.card, styles.statTile]}>
          <View style={styles.statTileHeader}>
            <Text style={styles.statLabel}>Total Invoiced</Text>
            <Feather name="file-text" size={16} color={colors.primary} />
          </View>
          <Text style={styles.statTileValue} testID="summary-billed">
            {currencySymbol}{summary.totalBilled.toFixed(2)}
          </Text>
          <Text style={styles.statTileCaption} testID="summary-invoice-count">
            {summary.invoiceCount} Invoice{summary.invoiceCount === 1 ? '' : 's'} Issued
          </Text>
        </View>
        <View style={[styles.card, styles.statTile]}>
          <View style={styles.statTileHeader}>
            <Text style={styles.statLabel}>Paid to Date</Text>
            <Feather name="check-circle" size={16} color="#1E7B41" />
          </View>
          <Text style={[styles.statTileValue, styles.statTileValueGreen]} testID="summary-paid">
            {currencySymbol}{summary.totalPaid.toFixed(2)}
          </Text>
          <Text style={styles.statTileCaption}>
            {paidCount} Settled in Full
          </Text>
        </View>
      </View>

      {/* Quick Action Buttons Row */}
      <View style={styles.ctaRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create invoice"
          testID="action-create-invoice"
          onPress={handleCreateInvoice}
          style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}
        >
          <Feather name="plus" size={18} color={colors.primaryText} />
          <Text style={styles.ctaPrimaryText}>Create Invoice</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Record payment"
          testID="action-record-payment"
          onPress={handleRecordPayment}
          style={({ pressed }) => [styles.ctaSecondary, pressed && styles.pressed]}
        >
          <Feather name="credit-card" size={18} color="#1E7B41" />
          <Text style={styles.ctaSecondaryText}>Record Payment</Text>
        </Pressable>
      </View>

      {/* Contact quick-actions — Stitch shows a single "mail" icon button here; the rest appear when the matching field is set (same behavior this screen already had). */}
      <View style={styles.iconRow}>
        {!!customer.email && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Email customer"
            testID="action-email"
            onPress={() => openEmail(customer.email!)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="mail" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        {!!customer.phone && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="WhatsApp customer"
            testID="action-whatsapp"
            onPress={() => openWhatsApp(customer.phone!)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="message-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        {!!customer.website && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open website"
            testID="action-website"
            onPress={() => openWebsite(customer.website!)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="globe" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        {!!customer.address && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get directions"
            testID="action-directions"
            onPress={() => openGoogleMaps({ address: customer.address })}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="map-pin" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Interactive Segmented Tabs */}
      <View style={styles.tabsWrap}>
        <Pressable
          testID="customer-detail-tab-invoices"
          onPress={() => setActiveTab('invoices')}
          style={[styles.tab, activeTab === 'invoices' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'invoices' && styles.tabTextActive]}>Invoices</Text>
          <View style={styles.tabCount}>
            <Text style={styles.tabCountText}>{invoices.length}</Text>
          </View>
        </Pressable>
        <Pressable
          testID="customer-detail-tab-payments"
          onPress={() => setActiveTab('payments')}
          style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>Payments</Text>
          <View style={styles.tabCount}>
            <Text style={styles.tabCountText}>{paymentEntries.length}</Text>
          </View>
        </Pressable>
      </View>

      {/* Customer's Ledger Items */}
      <View style={styles.listSection}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderLabel}>Recent Transactions</Text>
          {/* Stitch's "Filter by date" control has no backing implementation — neither invoiceStore nor customerActivityStore support a date-range filter scoped to one customer. */}
          <View style={styles.filterByDateBadge} testID="customer-detail-date-filter-design-only">
            <Feather name="calendar" size={12} color={colors.textMuted} />
            <Text style={styles.filterByDateText}>DESIGN ONLY</Text>
          </View>
        </View>

        {activeTab === 'invoices' && (
          <View style={styles.invoicesList} testID="customer-detail-invoices">
            {invoices.length === 0 ? (
              <Text style={styles.emptyText}>No invoices yet.</Text>
            ) : (
              invoices.map((entry) => (
                <InvoiceLedgerRow
                  key={entry.invoice.id}
                  entry={entry}
                  onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: entry.invoice.id })}
                  testID={`customer-invoice-row-${entry.invoice.id}`}
                />
              ))
            )}
          </View>
        )}

        {activeTab === 'payments' && (
          <View style={styles.invoicesList} testID="customer-detail-payments">
            {paymentEntries.length === 0 ? (
              <Text style={styles.emptyText}>No payments yet.</Text>
            ) : (
              paymentEntries.map((entry) => (
                <CustomerActivityRow
                  key={entry.id}
                  entry={entry}
                  testID={`customer-payment-row-${entry.id}`}
                />
              ))
            )}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View full history"
          testID="action-view-history"
          onPress={() => navigation.navigate('CustomerHistory', { customerId })}
          style={({ pressed }) => [styles.historyLink, pressed && styles.pressed]}
        >
          <Text style={styles.historyLinkText}>View full history</Text>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InvoiceLedgerRow({
  entry,
  onPress,
  testID,
}: {
  entry: InvoiceWithStatus;
  onPress: () => void;
  testID?: string;
}) {
  const { invoice, status, totals } = entry;
  const currencySymbol = useCurrencySymbol();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open invoice ${invoice.invoiceNumber}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.ledgerRow, pressed && styles.pressed]}
    >
      <View style={styles.ledgerRowLeft}>
        <View style={[styles.ledgerIcon, { backgroundColor: STATUS_BACKGROUND[status] }]}>
          <Feather name={STATUS_ICON[status]} size={18} color={STATUS_TEXT[status]} />
        </View>
        <View style={styles.ledgerInfo}>
          <View style={styles.ledgerTitleRow}>
            <Text style={styles.ledgerNumber} numberOfLines={1}>
              {invoice.invoiceNumber}
            </Text>
            <InvoiceStatusBadge status={status} />
          </View>
          <Text style={[styles.ledgerCaption, status === 'overdue' && styles.ledgerCaptionDanger]}>
            {invoiceCaption(entry)}
          </Text>
        </View>
      </View>
      <View style={styles.ledgerTrailing}>
        <Text style={[styles.ledgerAmount, status === 'overdue' && styles.ledgerCaptionDanger]}>
          {currencySymbol}{totals.grandTotal.toFixed(2)}
        </Text>
        <Text style={styles.ledgerSecondaryCaption} numberOfLines={1}>
          {itemSummary(entry)}
        </Text>
      </View>
    </Pressable>
  );
}

function invoiceCaption(entry: InvoiceWithStatus): string {
  const { invoice, status } = entry;
  if (status === 'overdue') {
    return `Overdue • due ${formatIsoDate(invoice.dueDate)}`;
  }
  if (status === 'paid') {
    return `Issued ${formatIsoDate(invoice.issueDate)}`;
  }
  return invoice.dueDate ? `Due ${formatIsoDate(invoice.dueDate)}` : `Issued ${formatIsoDate(invoice.issueDate)}`;
}

function itemSummary(entry: InvoiceWithStatus): string {
  const { items } = entry.invoice;
  if (items.length === 0) {
    return '';
  }
  if (items.length === 1) {
    return items[0].itemName;
  }
  return `${items.length} items`;
}

function formatIsoDate(isoDate: string | null): string {
  if (!isoDate) {
    return '—';
  }
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  pressed: { opacity: 0.75 },

  subBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  idBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.surface },
  idBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textMuted },
  statusText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  editButtonText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  profileRow: { flexDirection: 'row', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 20, fontWeight: '700' },
  profileInfo: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
  designOnlyChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.background },
  designOnlyChipText: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.2 },
  profileSubtitle: { fontSize: 13, color: colors.textMuted },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  contactChipText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },

  balanceHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  balanceValue: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 4, letterSpacing: -0.5 },
  balanceValueDanger: { color: colors.danger },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FBE4E2',
  },
  overdueBadgeText: { fontSize: 11, fontWeight: '700', color: colors.danger },
  progressTrack: {
    flexDirection: 'row',
    marginTop: 12,
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  progressUnpaid: { backgroundColor: colors.danger, height: '100%' },
  progressCollected: { backgroundColor: '#1E7B41', height: '100%' },
  progressCaptionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressCaption: { fontSize: 11, color: colors.textMuted },
  progressCaptionCollected: { fontSize: 11, color: '#1E7B41', fontWeight: '600' },

  statGridRow: { flexDirection: 'row', gap: 12 },
  statTile: { flex: 1, gap: 4 },
  statTileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statTileValue: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4 },
  statTileValueGreen: { color: '#1E7B41' },
  statTileCaption: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  ctaRow: { flexDirection: 'row', gap: 10 },
  ctaPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaPrimaryText: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
  ctaSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaSecondaryText: { color: colors.text, fontWeight: '700', fontSize: 14 },

  iconRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabsWrap: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: colors.background },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.background },
  tabCountText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },

  listSection: { gap: 10 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterByDateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterByDateText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  invoicesList: { gap: 10 },
  emptyText: { fontSize: 13, color: colors.textMuted },

  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ledgerRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  ledgerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ledgerInfo: { flex: 1, minWidth: 0, gap: 3 },
  ledgerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ledgerNumber: { fontSize: 14, fontWeight: '700', color: colors.text },
  ledgerCaption: { fontSize: 11, color: colors.textMuted },
  ledgerCaptionDanger: { color: colors.danger },
  ledgerTrailing: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  ledgerAmount: { fontSize: 15, fontWeight: '700', color: colors.text },
  ledgerSecondaryCaption: { fontSize: 11, color: colors.textMuted, maxWidth: 120 },

  historyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  historyLinkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
