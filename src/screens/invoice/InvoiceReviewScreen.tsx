import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceDetailsFormFields } from '@/components/invoice/InvoiceDetailsFormFields';
import { InvoiceLineRow } from '@/components/invoice/InvoiceLineRow';
import { InvoiceTotalsSummary } from '@/components/invoice/InvoiceTotalsSummary';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { InvoiceLimitModal } from '@/components/subscription/InvoiceLimitModal';
import { formatNextInvoiceNumber } from '@/domain/business/types';
import { calculateInvoiceTotals, calculateLineTotal, toLineCalcInput } from '@/domain/invoice/calculations';
import { formValuesToInvoiceDetails, invoiceToDetailsFormDefaults } from '@/domain/invoice/formMapping';
import {
  invoiceDetailsFormSchema,
  type InvoiceDetailsFormOutput,
  type InvoiceDetailsFormValues,
} from '@/domain/invoice/validation';
import { describeLineMeasurement } from '@/domain/invoiceType/calculators';
import { InvoiceLimitError } from '@/domain/subscription/invoiceAccess';
import { PLAN_CONFIG } from '@/domain/subscription/plans';
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
 */
export function InvoiceReviewScreen({ navigation }: Props) {
  const draft = useInvoiceDraftStore();
  const { create, update, getById } = useInvoiceStore();
  const { profile, load: loadProfile } = useBusinessProfileStore();
  const currencySymbol = useCurrencySymbol();
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(true);
  const [limitError, setLimitError] = useState<InvoiceLimitError | null>(null);

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

  const totals = calculateInvoiceTotals(draft.items.map(toLineCalcInput), draft.invoiceTypeId);

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
    } catch (error) {
      if (error instanceof InvoiceLimitError) {
        // The authoritative monthly-limit check (see `invoiceStore.create`). Nothing was saved and no invoice
        // number was used; the draft is kept, so after upgrading the user can come back and save it.
        setLimitError(error);
        return;
      }
      Alert.alert("Couldn't save", 'This invoice could not be saved. Please try again.');
    }
  });

  return (
    <>
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
      </View>

      {/* Line Items preview */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Items Billed ({draft.items.length})</Text>
          <ActionButton label="Review details" onPress={() => navigation.navigate('CreateInvoiceItems')} testID="action-edit-items" />
        </View>
        <View style={styles.itemsList}>
          {draft.items.map((line, index) => {
            const calc = calculateLineTotal(toLineCalcInput(line), draft.invoiceTypeId);
            return (
              <InvoiceLineRow
                key={index}
                itemName={line.itemName}
                quantity={line.quantity}
                unit={line.unit}
                measurementLabel={describeLineMeasurement(draft.invoiceTypeId, line)}
                priceMode={line.priceMode}
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
      </View>
    </KeyboardAvoidingScreen>
    <InvoiceLimitModal
      visible={!!limitError}
      usage={limitError?.usage ?? null}
      planLabel={limitError ? PLAN_CONFIG[limitError.usage.plan].label : ''}
      onDismiss={() => setLimitError(null)}
      onUpgrade={() => {
        setLimitError(null);
        navigation.navigate('Pricing', { reason: 'invoice_limit' });
      }}
      testID="invoice-review-limit-modal"
    />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
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
  pricingMethodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pricingMethodLabel: { fontSize: 12, color: colors.textMuted },
  pricingMethodText: { fontSize: 12, fontWeight: '600', color: colors.text },

  itemsList: { gap: 8 },

  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionBody: { gap: 12, marginTop: 2 },

  footer: { gap: 8, marginTop: 4 },
});
