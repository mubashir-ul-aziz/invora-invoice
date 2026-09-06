import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

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

type Props = NativeStackScreenProps<RootStackParamList, 'EditCustomer'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

export function EditCustomerScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const { getById, update } = useCustomerStore();
  const [status, setStatus] = useState<LoadStatus>('loading');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues, unknown, CustomerFormOutput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: customerToFormDefaults(null),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getById(customerId);
        if (cancelled) {
          return;
        }
        if (!found) {
          setStatus('not-found');
          return;
        }
        reset(customerToFormDefaults(found));
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update(customerId, formValuesToCustomerInput(values));
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save", 'Your changes could not be saved. Please try again.');
    }
  });

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="edit-customer-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="edit-customer-not-found">
        <Text style={styles.errorText}>This customer no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="edit-customer-error">
        <Text style={styles.errorText}>Couldn't load this customer.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="edit-customer-screen"
    >
      <CustomerFormFields control={control} errors={errors} />
      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Save changes'}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
});
