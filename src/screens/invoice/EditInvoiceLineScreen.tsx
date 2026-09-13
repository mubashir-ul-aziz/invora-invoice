import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
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
import type { FieldKey } from '@/domain/invoiceType/fieldCatalog';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
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
 *
 * Every line on an invoice must share the invoice's own Pricing Method
 * (`assertLinesMatchPricingMethod`), so the Pricing Method field
 * `InvoiceLineFormFields` renders is only ever editable for a brand-new
 * ("+ Add custom line") line on an invoice that has no items yet — that's
 * the one moment picking a different method can't orphan anything. This
 * outer component only owns that choice; `InvoiceLineFormInner` is remounted
 * (via the `key`) whenever it changes so the form's validation schema and
 * default values are rebuilt from scratch for the newly-picked method,
 * instead of trying to reactively patch a `useForm` already in flight.
 */
export function EditInvoiceLineScreen({ navigation, route }: Props) {
  const { lineIndex } = route.params;
  const draft = useInvoiceDraftStore();
  const { selection, load: loadInvoiceType } = useInvoiceTypeStore();

  useEffect(() => {
    loadInvoiceType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canEditPricingMethod = lineIndex == null && draft.items.length === 0;
  const [pricingMethodId, setPricingMethodId] = useState<InvoiceTypeId>(draft.invoiceTypeId);
  const effectivePricingMethodId = canEditPricingMethod ? pricingMethodId : draft.invoiceTypeId;

  return (
    <InvoiceLineFormInner
      key={effectivePricingMethodId}
      navigation={navigation}
      lineIndex={lineIndex}
      pricingMethodId={effectivePricingMethodId}
      canEditPricingMethod={canEditPricingMethod}
      onChangePricingMethod={setPricingMethodId}
      customFieldKeys={selection?.customFieldKeys ?? []}
    />
  );
}

function InvoiceLineFormInner({
  navigation,
  lineIndex,
  pricingMethodId,
  canEditPricingMethod,
  onChangePricingMethod,
  customFieldKeys,
}: {
  navigation: Props['navigation'];
  lineIndex: number | null;
  pricingMethodId: InvoiceTypeId;
  canEditPricingMethod: boolean;
  onChangePricingMethod: (invoiceTypeId: InvoiceTypeId) => void;
  customFieldKeys: FieldKey[];
}) {
  const draft = useInvoiceDraftStore();
  const fieldConfig = resolveInvoiceFieldConfig({ invoiceTypeId: pricingMethodId, customFieldKeys });

  const existingLine = lineIndex != null ? draft.items[lineIndex] : null;
  const itemId = existingLine?.itemId ?? null;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceLineFormValues, unknown, InvoiceLineFormOutput>({
    resolver: zodResolver(invoiceLineFormSchemaForPricingMethod(pricingMethodId)),
    defaultValues: invoiceLineToFormDefaults(existingLine ?? blankInvoiceLine(fieldConfig)),
  });

  const onSubmit = handleSubmit((values) => {
    const input = formValuesToInvoiceLineInput(values, itemId, fieldConfig);
    if (canEditPricingMethod && pricingMethodId !== draft.invoiceTypeId) {
      // Safe without the usual `canSafelyConvertPricingMethod` dance — the
      // invoice has no items yet (that's what makes `canEditPricingMethod`
      // true), so there's nothing existing to reconcile or clear.
      draft.setInvoiceType(pricingMethodId);
    }
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
      <InvoiceLineFormFields
        control={control}
        errors={errors}
        fieldConfig={fieldConfig}
        pricingMethodEditable={canEditPricingMethod}
        onPricingMethodChange={onChangePricingMethod}
      />
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
