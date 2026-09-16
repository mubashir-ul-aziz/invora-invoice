import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceDetailsFormFields } from '@/components/invoice/InvoiceDetailsFormFields';
import { InvoiceLineRow } from '@/components/invoice/InvoiceLineRow';
import { InvoiceTotalsSummary } from '@/components/invoice/InvoiceTotalsSummary';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { formatNextInvoiceNumber } from '@/domain/business/types';
import { calculateInvoiceTotals, calculateLineTotal } from '@/domain/invoice/calculations';
import { formValuesToInvoiceDetails, invoiceToDetailsFormDefaults } from '@/domain/invoice/formMapping';
import {
  invoiceDetailsFormSchema,
  type InvoiceDetailsFormOutput,
  type InvoiceDetailsFormValues,
} from '@/domain/invoice/validation';
import { describeLineMeasurement } from '@/domain/invoiceType/calculators';
import { getInvoiceTypeDefinition } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { useCurrencySymbol } from '@/state/currencyContext';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceStore } from '@/state/invoiceStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceReview'>;

/**
 * Invoice Review — the final step for create/edit/duplicate alike, branching
 * only on `invoiceDraftStore.mode`. Totals are computed once, by
 * `domain/invoice/calculations.ts`, and rendered by `InvoiceTotalsSummary` —
 * never summed here.
 *
 * Restyled to match the Stitch "Invoice Review" design: a Step 3 of 3
 * progress bar, a draft-number header card, an embedded customer card, a
 * "Payment & Timing" card wrapping the real issue/due date pickers, a Line
 * Items preview, the totals card, a collapsible Notes & Terms section, and a
 * sticky Save footer.
 *
 * DESIGN ONLY elements (no backing field/capability anywhere in this app):
 * - The invoice-number edit pencil — the number is reserved server-side
 *   (`BusinessRepository.reserveNextInvoiceNumber`) and isn't user-editable.
 * - The customer card's "verified" checkmark and "Change customer" swap
 *   icon — `Customer` has no verification field, and there's no flow to
 *   swap the customer of an in-progress draft from this screen.
 * - The "Client Purchase Order" reference chip — `Invoice` has no PO field.
 * - "Instant Dispatch" (auto-send via Email/WhatsApp on save) — saving an
 *   invoice never sends it; sharing is a separate, manual step from Invoice
 *   Detail/PDF Preview afterward.
 * - "Save as Draft" — `Invoice` has no draft/issued status; there is only
 *   one real save path (the primary button).
 * The Stitch mock's "HMRC & UK VAT compliant... cryptographic hash" trust
 * copy isn't reproduced at all — this app makes no such compliance claim
 * and has no hashing of any kind, so no in-between "DESIGN ONLY" phrasing
 * would be honest here either.
 */
