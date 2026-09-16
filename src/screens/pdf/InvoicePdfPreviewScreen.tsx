import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceTotalsSummary } from '@/components/invoice/InvoiceTotalsSummary';
import { STATUS_BACKGROUND, STATUS_TEXT } from '@/components/invoice/InvoiceStatusBadge';
import { PdfLineItemRow, PDF_ITEM_CELL_WIDTH } from '@/components/pdf/PdfLineItemRow';
import { PaymentSummaryCard } from '@/components/payment/PaymentSummaryCard';
import { TemplatePreview } from '@/components/settings/TemplateCard';
import { getCurrencySymbol } from '@/domain/business/currency';
import { INVOICE_TEMPLATE_OPTIONS, type InvoiceTemplate } from '@/domain/business/types';
import type { InvoiceStatus } from '@/domain/invoice/types';
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
 *
 * Restyled to match the Stitch "PDF Preview & Sharing" design: a header
 * context strip (status pill, customer, total), a template grid reusing
 * `TemplatePreview`'s real per-template swatch (from the Invoice Templates
 * screen), a "Quick Dispatch" grid for WhatsApp/Email/Link, and a sticky
 * bottom Preview/Share bar.
 *
 * Several Stitch elements have no backing capability and are DESIGN ONLY:
 * - Zoom / fit-to-width / refresh viewer controls, and the "Page 1 of 1
 *   (A4 • 142 KB)" stat — the in-app preview is a fixed native re-render,
 *   not a real document viewer (no `react-native-webview`, per the "no
 *   unnecessary packages" rule already documented for this screen), so
 *   there's no real zoom/page-count/file-size to report.
 * - The rendered PDF paper's "Bank Details & Payment QR" block — no bank
 *   account or payment-QR field exists anywhere on `BusinessProfile`.
 * - "SMS / Text" quick-share — no SMS capability is wired (only
 *   WhatsApp/Email/native-share/link are real).
 * - The sticky bar's separate "Download PDF (142 KB)" utility — sharing
 *   already covers "save a copy" via the native share sheet; there's no
 *   distinct device-storage download path.
 * "Copy Link" is relabeled "Share Link" and wired to the real `shareLink()`
 * (native `Share.share`, not a clipboard copy — this app doesn't use
 * `expo-clipboard`) rather than faking a "copied to clipboard" toast.
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
  const statusKey = data.statusLabel.toLowerCase() as InvoiceStatus;
  const statusBg = STATUS_BACKGROUND[statusKey] ?? colors.background;
  const statusFg = STATUS_TEXT[statusKey] ?? colors.textMuted;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} testID="pdf-preview-screen">
        {/* Header context strip */}
        <View style={styles.headerStrip}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerNumber}>{data.invoiceNumber}</Text>
            <Text style={styles.headerTotal}>{getCurrencySymbol(data.currency)}{data.totals.grandTotal.toFixed(2)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusFg }]} />
            <Text style={[styles.statusPillText, { color: statusFg }]}>{data.statusLabel}</Text>
          </View>
          <View style={styles.recipientBar}>
            <View style={styles.recipientLeft}>
              <View style={styles.recipientIcon}>
                <Feather name="briefcase" size={14} color={colors.primary} />
              </View>
              <View style={styles.flexShrink}>
                <Text style={styles.recipientName} numberOfLines={1}>
                  {data.customer.name}
                </Text>
                {!!data.customer.email && (
                  <Text style={styles.recipientDetail} numberOfLines={1}>
                    {data.customer.email}
                  </Text>
                )}
              </View>
            </View>
            {!!data.dueDate && <Text style={styles.recipientDue}>Due {formatDate(data.dueDate)}</Text>}
          </View>
        </View>

        {/* Template selector */}
        <View style={styles.templateSection}>
          <View style={styles.templateHeaderRow}>
            <Text style={styles.sectionTitle}>Invoice PDF Template</Text>
            <View style={styles.activeTemplateBadge}>
              <Text style={styles.activeTemplateBadgeText}>
                Active: {INVOICE_TEMPLATE_OPTIONS.find((o) => o.value === data.template)?.label ?? data.template}
              </Text>
            </View>
          </View>
          <View style={styles.templateGrid}>
            {INVOICE_TEMPLATE_OPTIONS.map((option) => {
              const selected = data.template === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  testID={`pdf-template-picker-${option.value}`}
                  onPress={() => setTemplate(option.value as InvoiceTemplate)}
                  style={({ pressed }) => [styles.templateCard, selected && styles.templateCardSelected, pressed && styles.pressed]}
                >
                  {selected && (
                    <View style={styles.templateCheck}>
                      <Feather name="check" size={11} color={colors.primaryText} />
                    </View>
                  )}
                  <TemplatePreview template={option.value} />
                  <Text style={[styles.templateLabel, selected && styles.templateLabelSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* PDF paper preview */}
        <View style={styles.paperStage}>
          <View style={styles.paper}>
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
            <View style={styles.accentDivider} />
            <SummaryRow label="Status" value={data.statusLabel} />
            <SummaryRow label="Invoice date" value={formatDate(data.issueDate)} />
            {!!data.dueDate && <SummaryRow label="Due date" value={formatDate(data.dueDate)} />}

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
              <View style={styles.textBlock}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.muted}>{data.notes}</Text>
              </View>
            )}
            {!!data.terms && (
              <View style={styles.textBlock}>
                <Text style={styles.sectionTitle}>Terms</Text>
                <Text style={styles.muted}>{data.terms}</Text>
              </View>
            )}

            {/* DESIGN ONLY: no bank account or payment-QR field exists on `BusinessProfile`. */}
            <View style={styles.bankCard} accessibilityLabel="Bank details and payment QR — DESIGN ONLY, no such fields exist">
              <View style={styles.bankLeft}>
                <Text style={styles.bankLabel}>Bank Details · DESIGN ONLY</Text>
                <Text style={styles.bankValue}>Not stored — not included in the generated PDF</Text>
              </View>
              <Feather name="lock" size={16} color={colors.placeholder} />
            </View>
          </View>
        </View>

        {/* Quick Dispatch grid */}
        <View style={styles.dispatchSection}>
          <Text style={styles.sectionTitle}>Quick Dispatch &amp; Share</Text>
          <View style={styles.dispatchGrid}>
            <DispatchTile
              icon="message-circle"
              label="WhatsApp"
              caption={data.customer.phone ?? 'No phone on file'}
              tone="tertiary"
              disabled={!!busyAction}
              onPress={() => runAction('whatsapp', shareViaWhatsApp, 'WhatsApp could not be opened.')}
              testID="pdf-action-whatsapp"
            />
            {emailAvailable ? (
              <DispatchTile
                icon="mail"
                label="Email PDF"
                caption={data.customer.email ?? 'Attach & send'}
                tone="primary"
                disabled={!!busyAction}
                onPress={() => runAction('email', shareViaEmail, 'No email app is available on this device.')}
                testID="pdf-action-email"
              />
            ) : (
              <DispatchTile
                icon="mail"
                label="Email PDF · DESIGN ONLY"
                caption="No email app on this device"
                tone="muted"
                disabled
                onPress={() => Alert.alert('Not available', 'No email app is available on this device.')}
              />
            )}
            <DispatchTile
              icon="link"
              label="Share Link"
              caption="Client portal URL"
              tone="secondary"
              disabled={!!busyAction}
              onPress={() => runAction('link', shareLink, 'The share link could not be shared.')}
              testID="pdf-action-link"
            />
            {/* DESIGN ONLY: no SMS capability is wired anywhere in this app. */}
            <DispatchTile
              icon="message-square"
              label="SMS / Text · DESIGN ONLY"
              caption="Not supported"
              tone="muted"
              disabled
              onPress={() => Alert.alert('Not available', 'SMS sharing is not implemented yet.')}
              testID="pdf-action-sms-design-only"
            />
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom action bar */}
      <View style={styles.footer}>
        <View style={styles.footerShareWrap}>
          <ActionButton
            label="Share PDF"
            icon="share"
            disabled={!!busyAction}
            onPress={() => runAction('share', sharePdf, 'The PDF could not be shared.')}
            testID="pdf-action-share"
          />
        </View>
        <View style={styles.footerPrimaryWrap}>
          <ActionButton
            label="Preview PDF"
            icon="eye"
            variant="primary"
            disabled={!!busyAction}
            onPress={() => runAction('preview', previewPdf, 'The PDF could not be opened for preview.')}
            testID="pdf-action-preview"
          />
        </View>
      </View>
    </View>
  );
}

