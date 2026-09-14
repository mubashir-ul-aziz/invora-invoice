import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, StyleSheet } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CustomerFormFields } from '@/components/customer/CustomerFormFields';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
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
 * caller instead of the screen just closing on its own. Otherwise (the plain
 * "+ New customer" flow from the list), saving replaces this screen with
 * Customer Detail for the customer just created.
 */
export function CreateCustomerScreen({ navigation, route }: Props) {
  const { create } = useCustomerStore();
  const onCreated = route.params?.onCreated;
  const [justCreated, setJustCreated] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues, unknown, CustomerFormOutput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: customerToFormDefaults(null),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create(formValuesToCustomerInput(values));
      // Clear the form and keep the button disabled immediately so nothing
      // stale (filled fields, a re-enabled button) flashes while the screen
      // transition below is still in flight.
      setJustCreated(true);
      reset(customerToFormDefaults(null));
      if (onCreated) {
        onCreated(created);
        navigation.goBack();
        return;
      }
      // Replace (not navigate/goBack) so this filled-in form is removed from
      // the stack — landing on Customer Detail instead of the list, and
      // leaving no stale form behind to show blank-expecting fields if the
      // user later backs out of Detail.
      navigation.replace('CustomerDetail', { customerId: created.id });
    } catch {
      Alert.alert("Couldn't save", 'This customer could not be created. Please try again.');
    }
  });

  return (
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="create-customer-screen"
    >
      <CustomerFormFields control={control} errors={errors} />
      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Create customer'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting || justCreated}
        testID="save-customer"
      />
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
});
