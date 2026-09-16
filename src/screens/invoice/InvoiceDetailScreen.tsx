import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceLineRow } from '@/components/invoice/InvoiceLineRow';
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge';
import { InvoiceTotalsSummary } from '@/components/invoice/InvoiceTotalsSummary';
import { PaymentListRow } from '@/components/payment/PaymentListRow';
import { PaymentSummaryCard } from '@/components/payment/PaymentSummaryCard';
import { OverflowMenu } from '@/components/shared/OverflowMenu';
import type { Customer } from '@/domain/customer/types';
import { getCurrencySymbol } from '@/domain/business/currency';
import type { Invoice } from '@/domain/invoice/types';
import { describeLineMeasurement } from '@/domain/invoiceType/calculators';
import { getInvoiceTypeDefinition } from '@/domain/invoiceType/invoiceTypeRegistry';
import { summarizeInvoicePayments, type InvoicePaymentSummary } from '@/domain/payment/calculations';
import type { Payment } from '@/domain/payment/types';
import { formatTimestamp } from '@/domain/shared/formatting';
import { openEmail, openGoogleMaps, openPhone, openWebsite } from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { useCurrencySymbol } from '@/state/currencyContext';
import { useCustomerStore } from '@/state/customerStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceStore, type InvoiceWithStatus } from '@/state/invoiceStore';
import { usePaymentStore } from '@/state/paymentStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceDetail'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