export function InvoiceReviewScreen({ navigation }: Props) {
  const draft = useInvoiceDraftStore();
  const { create, update, getById } = useInvoiceStore();
  const { profile, load: loadProfile } = useBusinessProfileStore();
  const currencySymbol = useCurrencySymbol();
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(true);
  const [instantDispatch, setInstantDispatch] = useState(false);

  useEffect(() => {
    loadProfile();
    if (draft.mode === 'edit' && draft.editingInvoiceId) {
      getById(draft.editingInvoiceId).then((invoice) => setExistingInvoiceNumber(invoice?.invoiceNumber ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.mode, draft.editingInvoiceId]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceDetailsFormValues, unknown, InvoiceDetailsFormOutput>({
    resolver: zodResolver(invoiceDetailsFormSchema),
    defaultValues: invoiceToDetailsFormDefaults(draft),
  });

  const totals = calculateInvoiceTotals(
    draft.items.map((line) => ({
      quantity: line.quantity,
      weight: line.weight,
      length: line.length,
      width: line.width,
      height: line.height,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
    })),
    draft.invoiceTypeId,
  );

  const invoiceNumberLabel =
    draft.mode === 'edit'
      ? existingInvoiceNumber
      : profile
        ? formatNextInvoiceNumber(profile.invoicePrefix, profile.businessCode, profile.nextInvoiceNumber)
        : null;

  const onSubmit = handleSubmit(async (values) => {
    const details = formValuesToInvoiceDetails(values);
    if (!draft.customer) {
      Alert.alert("Couldn't save", 'No customer is selected for this invoice.');
      return;
    }
    try {
      const saved =
        draft.mode === 'edit' && draft.editingInvoiceId
          ? await update(draft.editingInvoiceId, { ...details, items: draft.items })
          : await create({
              customerId: draft.customer.id,
              customerName: draft.customer.name,
              invoiceTypeId: draft.invoiceTypeId,
              ...details,
              items: draft.items,
            });
      draft.reset();
      navigation.popToTop();
      navigation.navigate('InvoiceDetail', { invoiceId: saved.id });
    } catch {
      Alert.alert("Couldn't save", 'This invoice could not be saved. Please try again.');
    }
  });

  return (
    <KeyboardAvoidingScreen style={styles.screen} contentContainerStyle={styles.content} testID="invoice-review-screen">
      {/* Step tracker */}
      <View style={styles.stepBar}>
        <View style={styles.stepTopRow}>
          <Text style={styles.stepLabel}>Step 3 of 3 · Final Check</Text>
          <Text style={styles.stepReadyLabel}>Ready to issue</Text>
        </View>
        <View style={styles.stepProgressRow}>
          <View style={[styles.stepSegment, styles.stepSegmentDone]} />
          <View style={[styles.stepSegment, styles.stepSegmentDone]} />
          <View style={[styles.stepSegment, styles.stepSegmentDone]} />
        </View>
      </View>

      {/* Header banner: invoice number + embedded customer card */}
      <View style={styles.card}>
        <View style={styles.headerTopRow}>
          <View style={styles.flexShrink}>
            <View style={styles.draftBadge}>
              <View style={styles.draftBadgeDot} />
              <Text style={styles.draftBadgeText}>DRAFT</Text>
            </View>
            {!!invoiceNumberLabel && (
              <View style={styles.numberRow} testID="review-invoice-number">
                <Text style={styles.numberText}>{invoiceNumberLabel}</Text>
                {/* DESIGN ONLY: the invoice number is server-reserved, not user-editable. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit invoice number — DESIGN ONLY, the number is auto-generated"
                  testID="action-edit-number-design-only"
                  onPress={() => Alert.alert('Not available', 'The invoice number is generated automatically and cannot be edited.')}
                  hitSlop={8}
                >
                  <Feather name="edit-3" size={14} color={colors.primary} />
                </Pressable>
              </View>
            )}
            <Text style={styles.numberCaption}>
              {draft.mode === 'edit' ? 'Existing invoice number' : 'Next number, reserved on save'}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Feather name="file-text" size={24} color={colors.primary} />
          </View>
        </View>

        <View style={styles.customerTile}>
          <View style={styles.flexShrink}>
            <View style={styles.customerNameRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {draft.customer?.name ?? '—'}
              </Text>
            </View>
            {!!draft.customer?.address && (
              <Text style={styles.customerDetail} numberOfLines={1}>
                {draft.customer.address}
              </Text>
            )}
            {!!draft.customer?.email && (
              <View style={styles.customerDetailRow}>
                <Feather name="mail" size={12} color={colors.textMuted} />
                <Text style={styles.customerDetail} numberOfLines={1}>
                  {draft.customer.email}
                </Text>
              </View>
            )}
          </View>
          {/* DESIGN ONLY: no flow exists to swap the customer of an in-progress draft from Review. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change customer — DESIGN ONLY, not supported from this screen"
            testID="action-change-customer-design-only"
            onPress={() => Alert.alert('Not available', 'To use a different customer, start a new invoice.')}
            hitSlop={8}
            style={styles.customerSwapButton}
          >
            <Feather name="repeat" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.pricingMethodRow}>
          <Text style={styles.pricingMethodLabel}>Pricing Method</Text>
          <Text style={styles.pricingMethodText}>{getInvoiceTypeDefinition(draft.invoiceTypeId).label}</Text>
        </View>
      </View>

      {/* Payment & Timing */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Payment &amp; Timing</Text>
        </View>
        <InvoiceDetailsFormFields control={control} errors={errors} section="dates" />

        {/* DESIGN ONLY: `Invoice` has no purchase-order reference field. */}
        <View style={styles.poRow} accessibilityLabel="Client purchase order — DESIGN ONLY, no such field exists">
          <View style={styles.poIcon}>
            <Feather name="tag" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.poLabel}>Client Purchase Order · DESIGN ONLY</Text>
            <Text style={styles.poValue}>Not tracked</Text>
          </View>
        </View>
      </View>

      {/* Line Items preview */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Items Billed ({draft.items.length})</Text>
          <ActionButton label="Review details" onPress={() => navigation.navigate('CreateInvoiceItems')} testID="action-edit-items" />
        </View>
        <View style={styles.itemsList}>
          {draft.items.map((line, index) => {
            const calc = calculateLineTotal(
              {
                quantity: line.quantity,
                weight: line.weight,
                length: line.length,
                width: line.width,
                height: line.height,
                unitPrice: line.unitPrice,
                discountPercent: line.discountPercent,
                taxPercent: line.taxPercent,
              },
              draft.invoiceTypeId,
            );
            return (
              <InvoiceLineRow
                key={index}
                itemName={line.itemName}
                quantity={line.quantity}
                unit={line.unit}
                measurementLabel={describeLineMeasurement(draft.invoiceTypeId, line)}
                unitPrice={line.unitPrice}
                lineTotal={calc.lineTotal}
                testID={`review-line-${index}`}
              />
            );
          })}
        </View>
      </View>

      <InvoiceTotalsSummary totals={totals} testID="invoice-review-totals" />

      {/* Notes & Terms — real fields, collapsible */}
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle notes and terms"
          onPress={() => setNotesOpen((v) => !v)}
          style={styles.accordionHeader}
        >
          <View style={styles.cardHeaderRow}>
            <Feather name="file-text" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Notes &amp; Payment Terms</Text>
          </View>
          <Feather name={notesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </Pressable>
        {notesOpen && (
          <View style={styles.accordionBody}>
            <InvoiceDetailsFormFields control={control} errors={errors} section="notes" />
          </View>
        )}
      </View>

      {/* DESIGN ONLY: saving an invoice never auto-sends it — sharing is a separate manual step afterward. */}
      <View style={styles.card}>
        <View style={styles.dispatchRow}>
          <View style={styles.dispatchLeft}>
            <View style={styles.headerIconSmall}>
              <Feather name="send" size={18} color={colors.primary} />
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.dispatchTitle}>Instant Dispatch · DESIGN ONLY</Text>
              <Text style={styles.dispatchCaption}>Send copy immediately via Email &amp; WhatsApp to client</Text>
            </View>
          </View>
          <Switch
            value={instantDispatch}
            onValueChange={setInstantDispatch}
            trackColor={{ true: colors.primary, false: colors.border }}
            testID="toggle-instant-dispatch-design-only"
          />
        </View>
      </View>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <ActionButton
          label={isSubmitting ? 'Saving…' : `Save & Issue Invoice (${currencySymbol}${totals.grandTotal.toFixed(2)})`}
          variant="primary"
          icon="send"
          onPress={onSubmit}
          disabled={isSubmitting}
          testID="save-invoice"
        />
        {/* DESIGN ONLY: `Invoice` has no draft/issued status — there is only one real save path. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save as draft — DESIGN ONLY, invoices have no draft status"
          testID="action-save-as-draft-design-only"
          onPress={() => Alert.alert('Not available', 'There is no separate draft state — Save creates the real invoice.')}
          style={({ pressed }) => [styles.draftButton, pressed && styles.pressed]}
        >
          <Feather name="bookmark" size={16} color={colors.textMuted} />
          <Text style={styles.draftButtonText}>Save as Draft · DESIGN ONLY</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  stepBar: { gap: 6 },
  stepTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  stepReadyLabel: { fontSize: 12, fontWeight: '600', color: colors.primary },
  stepProgressRow: { flexDirection: 'row', gap: 6 },
  stepSegment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  stepSegmentDone: { backgroundColor: colors.primary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },

  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  draftBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  draftBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.4 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numberText: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  numberCaption: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  customerTile: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  customerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  customerDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  customerDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  customerSwapButton: { padding: 6, borderRadius: 8 },
  pricingMethodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pricingMethodLabel: { fontSize: 12, color: colors.textMuted },
  pricingMethodText: { fontSize: 12, fontWeight: '600', color: colors.text },

  poRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 12, padding: 12 },
  poIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  poLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  poValue: { fontSize: 13, color: colors.text, marginTop: 2 },

  itemsList: { gap: 8 },

  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionBody: { gap: 12, marginTop: 2 },

  dispatchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dispatchLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  dispatchTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  dispatchCaption: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  footer: { gap: 8, marginTop: 4 },
  draftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  draftButtonText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
});