function DispatchTile({
  icon,
  label,
  caption,
  tone,
  disabled,
  onPress,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  caption: string;
  tone: 'tertiary' | 'primary' | 'secondary' | 'muted';
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const toneStyle = TONE_STYLES[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      disabled={disabled && tone !== 'muted'}
      style={({ pressed }) => [styles.dispatchTile, pressed && styles.pressed, disabled && tone !== 'muted' && styles.dispatchTileDisabled]}
    >
      <View style={[styles.dispatchIcon, { backgroundColor: toneStyle.bg }]}>
        <Feather name={icon} size={18} color={toneStyle.fg} />
      </View>
      <View style={styles.flexShrink}>
        <Text style={styles.dispatchLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.dispatchCaption} numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const TONE_STYLES: Record<'tertiary' | 'primary' | 'secondary' | 'muted', { bg: string; fg: string }> = {
  tertiary: { bg: '#DBFCEC', fg: '#006243' },
  primary: { bg: '#DCE9FF', fg: colors.primary },
  secondary: { bg: '#DAE2FD', fg: '#3F465C' },
  muted: { bg: colors.background, fg: colors.textMuted },
};

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
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.8 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  headerStrip: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 8 },
  headerTopRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headerNumber: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  headerTotal: { fontSize: 18, fontWeight: '700', color: colors.primary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  recipientBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.background, borderRadius: 12, padding: 10 },
  recipientLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  recipientIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  recipientName: { fontSize: 13, fontWeight: '700', color: colors.text },
  recipientDetail: { fontSize: 11, color: colors.textMuted },
  recipientDue: { fontSize: 11, color: colors.textMuted, flexShrink: 0 },

  templateSection: { gap: 10 },
  templateHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  activeTemplateBadge: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  activeTemplateBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primaryText },
  templateGrid: { flexDirection: 'row', gap: 8 },
  templateCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  templateCardSelected: { borderWidth: 2, borderColor: colors.primary },
  templateCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  templateLabelSelected: { color: colors.primary },

  paperStage: { alignItems: 'center', backgroundColor: colors.background },
  paper: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  logo: { width: 56, height: 56, borderRadius: 8 },
  headerText: { flex: 1, gap: 2 },
  businessName: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  accentDivider: { height: 3, borderRadius: 2, backgroundColor: colors.primary, opacity: 0.5, marginVertical: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  section: { gap: 4, marginTop: 6 },
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
  textBlock: { gap: 4, marginTop: 6 },

  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  bankLeft: { flexShrink: 1, gap: 2 },
  bankLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  bankValue: { fontSize: 11, color: colors.placeholder },

  dispatchSection: { gap: 10 },
  dispatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dispatchTile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  dispatchTileDisabled: { opacity: 0.6 },
  dispatchIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dispatchLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  dispatchCaption: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerShareWrap: { flex: 1 },
  footerPrimaryWrap: { flex: 1.4 },
});