/** Falls back to the invoice's own name snapshot if the customer contact can no longer be found. */
function customerFromInvoiceSnapshot(invoice: Invoice): Customer {
  return {
    id: invoice.customerId,
    name: invoice.customerName,
    phone: null,
    email: null,
    website: null,
    address: null,
    notes: null,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

/**
 * Invoice Detail, restyled to match the Stitch "Invoice Detail" design: a
 * breadcrumb strip, a Hero Status card (status pill, a real link to the
 * customer's own profile, issued/aging dates), a Financial Balances card
 * (remaining-due callout, invoiced vs. paid, settlement progress — all
 * computed from the same real `paymentSummary`/`totals` the original screen
 * already loaded), the Line Items + totals card, a Payment History card, a
 * supplemental Invoice Details grid, and a sticky Edit / Share PDF / Record
 * Payment action bar.
 *
 * Per the earlier investigation, every action on this screen was already
 * real and backend-wired before this restyle (payments, PDF/sharing, edit,
 * delete, duplicate, contact actions) — nothing here needed new wiring.
 * Two Stitch elements have no backing field anywhere in this app and are
 * DESIGN ONLY, both left inert-but-visible in the overflow menu:
 * - "Export CSV" — no CSV export exists.
 * - "Void Invoice" — invoices have no void/cancelled status; only Delete is
 *   real (a hard delete, already wired).
 * The Invoice Details grid's "Payment Terms" reuses the real
 * `invoice.terms` and "Currency" shows the business's own currency
 * (`BusinessProfile.currency`, set on Business/Invoice Settings) — `Invoice`
 * has no per-invoice currency field of its own, so this is the business-wide
 * value, same as every other money figure on this screen.
 */
export function InvoiceDetailScreen({ navigation, route }: Props) {
  const { invoiceId } = route.params;
  const { getDetail, remove } = useInvoiceStore();
  const { getById: getCustomerById } = useCustomerStore();
  const { listByInvoice } = usePaymentStore();
  const { profile: businessProfile, load: loadBusinessProfile } = useBusinessProfileStore();
  const currencySymbol = useCurrencySymbol();
  const currencyLabel = businessProfile ? `${businessProfile.currency} (${getCurrencySymbol(businessProfile.currency)})` : currencySymbol;
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [detail, setDetail] = useState<InvoiceWithStatus | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<InvoicePaymentSummary | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadBusinessProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const result = await getDetail(invoiceId);
        if (cancelled) {
          return;
        }
        if (!result) {
          setStatus('not-found');
          return;
        }
        const [invoicePayments, invoiceCustomer] = await Promise.all([
          listByInvoice(invoiceId),
          getCustomerById(result.invoice.customerId),
        ]);
        if (cancelled) {
          return;
        }
        setDetail(result);
        setPayments(invoicePayments);
        setPaymentSummary(summarizeInvoicePayments(result.totals.grandTotal, invoicePayments));
        setCustomer(invoiceCustomer ?? customerFromInvoiceSnapshot(result.invoice));
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
  }, [invoiceId]);

  const handleDuplicate = async () => {
    if (!detail) {
      return;
    }
    const customer = (await getCustomerById(detail.invoice.customerId)) ?? customerFromInvoiceSnapshot(detail.invoice);
    useInvoiceDraftStore.getState().startDuplicate(detail.invoice, customer);
    navigation.navigate('InvoiceReview');
  };

  const handleDelete = () => {
    if (!detail) {
      return;
    }
    Alert.alert(
      'Delete invoice',
      `Delete invoice "${detail.invoice.invoiceNumber}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(detail.invoice.id);
              navigation.goBack();
            } catch {
              Alert.alert("Couldn't delete", 'This invoice could not be deleted. Please try again.');
            }
          },
        },
      ],
    );
  };

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="invoice-detail-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="invoice-detail-not-found">
        <Text style={styles.errorText}>This invoice no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error' || !detail) {
    return (
      <View style={styles.centered} testID="invoice-detail-error">
        <Text style={styles.errorText}>Couldn't load this invoice.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const { invoice, totals, status: invoiceStatus } = detail;
  const initials = getInitials(invoice.customerName);
  const agingLabel = describeAging(invoice.dueDate, invoiceStatus);
  const settlementPercent =
    paymentSummary && totals.grandTotal > 0
      ? Math.max(0, Math.min(100, Math.round((paymentSummary.amountPaid / totals.grandTotal) * 100)))
      : 0;

  return (
    <View style={styles.screen} testID="invoice-detail-screen">
      {/* Breadcrumb strip: real Pricing Method label (Stitch's mock shows a
          fake "Commercial B2B" business-category tag with no backing field —
          Pricing Method is the real, already-displayed equivalent). */}
      <View style={styles.breadcrumbRow}>
        <Text style={styles.breadcrumbText}>{getInvoiceTypeDefinition(invoice.invoiceTypeId).label}</Text>
        <View style={styles.breadcrumbSpacer} />
        <OverflowMenu
          testID="invoice-detail-menu"
          items={[
            {
              label: 'Edit invoice',
              onPress: () => navigation.navigate('EditInvoice', { invoiceId }),
              testID: 'action-edit-invoice',
            },
            { label: 'Duplicate', onPress: handleDuplicate, testID: 'action-duplicate-invoice' },
            {
              label: 'Download PDF',
              onPress: () => navigation.navigate('InvoicePdfPreview', { invoiceId }),
              testID: 'action-download-pdf',
            },
            {
              label: 'Export CSV · DESIGN ONLY',
              onPress: () => Alert.alert('Not available', 'CSV export is not implemented yet.'),
              testID: 'action-export-csv-design-only',
            },
            {
              label: 'Void invoice · DESIGN ONLY',
              onPress: () => Alert.alert('Not available', 'Invoices have no "void" status — only Delete is real.'),
              testID: 'action-void-invoice-design-only',
            },
            { label: 'Delete invoice', onPress: handleDelete, destructive: true, testID: 'action-delete-invoice' },
          ]}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Hero Status card */}
        <View style={styles.heroCard}>
          {(invoiceStatus === 'overdue' || invoiceStatus === 'unpaid') && <View style={styles.heroTint} />}
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>Issued Invoice</Text>
              <Text style={styles.heroNumber}>{invoice.invoiceNumber}</Text>
            </View>
            <InvoiceStatusBadge status={invoiceStatus} testID="invoice-detail-status" />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open customer ${invoice.customerName}`}
            testID="action-open-customer"
            onPress={() => navigation.navigate('CustomerDetail', { customerId: invoice.customerId })}
            style={({ pressed }) => [styles.customerTile, pressed && styles.pressed]}
          >
            <View style={styles.customerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.customerTextCol}>
                <Text style={styles.customerLabel}>Customer</Text>
                <Text style={styles.customerName} numberOfLines={1}>
                  {invoice.customerName}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Issued On</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Aging Timeline</Text>
              <Text style={[styles.metaValue, invoiceStatus === 'overdue' && styles.metaValueOverdue]}>
                {agingLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Financial Balances card — same real numbers `PaymentSummaryCard` shows below, restated as a prominent callout + progress bar. */}
        {!!paymentSummary && (
          <View style={styles.balancesCard}>
            <View style={styles.balancesHeaderRow}>
              <Text style={styles.sectionTitle}>Financial Balances</Text>
              <Text style={styles.currencyTag}>{currencyLabel}</Text>
            </View>
            <View
              style={[
                styles.balanceCallout,
                paymentSummary.overpaid > 0 || paymentSummary.remaining <= 0
                  ? styles.balanceCalloutSettled
                  : styles.balanceCalloutDue,
              ]}
            >
              <Text
                style={[
                  styles.balanceCalloutLabel,
                  paymentSummary.overpaid > 0 || paymentSummary.remaining <= 0
                    ? styles.balanceCalloutLabelSettled
                    : styles.balanceCalloutLabelDue,
                ]}
              >
                {paymentSummary.overpaid > 0 ? 'Overpaid' : 'Remaining Balance Due'}
              </Text>
              <Text
                style={[
                  styles.balanceCalloutValue,
                  paymentSummary.overpaid > 0 || paymentSummary.remaining <= 0
                    ? styles.balanceCalloutValueSettled
                    : styles.balanceCalloutValueDue,
                ]}
              >
                {currencySymbol}
                {(paymentSummary.overpaid > 0 ? paymentSummary.overpaid : paymentSummary.remaining).toFixed(2)}
              </Text>
            </View>
            <View style={styles.balancesGrid}>
              <View style={styles.balancesGridCell}>
                <Text style={styles.metaLabel}>Total Invoiced</Text>
                <Text style={styles.balancesGridValue}>{currencySymbol}{totals.grandTotal.toFixed(2)}</Text>
              </View>
              <View style={styles.balancesGridCell}>
                <Text style={styles.metaLabel}>Amount Paid</Text>
                <Text style={[styles.balancesGridValue, styles.balancesGridValueMuted]}>
                  {currencySymbol}{paymentSummary.amountPaid.toFixed(2)}
                </Text>
              </View>
            </View>
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.metaLabel}>Settlement Progress</Text>
                <Text style={styles.progressPercent}>{settlementPercent}% Settled</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${settlementPercent}%` }]} />
              </View>
            </View>
          </View>
        )}

        {!!customer && (customer.phone || customer.email || customer.website || customer.address) && (
          <View style={styles.row}>
            {!!customer.phone && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Call"
                testID="action-call"
                onPress={() => openPhone(customer.phone!)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <Feather name="phone" size={18} color={colors.textMuted} />
              </Pressable>
            )}
            {!!customer.email && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Email"
                testID="action-email"
                onPress={() => openEmail(customer.email!)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <Feather name="mail" size={18} color={colors.textMuted} />
              </Pressable>
            )}
            {!!customer.website && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Website"
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
                accessibilityLabel="Directions"
                testID="action-directions"
                onPress={() => openGoogleMaps({ address: customer.address })}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <Feather name="map-pin" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}

        {/* Line Items card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.sectionTitle}>Line Items</Text>
              <View style={styles.entriesBadge}>
                <Text style={styles.entriesBadgeText}>
                  {invoice.items.length} {invoice.items.length === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
            </View>
            <Text style={styles.readOnlyCaption}>Read-only view</Text>
          </View>
          <View style={styles.itemsSection}>
            {invoice.items.map((line) => (
              <InvoiceLineRow
                key={line.id}
                itemName={line.itemName}
                quantity={line.quantity}
                unit={line.unit}
                measurementLabel={describeLineMeasurement(line.pricingMethodId ?? invoice.invoiceTypeId, line)}
                unitPrice={line.unitPrice}
                lineTotal={line.lineTotal}
                testID={`invoice-detail-line-${line.id}`}
              />
            ))}
          </View>
          <InvoiceTotalsSummary totals={totals} testID="invoice-detail-totals" />
        </View>

        {/* Payment History card */}
        {!!paymentSummary && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Payment History</Text>
              <Text style={styles.readOnlyCaption}>Ledger log</Text>
            </View>
            <PaymentSummaryCard summary={paymentSummary} testID="invoice-detail-payment-summary" />
            {payments.length === 0 && (
              <View style={styles.emptyPaymentsCard}>
                <View style={styles.emptyPaymentsIcon}>
                  <Feather name="file-text" size={22} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyPaymentsTitle} testID="invoice-detail-no-payments">
                  No payments recorded yet
                </Text>
                <Text style={styles.emptyPaymentsSubtitle}>
                  Record the first settlement to balance the accounts receivable ledger.
                </Text>
              </View>
            )}
            {payments.map((paymentRow) => (
              <PaymentListRow
                key={paymentRow.id}
                payment={paymentRow}
                showInvoiceAndCustomer={false}
                onPress={() => navigation.navigate('EditPayment', { paymentId: paymentRow.id })}
                testID={`invoice-detail-payment-${paymentRow.id}`}
              />
            ))}
          </View>
        )}

        {/* Supplemental Invoice Details grid */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailsCell}>
              <Text style={styles.metaLabel}>Payment Terms</Text>
              <Text style={styles.metaValue}>{invoice.terms || 'Not set'}</Text>
            </View>
            <View style={styles.detailsCell}>
              <Text style={styles.metaLabel}>Currency</Text>
              <Text style={styles.metaValue}>{currencyLabel}</Text>
            </View>
          </View>
        </View>

        {!!invoice.notes && (
          <View style={styles.textCard}>
            <Text style={styles.textLabel}>Notes</Text>
            <Text style={styles.textValue}>{invoice.notes}</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom action bar: quick Edit icon + Share PDF + Record Payment (primary) — matches the Stitch layout. */}
      <View style={styles.actionBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit invoice"
          testID="action-edit-invoice-quick"
          onPress={() => navigation.navigate('EditInvoice', { invoiceId })}
          style={({ pressed }) => [styles.editIconButton, pressed && styles.pressed]}
        >
          <Feather name="edit-2" size={18} color={colors.textMuted} />
        </Pressable>
        <View style={styles.sharePdfWrap}>
          <ActionButton
            label="Share PDF"
            icon="share"
            onPress={() => navigation.navigate('InvoicePdfPreview', { invoiceId })}
            testID="action-share"
          />
        </View>
        <View style={styles.recordPaymentWrap}>
          <ActionButton
            label="Record Payment"
            icon="dollar-sign"
            variant="primary"
            onPress={() => navigation.navigate('RecordPayment', { invoiceId })}
            testID="action-record-payment"
          />
        </View>
      </View>
    </View>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + second).toUpperCase();
}

/** Real aging computation from the invoice's own `dueDate` — never fabricated, matching `computeInvoiceStatus`'s own date math. */
function describeAging(dueDate: string | null, status: InvoiceWithStatus['status']): string {
  if (status === 'paid') {
    return 'Settled';
  }
  if (!dueDate) {
    return 'No due date';
  }
  const today = new Date().toISOString().slice(0, 10);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${dueDate}T00:00:00`).getTime()) / msPerDay);
  if (diffDays > 0) {
    return `Overdue by ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  }
  if (diffDays === 0) {
    return 'Due today';
  }
  return `Due in ${-diffDays} day${-diffDays === 1 ? '' : 's'}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  pressed: { opacity: 0.75 },

  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  breadcrumbText: { fontSize: 12, color: colors.textMuted },
  breadcrumbDot: { fontSize: 12, color: colors.textMuted },
  breadcrumbSpacer: { flex: 1 },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  heroTint: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.danger },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  heroEyebrow: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroNumber: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 2 },

  customerTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
  },
  customerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DAE2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#3F465C' },
  customerTextCol: { minWidth: 0 },
  customerLabel: { fontSize: 11, color: colors.textMuted },
  customerName: { fontSize: 14, fontWeight: '600', color: colors.text },

  metaGrid: { flexDirection: 'row', gap: 16, paddingTop: 2 },
  metaCol: { flex: 1, gap: 2 },
  metaLabel: { fontSize: 11, color: colors.textMuted },
  metaValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  metaValueMuted: { fontSize: 13, fontWeight: '600', color: colors.placeholder },
  metaValueOverdue: { color: colors.danger },

  balancesCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  balancesHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  currencyTag: { fontSize: 11, color: colors.textMuted, backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  balanceCallout: { borderRadius: 12, padding: 14, gap: 4 },
  balanceCalloutDue: { backgroundColor: '#FBE4E2' },
  balanceCalloutSettled: { backgroundColor: '#E3F3E8' },
  balanceCalloutLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  balanceCalloutLabelDue: { color: colors.danger },
  balanceCalloutLabelSettled: { color: '#1E7B41' },
  balanceCalloutValue: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  balanceCalloutValueDue: { color: colors.danger },
  balanceCalloutValueSettled: { color: '#1E7B41' },
  balancesGrid: { flexDirection: 'row', gap: 10 },
  balancesGridCell: { flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 10, gap: 2 },
  balancesGridValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  balancesGridValueMuted: { color: colors.textMuted },
  progressSection: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressPercent: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entriesBadge: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  entriesBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  readOnlyCaption: { fontSize: 11, color: colors.textMuted },
  itemsSection: { gap: 8 },

  emptyPaymentsCard: { alignItems: 'center', gap: 4, padding: 20, backgroundColor: colors.background, borderRadius: 12 },
  emptyPaymentsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyPaymentsTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyPaymentsSubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailsCell: { width: '45%', gap: 2 },

  textCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  textLabel: { fontSize: 12, color: colors.textMuted },
  textValue: { fontSize: 13, color: colors.text },

  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharePdfWrap: { flex: 1 },
  recordPaymentWrap: { flex: 1.4 },
});
