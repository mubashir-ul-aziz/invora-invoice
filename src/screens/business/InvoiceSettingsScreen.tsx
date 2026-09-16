import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { OptionPicker } from '@/components/business/OptionPicker';
import { ActionButton } from '@/components/businessCard/ActionButton';
import { FormField } from '@/components/businessCard/FormField';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { TemplatePreview } from '@/components/settings/TemplateCard';
import { formValuesToSettingsInput, settingsToFormDefaults } from '@/domain/business/formMapping';
import {
  formatNextInvoiceNumber,
  INVOICE_TEMPLATE_OPTIONS,
  INVOICE_TYPE_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  type InvoiceTemplate,
} from '@/domain/business/types';
import {
  invoiceSettingsFormSchema,
  type InvoiceSettingsFormOutput,
  type InvoiceSettingsFormValues,
} from '@/domain/business/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceSettings'>;

/**
 * Invoice Settings, restyled to match the Stitch design's card sections —
 * Numbering & Identifiers, Default Invoice Line Type, Payment & Terms,
 * Invoice Template. Every existing field/testID is unchanged.
 *
 * The Stitch mock's "Next Sequence" is shown as an editable number input —
 * this app's real invoice sequence is reserved and advanced exclusively by
 * `BusinessRepository.reserveNextInvoiceNumber()` at invoice-creation time,
 * so it stays the existing read-only display, not a new editable field
 * (unchanged behavior, just restyled to look like the rest of the card).
 * "Default Late Fee Policy" and "Default Notes & Terms" have no backing
 * field anywhere on `InvoiceSettings` and are DESIGN ONLY (local state,
 * never submitted). The Invoice Template card reuses `TemplatePreview` —
 * the same real per-template swatch the dedicated Invoice Templates screen
 * uses — instead of a generic chip row. Per this app's existing "two entry
 * points, one source of truth" design (documented in-code and in
 * `IMPLEMENTATION_STATUS.md`), this screen's template/pricing-method
 * pickers intentionally stay independent from the dedicated Invoice
 * Templates/Invoice Type Selection screens — no link was added between
 * them, matching existing behavior.
 */
