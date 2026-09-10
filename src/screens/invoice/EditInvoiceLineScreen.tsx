import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, StyleSheet } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceLineFormFields } from '@/components/invoice/InvoiceLineFormFields';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { formValuesToInvoiceLineInput, invoiceLineToFormDefaults } from '@/domain/invoice/formMapping';
import { blankInvoiceLine } from '@/domain/invoice/snapshot';
import {
  invoiceLineFormSchemaForPricingMethod,
  type InvoiceLineFormOutput,
  type InvoiceLineFormValues,
} from '@/domain/invoice/validation';
import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { RootStackParamList } from '@/navigation/types';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditInvoiceLine'>;

/**
 * Add ("+ Add custom line" / fine-tuning after picking a catalog item) or
 * edit (tapping an existing row) one invoice line. `lineIndex: null` means
 * "adding" — one screen for both, mirroring `CreateItemScreen`/`EditItemScreen`
 * sharing `ItemFormFields`, just collapsed into a single component here since
 * the two flows differ only in whether an existing line is preloaded.
 */
export function EditInvoiceLineScreen({ navigation, route }: Props) {
  const { lineIndex } = route.params;
  const draft = useInvoiceDraftStore();
  const { selection, load: loadInvoiceType } = useInvoiceTypeStore();

  useEffect(() => {
    loadInvoiceType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldConfig = resolveInvoiceFieldConfig({
    invoiceTypeId: draft.invoiceTypeId,
    customFieldKeys: selection?.customFieldKeys ?? [],
  });

  const existingLine = lineIndex != null ? draft.items[lineIndex] : null;
  const itemId = existingLine?.itemId ?? null;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceLineFormValues, unknown, InvoiceLineFormOutput>({
    resolver: zodResolver(invoiceLineFormSchemaForPricingMethod(draft.invoiceTypeId)),
    defaultValues: invoiceLineToFormDefaults(existingLine ?? blankInvoiceLine(fieldConfig)),
  });

  const onSubmit = handleSubmit((values) => {
    const input = formValuesToInvoiceLineInput(values, itemId, fieldConfig);
    if (lineIndex != null) {
      draft.updateLine(lineIndex, input);
    } else {
      draft.addLine(input);
    }
    navigation.goBack();
  });

  const handleRemove = () => {
    if (lineIndex == null) {
      return;
    }
    Alert.alert('Remove line', 'Remove this line item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          draft.removeLine(lineIndex);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="edit-invoice-line-screen"
    >
      <InvoiceLineFormFields control={control} errors={errors} fieldConfig={fieldConfig} />
      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Save line'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting}
        testID="save-invoice-line"
      />
      {lineIndex != null && (
        <ActionButton label="Remove line" onPress={handleRemove} testID="remove-invoice-line" />
      )}
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
});
