import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { OptionPicker } from '@/components/business/OptionPicker';
import { InvoiceTotalsSummary } from '@/components/invoice/InvoiceTotalsSummary';
import { PdfLineItemRow, PDF_ITEM_CELL_WIDTH } from '@/components/pdf/PdfLineItemRow';
import { PaymentSummaryCard } from '@/components/payment/PaymentSummaryCard';
import { INVOICE_TEMPLATE_OPTIONS, type InvoiceTemplate } from '@/domain/business/types';
import { getPdfItemColumns } from '@/domain/pdf/itemColumns';
import type { RootStackParamList } from '@/navigation/types';
import { usePdfStore } from '@/state/pdfStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoicePdfPreview'>;

/**
 * "Invoice PDF Preview" + "Invoice Sharing" (Phase 9), folded into one
 * screen — reached from Invoice Detail's "Share / PDF" action. The visual
 * preview below is a native re-rendering of the exact same `InvoicePdfData`
 * the real PDF is generated from (same totals/payment-summary components
 * Invoice Detail already uses, same resolved item columns) — not a
 * pixel-perfect mirror of each template's PDF styling, which only the
 * generated PDF itself shows (see "Preview PDF" below and the known
 * limitations in IMPLEMENTATION_STATUS.md).
 */
export function InvoicePdfPreviewScreen({ navigation, route }: Props) {
  const { invoiceId } = route.params;
  const {
    status,
    error,
    data,
    loadForInvoice,
    setTemplate,
    previewPdf,
    sharePdf,
    shareViaEmail,
    shareViaWhatsApp,
    shareLink,
    isEmailAvailable,
  } = usePdfStore();
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadForInvoice(invoiceId);
      const available = await isEmailAvailable();
      if (!cancelled) {
        setEmailAvailable(available);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const runAction = async (name: string, action: () => Promise<void>, failureMessage: string) => {
    setBusyAction(name);
    try {
      await action();
    } catch {
      Alert.alert("Couldn't complete this action", failureMessage);
    } finally {
      setBusyAction(null);
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="pdf-preview-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="pdf-preview-not-found">
        <Text style={styles.errorText}>This invoice no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error' || !data) {
    return (
      <View style={styles.centered} testID="pdf-preview-error">
        <Text style={styles.errorText}>{error ?? "Couldn't generate this invoice's PDF."}</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const columns = getPdfItemColumns(data.fieldConfig);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="pdf-preview-screen">
      <OptionPicker
        label="Template"
        options={INVOICE_TEMPLATE_OPTIONS}
        value={data.template}
        onChange={(template: InvoiceTemplate) => setTemplate(template)}
        testID="pdf-template-picker"
      />

      <View style={styles.card}>
        <View style={styles.headerRow}>
          {!!data.logoDataUri && (
            <Image source={{ uri: data.logoDataUri }} style={styles.logo} resizeMode="contain" />
          )}
          <View style={styles.headerText}>
            <Text style={styles.businessName}>{data.business.businessName}</Text>
            {!!data.business.address && <Text style={styles.muted}>{data.business.address}</Text>}
            {!!data.business.phone && <Text style={styles.muted}>{data.business.phone}</Text>}
            {!!data.business.email && <Text style={styles.muted}>{data.business.email}</Text>}
          </View>
        </View>
        <View style={styles.divider} />
        <SummaryRow label="Invoice" value={data.invoiceNumber} />
        <SummaryRow label="Status" value={data.statusLabel} />
        <SummaryRow label="Bill to" value={data.customer.name} />
        <SummaryRow label="Invoice date" value={formatDate(data.issueDate)} />
        {!!data.dueDate && <SummaryRow label="Due date" value={formatDate(data.dueDate)} />}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {/*
          Every item stays on one row (`PdfLineItemRow`'s fixed-width cells,
          no wrapping) — this horizontal ScrollView is what keeps the table
          readable on a narrow phone instead of squeezing or wrapping
          columns: it scrolls sideways for the extra columns a pricing
          method with more fields (e.g. Volume) adds, rather than breaking
          a line item across multiple visual rows.
        */}
        <ScrollView horizontal showsHorizontalScrollIndicator testID="pdf-preview-items-scroll">
          <View>
            <View style={styles.itemsHeaderRow}>
              {columns.map((column) => (
                <Text
                  key={column.key}
                  style={[styles.itemsHeaderCell, column.align === 'right' && styles.itemsHeaderCellRight]}
                >
                  {column.label}
                </Text>
              ))}
            </View>
            {data.items.map((item) => (
              <PdfLineItemRow
                key={item.id}
                item={item}
                columns={columns}
                currency={data.currency}
                testID={`pdf-preview-line-${item.id}`}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <InvoiceTotalsSummary totals={data.totals} testID="pdf-preview-totals" />
      <PaymentSummaryCard summary={data.payment} testID="pdf-preview-payment-summary" />

      {!!data.notes && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.muted}>{data.notes}</Text>
        </View>
      )}
      {!!data.terms && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Terms</Text>
          <Text style={styles.muted}>{data.terms}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <ActionButton
          label="Preview PDF"
          variant="primary"
          disabled={!!busyAction}
          onPress={() => runAction('preview', previewPdf, 'The PDF could not be opened for preview.')}
          testID="pdf-action-preview"
        />
        <ActionButton
          label="Share PDF"
          disabled={!!busyAction}
          onPress={() => runAction('share', sharePdf, 'The PDF could not be shared.')}
          testID="pdf-action-share"
        />
        <ActionButton
          label="Share via WhatsApp"
          disabled={!!busyAction}
          onPress={() => runAction('whatsapp', shareViaWhatsApp, 'WhatsApp could not be opened.')}
          testID="pdf-action-whatsapp"
        />
        {emailAvailable && (
          <ActionButton
            label="Share via Email"
            disabled={!!busyAction}
            onPress={() => runAction('email', shareViaEmail, 'No email app is available on this device.')}
            testID="pdf-action-email"
          />
        )}
        <ActionButton
          label="Share link"
          disabled={!!busyAction}
          onPress={() => runAction('link', shareLink, 'The share link could not be shared.')}
          testID="pdf-action-link"
        />
      </View>
    </ScrollView>
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

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600', textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  logo: { width: 56, height: 56, borderRadius: 8 },
  headerText: { flex: 1, gap: 2 },
  businessName: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  section: { gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  itemsHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6 },
  itemsHeaderCell: {
    width: PDF_ITEM_CELL_WIDTH,
    paddingRight: 8,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  itemsHeaderCellRight: { textAlign: 'right' },
  actions: { gap: 10 },
});
