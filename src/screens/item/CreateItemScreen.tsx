import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Alert, StyleSheet } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { ItemFormFields } from '@/components/item/ItemFormFields';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { formValuesToItemInput, itemToFormDefaults } from '@/domain/item/formMapping';
import { itemFormSchema, type ItemFormOutput, type ItemFormValues } from '@/domain/item/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useItemStore } from '@/state/itemStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateItem'>;

/**
 * Create Item screen. When opened with `route.params.onCreated` (a future
 * "add item while creating an invoice" flow — see `navigation/types.ts`),
 * the newly created item is handed back to the caller instead of the screen
 * just closing on its own.
 */
export function CreateItemScreen({ navigation, route }: Props) {
  const { create } = useItemStore();
  const onCreated = route.params?.onCreated;
  const defaultInvoiceTypeId = route.params?.defaultInvoiceTypeId;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues, unknown, ItemFormOutput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      ...itemToFormDefaults(null),
      ...(defaultInvoiceTypeId ? { invoiceTypeId: defaultInvoiceTypeId } : {}),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create(formValuesToItemInput(values));
      onCreated?.(created);
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save", 'This item could not be created. Please try again.');
    }
  });

  return (
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="create-item-screen"
    >
      <ItemFormFields control={control} errors={errors} lockedInvoiceTypeId={defaultInvoiceTypeId ?? null} />
      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Create item'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting}
        testID="save-item"
      />
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
});
