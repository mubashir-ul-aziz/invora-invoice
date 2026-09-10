import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FormField } from '@/components/businessCard/FormField';
import { OptionPicker } from '@/components/business/OptionPicker';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { formValuesToSettingsInput, settingsToFormDefaults } from '@/domain/business/formMapping';
import {
  formatNextInvoiceNumber,
  INVOICE_TEMPLATE_OPTIONS,
  INVOICE_TYPE_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
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

export function InvoiceSettingsScreen({ navigation }: Props) {
  const { settings, status, save } = useInvoiceSettingsStore();

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
      <Controller
        control={control}
        name="invoicePrefix"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField
            label="Invoice prefix"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.invoicePrefix?.message}
            testID="field-invoicePrefix"
          />
        )}
      />
      {/*
        Read-only, not an editable input: the invoice sequence is reserved
        and advanced exclusively by `BusinessRepository.reserveNextInvoiceNumber()`
        at invoice-creation time — nothing in the app is allowed to change it
        by hand, so this is shown for visibility only, not as a form field.
      */}
      <Text style={styles.readOnlyLabel}>Next invoice number</Text>
      <Text style={styles.readOnlyValue} testID="field-nextInvoiceNumber">
        {formatNextInvoiceNumber(
          settings?.invoicePrefix ?? 'INV-',
          settings?.businessCode ?? '',
          settings?.nextInvoiceNumber ?? 1,
        )}
      </Text>
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
            label="Default payment terms"
            options={PAYMENT_TERMS_OPTIONS}
            value={value}
            onChange={onChange}
            testID="field-defaultPaymentTermsDays"
          />
        )}
      />

      <Controller
        control={control}
        name="defaultInvoiceTemplate"
        render={({ field: { value, onChange } }) => (
          <OptionPicker
            label="Default invoice template"
            options={INVOICE_TEMPLATE_OPTIONS}
            value={value}
            onChange={onChange}
            testID="field-defaultInvoiceTemplate"
          />
        )}
      />

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
        onPress={() => navigation.navigate('InvoiceTypeSelection')}
        testID="action-configure-invoice-fields"
      />

      <ActionButton
        label={isSubmitting || status === 'saving' ? 'Saving…' : 'Save'}
        variant="primary"
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
  hint: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  readOnlyLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: -10 },
  readOnlyValue: { fontSize: 15, color: colors.textMuted },
});
