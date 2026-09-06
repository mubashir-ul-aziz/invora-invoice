import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CustomerFormFields } from '@/components/customer/CustomerFormFields';
import { customerToFormDefaults, formValuesToCustomerInput } from '@/domain/customer/formMapping';
import {
  customerFormSchema,
  type CustomerFormOutput,
  type CustomerFormValues,
} from '@/domain/customer/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerStore } from '@/state/customerStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCustomer'>;

/**
 * Create Customer screen. When opened with `route.params.onCreated` (a
 * future "add customer while creating an invoice" flow — see
 * `navigation/types.ts`), the newly created customer is handed back to the
 * caller instead of the screen just closing on its own.
 */
export function CreateCustomerScreen({ navigation, route }: Props) {
  const { create } = useCustomerStore();
  const onCreated = route.params?.onCreated;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues, unknown, CustomerFormOutput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: customerToFormDefaults(null),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create(formValuesToCustomerInput(values));
      onCreated?.(created);
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save", 'This customer could not be created. Please try again.');
    }
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="create-customer-screen"
    >
      <CustomerFormFields control={control} errors={errors} />
      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Create customer'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting}
        testID="save-customer"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
});