export function InvoiceSettingsScreen({ navigation }: Props) {
  const { settings, status, save } = useInvoiceSettingsStore();

  // DESIGN ONLY: neither field exists on `InvoiceSettings`.
  const [lateFeePolicy, setLateFeePolicy] = useState('none');
  const [defaultNotes, setDefaultNotes] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceSettingsFormValues, unknown, InvoiceSettingsFormOutput>({
    resolver: zodResolver(invoiceSettingsFormSchema),
    defaultValues: settingsToFormDefaults(settings),
  });

  // Re-seed the form once settings finish loading (defaultValues above only
  // apply on first mount).
  useEffect(() => {
    if (status === 'ready') {
      reset(settingsToFormDefaults(settings));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save(formValuesToSettingsInput(values));
      navigation.goBack();
    } catch {
      Alert.alert(
        "Couldn't save",
        'Your invoice settings could not be saved. Please try again.',
      );
    }
  });

  return (
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="invoice-settings-screen"
    >
      {/* Numbering & Identifiers */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="hash" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Numbering &amp; Identifiers</Text>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.colHalf}>
            <Controller
              control={control}
              name="invoicePrefix"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField
                  label="Prefix"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.invoicePrefix?.message}
                  testID="field-invoicePrefix"
                />
              )}
            />
          </View>
          <View style={styles.colHalf}>
            {/*
              Read-only, not an editable input: the invoice sequence is reserved
              and advanced exclusively by `BusinessRepository.reserveNextInvoiceNumber()`
              at invoice-creation time — nothing in the app is allowed to change it
              by hand, so this is shown for visibility only, not as a form field.
            */}
            <Text style={styles.label}>Next Sequence</Text>
            <View style={styles.readOnlyBox}>
              <Text style={styles.readOnlyBoxText}>{settings?.nextInvoiceNumber ?? 1}</Text>
            </View>
          </View>
        </View>
        <View style={styles.previewBanner}>
          <Feather name="info" size={16} color={colors.primary} />
          <View style={styles.flexShrink}>
            <Text style={styles.previewLabel}>Preview Reference</Text>
            <Text style={styles.previewValue} testID="field-nextInvoiceNumber">
              Next invoice: {formatNextInvoiceNumber(
                settings?.invoicePrefix ?? 'INV-',
                settings?.businessCode ?? '',
                settings?.nextInvoiceNumber ?? 1,
              )}
            </Text>
          </View>
        </View>
        <Controller
          control={control}
          name="currency"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Currency (3-letter code)"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="characters"
              maxLength={3}
              error={errors.currency?.message}
              testID="field-currency"
            />
          )}
        />
      </View>

      {/* Default Invoice Line Type (Pricing Method) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="columns" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Default Invoice Line Type</Text>
        </View>
        <Text style={styles.cardCaption}>
          Determines default column calculation fields on newly created invoice line items.
        </Text>
        <Controller
          control={control}
          name="invoiceType"
          render={({ field: { value, onChange } }) => (
            <OptionPicker
              label="Pricing Method"
              options={INVOICE_TYPE_OPTIONS}
              value={value}
              onChange={onChange}
              testID="field-invoiceType"
            />
          )}
        />
        <Text style={styles.hint}>
          Picking which fields appear on each invoice line — including building your own "Custom"
          field set — now lives on its own screen.
        </Text>
        <ActionButton
          label="Configure invoice fields"
          icon="sliders"
          onPress={() => navigation.navigate('InvoiceTypeSelection')}
          testID="action-configure-invoice-fields"
        />
      </View>

      {/* Payment & Terms */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="dollar-sign" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Payment &amp; Terms</Text>
        </View>
        <Controller
          control={control}
          name="defaultTaxRate"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Default tax rate (%)"
              value={typeof value === 'string' ? value : value == null ? '' : String(value)}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="decimal-pad"
              placeholder="No default"
              error={errors.defaultTaxRate?.message}
              testID="field-defaultTaxRate"
            />
          )}
        />
        <Controller
          control={control}
          name="defaultPaymentTermsDays"
          render={({ field: { value, onChange } }) => (
            <OptionPicker
              label="Default Due Date Rules"
              options={PAYMENT_TERMS_OPTIONS}
              value={value}
              onChange={onChange}
              testID="field-defaultPaymentTermsDays"
            />
          )}
        />
        {/* DESIGN ONLY: no late-fee field exists anywhere in this app. */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Default Late Fee Policy · DESIGN ONLY</Text>
          <View style={styles.chipRow}>
            {[
              { value: 'none', label: 'No surcharge' },
              { value: '1.5', label: '1.5% / mo' },
              { value: 'fixed', label: 'Fixed fee' },
            ].map((option) => {
              const selected = lateFeePolicy === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => setLateFeePolicy(option.value)}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Default Notes & Terms — DESIGN ONLY */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="file-text" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Default Notes &amp; Terms · DESIGN ONLY</Text>
        </View>
        <FormField
          label=""
          value={defaultNotes}
          onChangeText={setDefaultNotes}
          multiline
          numberOfLines={3}
          placeholder="Thank you for your business. Please remit payment within 14 days of invoice issue date."
          testID="field-defaultNotes-design-only"
        />
        <Text style={styles.cardCaption}>Not stored — no default-notes field exists yet.</Text>
      </View>

      {/* Invoice Template */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="layers" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Invoice Template</Text>
        </View>
        <Controller
          control={control}
          name="defaultInvoiceTemplate"
          render={({ field: { value, onChange } }) => (
            <View style={styles.templateGrid} testID="field-defaultInvoiceTemplate">
              {INVOICE_TEMPLATE_OPTIONS.map((option) => {
                const selected = value === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                    testID={`field-defaultInvoiceTemplate-${option.value}`}
                    onPress={() => onChange(option.value)}
                    style={[styles.templateCard, selected && styles.templateCardSelected]}
                  >
                    {selected && (
                      <View style={styles.templateCheck}>
                        <Feather name="check" size={11} color={colors.primaryText} />
                      </View>
                    )}
                    <TemplatePreview template={option.value as InvoiceTemplate} />
                    <Text style={[styles.templateLabel, selected && styles.templateLabelSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </View>

      <ActionButton
        label={isSubmitting || status === 'saving' ? 'Saving…' : 'Save Invoice Settings'}
        variant="primary"
        icon="save"
        onPress={onSubmit}
        disabled={isSubmitting || status === 'saving'}
        testID="save-invoice-settings"
      />
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

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
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardCaption: { fontSize: 12, color: colors.textMuted, marginTop: -4 },

  twoCol: { flexDirection: 'row', gap: 10 },
  colHalf: { flex: 1, minWidth: 0, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  readOnlyBox: { height: 44, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  readOnlyBoxText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },

  previewBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.background, borderRadius: 12, padding: 12 },
  previewLabel: { fontSize: 11, color: colors.textMuted },
  previewValue: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 2 },

  hint: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },

  fieldGroup: { gap: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.background },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },

  templateGrid: { flexDirection: 'row', gap: 8 },
  templateCard: { flex: 1, backgroundColor: colors.background, borderRadius: 14, padding: 8, gap: 6 },
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
});
