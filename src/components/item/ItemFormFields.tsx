import React, { useEffect } from 'react';
import { Controller, useController, useWatch, type Control } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import { UnitOptionPicker } from '@/components/shared/UnitOptionPicker';
import { getFieldDefinition } from '@/domain/invoiceType/fieldCatalog';
import type { UnitFieldKind } from '@/domain/invoiceType/customUnits';
import { PRICING_METHOD_OPTIONS, getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { getFieldLabel } from '@/domain/invoiceType/types';
import { relevantOptionalFieldsForInvoiceType } from '@/domain/item/relevantFields';
import type { ItemFormOutput, ItemFormValues } from '@/domain/item/validation';
import { DEFAULT_LENGTH_UNIT, DEFAULT_WEIGHT_UNIT } from '@/domain/invoiceType/units';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

/** Matches the exact `useForm<ItemFormValues, unknown, ItemFormOutput>()` shape both screens use. */
type ItemFormControl = Control<ItemFormValues, unknown, ItemFormOutput>;

interface Props {
  control: ItemFormControl;
  errors: Record<string, { message?: string } | undefined>;
  /**
   * Set when this item is being created for a specific invoice (the
   * "+ Add item" catalog flow, via `CreateItemScreen`'s `defaultInvoiceTypeId`
   * param) — the item's Pricing Method can't be anything else, since §15
   * only lets an item onto an invoice that shares its pricing method, so it's
   * shown locked instead of as a choice. Absent (regular Create/Edit Item,
   * outside any invoice) leaves it a free editable dropdown.
   */
  lockedInvoiceTypeId?: InvoiceTypeId | null;
}

/**
 * The field set shared by Create Item and Edit Item — one implementation so
 * the two screens can never drift apart. Which of Weight/Length/Width/
 * Height/their unit dropdowns are shown is driven by the selected Pricing
 * Method (reusing `relevantOptionalFieldsForInvoiceType`), and for "Custom"
 * additionally by the business's own custom field selection. The price
 * field's label follows the method too (e.g. "Price per weight unit" for
 * Weight) via `getFieldLabel`, instead of a single generic "Default price"
 * that doesn't say what it's a price *of*.
 */
export function ItemFormFields({ control, errors, lockedInvoiceTypeId }: Props) {
  const invoiceTypeId = useWatch({ control, name: 'invoiceTypeId' });
  const { selection, load: loadInvoiceType } = useInvoiceTypeStore();

  useEffect(() => {
    loadInvoiceType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const relevantFields = relevantOptionalFieldsForInvoiceType(
    invoiceTypeId,
    invoiceTypeId === 'custom' ? selection?.customFieldKeys : undefined,
  );

  return (
    <>
      {lockedInvoiceTypeId ? (
        <View style={styles.readonlyRow} testID="field-invoiceTypeId-readonly">
          <Text style={styles.readonlyLabel}>Pricing Method</Text>
          <Text style={styles.readonlyValue}>{getInvoiceTypeDefinition(lockedInvoiceTypeId).label}</Text>
        </View>
      ) : (
        <Controller
          control={control}
          name="invoiceTypeId"
          render={({ field: { value, onChange } }) => (
            <OptionPicker
              label="Pricing Method"
              options={PRICING_METHOD_OPTIONS}
              value={value}
              onChange={onChange}
              testID="field-invoiceTypeId"
            />
          )}
        />
      )}
      <Field name="name" label="Item name *" control={control} errors={errors} />
      <Field name="description" label="Description" control={control} errors={errors} multiline />
      <Field name="sku" label="SKU / item code" control={control} errors={errors} />
      <SelectField name="unit" fieldKey="unit" control={control} />
      <Field
        name="defaultPrice"
        label={`${getFieldLabel(invoiceTypeId, 'unitPrice')} *`}
        control={control}
        errors={errors}
        keyboardType="decimal-pad"
      />
      <Field
        name="taxRate"
        label="Tax (%)"
        control={control}
        errors={errors}
        keyboardType="decimal-pad"
      />

      {relevantFields.includes('weight') && (
        <Field
          name="weight"
          label={`${getFieldLabel(invoiceTypeId, 'weight')} *`}
          control={control}
          errors={errors}
          keyboardType="decimal-pad"
        />
      )}
      {relevantFields.includes('weightUnit') && (
        <SelectField name="weightUnit" fieldKey="weightUnit" control={control} defaultUnit={DEFAULT_WEIGHT_UNIT} />
      )}
      {relevantFields.includes('length') && (
        <Field
          name="length"
          label={`${getFieldLabel(invoiceTypeId, 'length')} *`}
          control={control}
          errors={errors}
          keyboardType="decimal-pad"
        />
      )}
      {relevantFields.includes('width') && (
        <Field
          name="width"
          label={`${getFieldLabel(invoiceTypeId, 'width')} *`}
          control={control}
          errors={errors}
          keyboardType="decimal-pad"
        />
      )}
      {relevantFields.includes('height') && (
        <Field
          name="height"
          label={`${getFieldLabel(invoiceTypeId, 'height')} *`}
          control={control}
          errors={errors}
          keyboardType="decimal-pad"
        />
      )}
      {relevantFields.includes('lengthUnit') && (
        <SelectField name="lengthUnit" fieldKey="lengthUnit" control={control} defaultUnit={DEFAULT_LENGTH_UNIT} />
      )}
    </>
  );
}

/** Local helper to cut down on per-field Controller boilerplate above. */
function Field({
  name,
  label,
  control,
  errors,
  ...inputProps
}: {
  name: keyof ItemFormValues;
  label: string;
  control: ItemFormControl;
  errors: Record<string, { message?: string } | undefined>;
} & React.ComponentProps<typeof FormField>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <FormField
          {...inputProps}
          label={label}
          value={typeof value === 'string' ? value : String(value ?? '')}
          onChangeText={onChange}
          onBlur={onBlur}
          error={errors[name]?.message}
          testID={`field-${name}`}
        />
      )}
    />
  );
}

/**
 * A unit dropdown (generic/weight/dimension) for the item's own default
 * unit — its choices come straight from the field catalog. When `defaultUnit`
 * is given (weight/dimension only — the generic `unit` field has no natural
 * default), auto-fills it the moment this field becomes relevant (i.e. its
 * value is still blank, which is true for a brand-new item, or one that just
 * switched into a pricing method that needs a unit it didn't have before) so
 * the picker is never shown with nothing selected and the stored value
 * silently null.
 */
function SelectField({
  name,
  fieldKey,
  control,
  defaultUnit,
}: {
  name: keyof ItemFormValues;
  fieldKey: 'unit' | 'weightUnit' | 'lengthUnit';
  control: ItemFormControl;
  defaultUnit?: string;
}) {
  const definition = getFieldDefinition(fieldKey);
  const { field } = useController({ control, name });
  const value = typeof field.value === 'string' ? field.value : '';

  useEffect(() => {
    if (!value && defaultUnit) {
      field.onChange(defaultUnit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const kind: UnitFieldKind = fieldKey === 'unit' ? 'generic' : fieldKey === 'weightUnit' ? 'weight' : 'length';

  return (
    <UnitOptionPicker
      label={definition.label}
      kind={kind}
      value={value}
      onChange={field.onChange}
      testID={`field-${name}`}
    />
  );
}

const styles = StyleSheet.create({
  readonlyRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  readonlyLabel: { fontSize: 12, color: colors.textMuted },
  readonlyValue: { fontSize: 16, fontWeight: '700', color: colors.text },
});
