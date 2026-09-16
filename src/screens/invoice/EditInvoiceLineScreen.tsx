import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

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
      {/* Decorative sheet handle + title, matching the Stitch "Edit Line Item" bottom-sheet look inside this pushed screen. */}
      <View style={styles.sheetHeader}>
        <View style={styles.grabHandle} />
        <View style={styles.sheetTitleRow}>
          <Feather name="edit-3" size={20} color={colors.primary} />
          <Text style={styles.sheetTitle}>{lineIndex != null ? 'Edit Line Item' : 'Add Line Item'}</Text>
        </View>
      </View>

      <InvoiceLineFormFields
        control={control}
        errors={errors}
        fieldConfig={fieldConfig}
        pricingMethodEditable={canEditPricingMethod}
        onPricingMethodChange={onChangePricingMethod}
      />

      <View style={styles.actionRow}>
        {lineIndex != null && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete line item"
            testID="remove-invoice-line"
            onPress={handleRemove}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Feather name="trash-2" size={18} color={colors.danger} />
            <Text style={styles.deleteButtonText}>Delete Line</Text>
          </Pressable>
        )}
        <View style={styles.saveButtonWrap}>
          <ActionButton
            label={isSubmitting ? 'Saving…' : 'Save Line Item'}
            variant="primary"
            icon="check"
            onPress={onSubmit}
            disabled={isSubmitting}
            testID="save-invoice-line"
          />
        </View>
      </View>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },

  sheetHeader: { alignItems: 'center', gap: 10, paddingBottom: 2 },
  grabHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FBE4E2',
  },
  deleteButtonText: { fontSize: 14, fontWeight: '700', color: colors.danger },
  saveButtonWrap: { flex: 1 },
});
